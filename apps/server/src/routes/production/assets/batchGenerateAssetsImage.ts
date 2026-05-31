import express from "express";
import u from "@/utils";
import { z } from "zod";
import sharp from "sharp";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { Output } from "ai";
import { resolveNegativePrompt } from "@/utils/negativePrompt";
import { quoteModelCalls, recordPointHoldModelUsage, releasePointHold, reserveModelCallPoints, resolveModelBillingKey, settlePointHold } from "@/utils/modelBilling";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    assetIds: z.array(z.number()),
    projectId: z.number(),
    scriptId: z.number(),
    concurrentCount: z.number().min(1).optional(),
  }),
  async (req, res) => {
    const { assetIds, projectId, scriptId, concurrentCount = 5 } = req.body;
    const userId = String((req as any).user?.id || "");
    if (!userId) return res.status(401).send(error("未提供token"));

    const projectSettingData = await u.db("o_project").where("id", projectId).select("imageModel", "imageQuality", "artStyle").first();

    const assetsDataArr = await u.db("o_assets").whereIn("id", assetIds).select("id", "describe", "name", "type", "assetsId");
    if (!assetsDataArr.length) return res.status(200).send(success([]));
    let quote;
    try {
      const textBillingModel = await resolveModelBillingKey("universalAi");
      quote = await quoteModelCalls(userId, [
        {
          count: assetsDataArr.length,
          model: textBillingModel,
          modelType: "text",
          taskType: "asset_prompt_generation",
        },
        {
          count: assetsDataArr.length,
          model: projectSettingData?.imageModel as string,
          modelType: "image",
          taskType: "asset_image_generation",
        },
      ]);
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "获取积分报价失败"));
    }
    if (!quote.enough) return res.status(400).send(error(`积分不足，需要 ${quote.requiredPoints} 积分，当前可用 ${quote.availablePoints} 积分`));

    const parentIds = assetsDataArr.map((item) => item.assetsId).filter((id) => id !== null);
    const parentAssetsData = await u
      .db("o_assets")
      .leftJoin("o_image", "o_assets.imageId", "o_image.id")
      .whereIn("o_assets.id", parentIds as number[])
      .select("o_assets.id", "o_image.filePath", "o_assets.describe");
    assetsDataArr.forEach((i: any) => {
      const parent = parentAssetsData.find((item) => item.id === i.assetsId);
      if (parent) {
        i.parentDescribe = parent.describe;
      }
    });
    const imageUrlRecord: Record<number, string> = {};
    parentAssetsData.forEach((item) => {
      if (item.filePath) imageUrlRecord[item.id] = item.filePath;
    });
    const rolePrompt = u.getArtPrompt(projectSettingData!.artStyle!, "art_skills", "art_character_derivative");
    const toolPrompt = u.getArtPrompt(projectSettingData!.artStyle!, "art_skills", "art_prop_derivative");
    const scenePrompt = u.getArtPrompt(projectSettingData!.artStyle!, "art_skills", "art_scene_derivative");
    const promptRecord: Record<string, { prompt: string }> = {
      role: {
        prompt: rolePrompt,
      },
      tool: {
        prompt: toolPrompt,
      },
      scene: {
        prompt: scenePrompt,
      },
    };
    // 先批量为所有 assets 创建 image 记录并标记为"生成中"
    const imageIdMap: Record<number, number> = {};
    const holdMap = new Map<number, Awaited<ReturnType<typeof reserveModelCallPoints>>>();
    try {
      const itemQuote = {
        ...quote,
        enough: true,
        items: quote.items.map((item) => ({ ...item, count: 1, requiredPoints: item.pointsPerCall })),
        requiredPoints: quote.items.reduce((sum, item) => sum + item.pointsPerCall, 0),
      };
      for (const item of assetsDataArr) {
        const [imageId] = await u.db("o_image").insert({
          assetsId: item.id,
          type: item.type,
          state: "生成中",
          resolution: projectSettingData?.imageQuality,
          model: projectSettingData?.imageModel,
        });
        imageIdMap[item.id!] = imageId;
        await u.db("o_assets").where("id", item.id).update({ imageId: imageId });

        const hold = await reserveModelCallPoints({
          billingMeta: itemQuote,
          description: `资产图片生成：${itemQuote.items.map((quoteItem) => quoteItem.modelLabel).join(" + ") || projectSettingData?.imageModel}`,
          episodeId: scriptId,
          idempotencyKey: `model-call:image:${imageId}`,
          projectId,
          quote: itemQuote,
          relatedId: imageId,
          taskType: "asset_image_generation",
          userId,
        });
        holdMap.set(item.id!, hold);
      }
    } catch (err: any) {
      await Promise.all([...holdMap.values()].map((hold) => releasePointHold(hold?.id)));
      await Promise.all(Object.values(imageIdMap).map((imageId) => u.db("o_image").where({ id: imageId }).update({ errorReason: err?.message || "积分冻结失败", state: "生成失败" })));
      return res.status(400).send(error(err?.message || "积分不足"));
    }

    const imageData: { id: number; state: string; src: string }[] = [];
    res.status(200).send(success("开始生成资产图片"));
    const generateSingleAsset = async (item: any) => {
      const imageId = imageIdMap[item.id!];
      const typeConfig = promptRecord[item.type!] || promptRecord["role"];
      const billingHold = holdMap.get(item.id!);
      try {
        const textResult = await u.Ai.Text("universalAi").invoke({
          system: `${typeConfig.prompt}`,
          messages: [
            {
              role: "user",
              content: `
            父级资产描述: ${item.parentDescribe || "无详细描述"}
            当前资产描述: ${item.describe || "无详细描述"}`,
            },
          ],
        });
        const { text } = textResult;
        await recordPointHoldModelUsage(billingHold?.id, textResult, { usagePhase: "asset_prompt_generation" });
        await u.db("o_assets").where("id", item.id).update({ prompt: text });

        const imageBase64 = imageUrlRecord[item.assetsId!] ? await u.oss.getImageBase64(imageUrlRecord[item.assetsId!]) : null;
        const negativePrompt = resolveNegativePrompt(
          { prompt: text, negativePromptSource: typeConfig.prompt },
          { mediaType: "image", modelKey: projectSettingData?.imageModel as `${string}:${string}` },
        );
        const repeloadObj = {
          assetsId: item.id,
          billingHoldId: billingHold?.id || null,
          billingRelatedId: imageId,
          billingTaskType: "asset_image_generation",
          imageId,
          projectId,
          prompt: text,
          negativePrompt,
          size: projectSettingData?.imageQuality as "1K" | "2K" | "4K",
          aspectRatio: "16:9" as `${number}:${number}`,
        };
        await u.db("o_image").where({ id: imageId }).update({
          prompt: text,
          negativePrompt,
        });
        const imageCls = await u.Ai.Image(projectSettingData?.imageModel as `${string}:${string}`).run(
          {
            referenceList: imageBase64 ? [{ type: "image", base64: imageBase64 }] : [],
            negativePromptSource: typeConfig.prompt,
            ...repeloadObj,
          },
          {
            taskClass: "生成图片",
            describe: "资产图片生成",
            relatedObjects: JSON.stringify(repeloadObj),
            projectId: projectId,
          },
        );
        const savePath = `/${projectId}/assets/${scriptId}/${item.type}/${u.uuid()}.jpg`;
        const storageProvider = u.oss.getStorageProvider();
        await imageCls.save(savePath, storageProvider);
        await settlePointHold(billingHold?.id);
        await u.db("o_image").where({ id: imageId }).update({ state: "已完成", filePath: savePath, storageProvider });
        return {
          id: item.id!,
          state: "已完成",
          src: await u.oss.getSmallImageUrl(savePath),
        };
      } catch (e) {
        await releasePointHold(billingHold?.id);
        await u
          .db("o_image")
          .where({ id: imageId })
          .update({ state: "生成失败", errorReason: u.error(e).message });
        return {
          id: item.id!,
          state: "生成失败",
          src: "",
        };
      }
    };

    // 按 concurrentCount 分批并发执行
    for (let i = 0; i < assetsDataArr.length; i += concurrentCount) {
      const batch = assetsDataArr.slice(i, i + concurrentCount);
      const batchResults = await Promise.all(batch.map(generateSingleAsset));
      imageData.push(...batchResults);
    }
  },
);
