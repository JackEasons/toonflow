import express from "express";
import pLimit from "p-limit";
import u from "@/utils";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { resolveNegativePrompt } from "@/utils/negativePrompt";
import { quoteModelCalls, releasePointHold, reserveModelCallPoints, settlePointHold } from "@/utils/modelBilling";

const router = express.Router();

type AssetType = "role" | "scene" | "tool";

interface AssetTypeConfig {
  label: string;
  taskClass: string;
  dir: string;
  promptTitle: string;
  promptEnd: string;
  visualPromptKey: string;
}

const assetTypeConfig: Record<AssetType, AssetTypeConfig> = {
  role: {
    label: "角色",
    taskClass: "角色图生成",
    dir: "role",
    promptTitle: "角色标准四视图",
    promptEnd: "人物角色四视图",
    visualPromptKey: "art_character",
  },
  scene: {
    label: "场景",
    taskClass: "场景图生成",
    dir: "scene",
    promptTitle: "标准场景图",
    promptEnd: "标准场景图",
    visualPromptKey: "art_scene",
  },
  tool: {
    label: "道具",
    taskClass: "道具图生成",
    dir: "props",
    promptTitle: "标准道具图",
    promptEnd: "标准道具图",
    visualPromptKey: "art_prop",
  },
};

function buildPrompt(cfg: AssetTypeConfig, artStyle: string, name: string, prompt: string): string {
  return `
    请根据以下参数生成${cfg.promptTitle}：

    **基础参数：**
    - 画风风格: ${artStyle || "未指定"}

    **${cfg.label}设定：**
    - 名称:${name},
    - 提示词:${prompt},

    请严格按照系统规范生成${cfg.promptEnd}。
  `;
}

const requestSchema = {
  projectId: z.number(),
  model: z.string(),
  resolution: z.string(),
  concurrentCount: z.number().int().min(1).optional(),
  items: z.array(
    z.object({
      id: z.number(),
      type: z.enum(["role", "scene", "tool", "storyboard"]),
      name: z.string(),
      prompt: z.string(),
      base64: z.string().optional().nullable(),
    }),
  ),
};

export default router.post("/", validateFields(requestSchema), async (req, res) => {
  const { projectId, model, resolution, concurrentCount, items } = req.body;
  const userId = String((req as any).user?.id || "");
  if (!userId) return res.status(401).send(error("未提供token"));

  // 1. 查询项目
  const project = await u.db("o_project").where("id", projectId).select("artStyle", "type", "intro").first();
  if (!project) return res.status(500).send(error("项目为空"));

  let quote;
  try {
    quote = await quoteModelCalls(userId, [
      {
        count: items.length,
        model,
        modelType: "image",
        taskType: "asset_center_image_generation",
      },
    ]);
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取积分报价失败"));
  }
  if (!quote.enough) return res.status(400).send(error(`积分不足，需要 ${quote.requiredPoints} 积分，当前可用 ${quote.availablePoints} 积分`));

  // 2. 逐条插入 o_image 占位记录，收集 imageId 列表
  const totalNovelId: number[] = [];
  const holdMap = new Map<number, Awaited<ReturnType<typeof reserveModelCallPoints>>>();
  const pointsPerCall = quote.items[0]?.pointsPerCall || 0;
  for (const item of items) {
    const [imageId] = await u.db("o_image").insert({
      type: item.type,
      state: "生成中",
      assetsId: item.id,
    });
    await u.db("o_assets").where("id", item.id).update({ imageId });
    totalNovelId.push(imageId);
  }
  try {
    for (const imageId of totalNovelId) {
      const itemQuote = {
        ...quote,
        enough: true,
        items: quote.items[0] ? [{ ...quote.items[0], count: 1, requiredPoints: pointsPerCall }] : [],
        requiredPoints: pointsPerCall,
      };
      const hold = await reserveModelCallPoints({
        billingMeta: itemQuote,
        description: `资产中心批量图片生成：${quote.items[0]?.modelLabel || model}`,
        idempotencyKey: `model-call:asset-center-image:${imageId}`,
        projectId,
        quote: itemQuote,
        relatedId: imageId,
        taskType: "asset_center_image_generation",
        userId,
      });
      holdMap.set(imageId, hold);
    }
  } catch (err: any) {
    await Promise.all([...holdMap.values()].map((hold) => releasePointHold(hold?.id)));
    await u.db("o_image").whereIn("id", totalNovelId).update({ state: "生成失败", errorReason: err?.message || "积分冻结失败" });
    return res.status(400).send(error(err?.message || "积分不足"));
  }

  // 3. 后台异步并发生成，不阻塞响应
  const limit = pLimit(concurrentCount ?? 1);

  const tasks = items.map((item: { id: number; type: string; name: string; prompt: string; base64: string | null | undefined }, index: number) =>
    limit(async () => {
      const imageId = totalNovelId[index];
      const billingHold = holdMap.get(imageId);
      const data = await u.db("o_image").where("id", imageId).select("state").first();
      if (data?.state === "生成失败") {
        await releasePointHold(billingHold?.id);
        return;
      }
      const cfg = assetTypeConfig[item.type as AssetType];
      if (!cfg) {
        await releasePointHold(billingHold?.id);
        await u.db("o_image").where("id", imageId).update({ state: "生成失败", errorReason: "不支持的类型" });
        return;
      }

      await u.db("o_assets").where("id", item.id).update({ imageId });

      const imagePath = `/${projectId}/${cfg.dir}/${uuidv4()}.jpg`;
      const storageProvider = u.oss.getStorageProvider();
      const userPrompt = buildPrompt(cfg, project.artStyle ?? "", item.name, item.prompt);
      const negativePromptSource = u.getArtPrompt(project.artStyle ?? "", "art_skills", cfg.visualPromptKey);
      const negativePrompt = resolveNegativePrompt({ prompt: userPrompt, negativePromptSource }, { mediaType: "image", modelKey: model });
      const describe = `生成${cfg.label}图，名称：${item.name}，提示词：${item.prompt}`;
      const relatedObjects = {
        billingHoldId: billingHold?.id || null,
        billingRelatedId: imageId,
        billingTaskType: "asset_center_image_generation",
        id: item.id,
        imageId,
        projectId,
        type: cfg.label,
        prompt: userPrompt,
        negativePrompt,
      };
      try {
        await u.db("o_image").where("id", imageId).update({
          prompt: userPrompt,
          negativePrompt,
          model: model.split(/:(.+)/)[1],
          resolution,
        });
        const aiImage = u.Ai.Image(model);
        await aiImage.run(
          {
            prompt: userPrompt,
            negativePrompt,
            negativePromptSource,
            referenceList: item.base64 ? [{ base64: item.base64, type: "image" }] : [],
            size: resolution,
            aspectRatio: "16:9",
          },
          {
            taskClass: cfg.taskClass,
            describe,
            projectId,
            relatedObjects: JSON.stringify(relatedObjects),
          },
        );
        await aiImage.save(imagePath, storageProvider);

        const imageData = await u.db("o_image").where("id", imageId).select("*").first();
        if (!imageData || imageData.state === "生成失败") {
          await releasePointHold(billingHold?.id);
          return;
        }
        await settlePointHold(billingHold?.id);
        await u
          .db("o_image")
          .where("id", imageId)
          .update({
            state: "已完成",
            filePath: imagePath,
            storageProvider,
            type: item.type,
            model: model.split(/:(.+)/)[1],
            resolution,
            prompt: userPrompt,
            negativePrompt,
          });

        await u.db("o_assets").where("id", item.id).update({ imageId });
      } catch (e: any) {
        await releasePointHold(billingHold?.id);
        await u
          .db("o_image")
          .where("id", imageId)
          .update({ state: "生成失败", errorReason: u.error(e).message });
      }
    }),
  );

  // 后台执行，不等待结果
  Promise.all(tasks).catch(() => {});

  return res.status(200).send(success({ total: items.length }));
});
