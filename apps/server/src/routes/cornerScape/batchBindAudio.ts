import express from "express";
import u from "@/utils";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { tool, zodSchema } from "ai";
import { quoteModelCalls, releasePointHold, reserveModelCallPoints, resolveModelBillingKey, settlePointHoldWithModelUsage } from "@/utils/modelBilling";
const router = express.Router();

// 获取资产
export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    assetsIds: z.array(z.number()),
    concurrentCount: z.number().min(1).optional(),
  }),
  async (req, res) => {
    const { projectId, assetsIds, concurrentCount } = req.body;
    const userId = String((req as any).user?.id || "");
    if (!userId) return res.status(401).send(error("未提供token"));
    const normalizedProjectId = Number(projectId);
    const normalizedAssetIds = (Array.isArray(assetsIds) ? assetsIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));

    const assetsData = await u
      .db("o_assets")
      .whereIn("id", normalizedAssetIds)
      .andWhere("projectId", normalizedProjectId)
      .select("id", "name", "describe", "type");
    if (!assetsData.length) return res.status(200).send(success());
    const assetDbIds = assetsData.map((item) => Number(item.id)).filter((id) => Number.isFinite(id));

    const audioData = await u
      .db("o_assets")
      .where("type", "audio")
      .whereNull("assetsId")
      .andWhere("projectId", normalizedProjectId)
      .select("id", "name", "describe");

    if (!audioData.length) return res.status(400).send(error("暂无设置音频，请先前往资产中心上传音频"));

    let quote;
    try {
      const billingModel = await resolveModelBillingKey("universalAi");
      quote = await quoteModelCalls(userId, [
        {
          count: assetsData.length,
          model: billingModel,
          modelType: "text",
          taskType: "asset_audio_binding",
        },
      ]);
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "获取积分报价失败"));
    }
    if (!quote.enough) return res.status(400).send(error(`积分不足，需要 ${quote.requiredPoints} 积分，当前可用 ${quote.availablePoints} 积分`));

    const holdMap = new Map<number, Awaited<ReturnType<typeof reserveModelCallPoints>>>();
    const pointsPerCall = quote.items[0]?.pointsPerCall || 0;
    const billingAttemptId = u.uuid();
    try {
      for (const asset of assetsData) {
        const assetId = Number(asset.id);
        if (!Number.isFinite(assetId)) continue;
        const itemQuote = {
          ...quote,
          enough: true,
          items: quote.items[0] ? [{ ...quote.items[0], count: 1, requiredPoints: pointsPerCall }] : [],
          requiredPoints: pointsPerCall,
        };
        const hold = await reserveModelCallPoints({
          billingMeta: itemQuote,
          description: `资产音频匹配：${quote.items[0]?.modelLabel || "universalAi"}`,
          idempotencyKey: `model-call:asset-audio-binding:${assetId}:${billingAttemptId}`,
          projectId: normalizedProjectId,
          quote: itemQuote,
          relatedId: assetId,
          taskType: "asset_audio_binding",
          userId,
        });
        holdMap.set(assetId, hold);
      }
    } catch (err: any) {
      await Promise.all([...holdMap.values()].map((hold) => releasePointHold(hold?.id)));
      await u
        .db("o_assets")
        .whereIn("id", assetDbIds)
        .update({ audioBindState: "生成失败" } as any);
      return res.status(400).send(error(err?.message || "积分不足"));
    }

    const batchSize = Math.max(1, Number(concurrentCount || 1));

    async function processAsset(asset: (typeof assetsData)[number]) {
      const assetId = Number(asset.id);
      if (!Number.isFinite(assetId)) return;
      const billingHold = holdMap.get(assetId);
      try {
        const resultTool = tool({
          description: "匹配完成后必须调用此工具提交结果",
          inputSchema: zodSchema<{ audioId?: number | null }>(
            z
              .object({
                audioId: z.number().nullable().optional().describe("与该资产匹配的音频ID列表，若无合适匹配则返回空数组"),
              }),
          ),
          execute: async (result) => {
            await u.db("o_assetsRole2Audio").where("assetsRoleId", assetId).delete();
            const audioId = Number(result?.audioId);
            if (Number.isFinite(audioId)) await u.db("o_assetsRole2Audio").insert({ assetsRoleId: assetId, assetsAudioId: audioId });
            await u.db("o_assets").where("id", assetId).update({ audioBindState: "已完成" } as any);
            return "无需回复用户任何内容";
          },
        });

        const audioList = audioData.map((i) => `- ID:${i.id} | 名称:${i.name} | 描述:${i.describe ?? "无"}`).join("\n");
        const promptData = await u.db("o_prompt").where("type", "audioBindPrompt").first();
        let audioBindPrompt = "" as string | undefined;
        if (promptData && promptData.useData) {
          audioBindPrompt = promptData.useData;
        } else {
          audioBindPrompt = promptData?.data ?? undefined;
        }
        const aiResult = await u.Ai.Text("universalAi").invoke({
          messages: [
            {
              role: "system",
              content: `
              ${audioBindPrompt}
              `,
            },
            {
              role: "user",
              content: `
                ## 候选音频列表
                ${audioList}
                ## 待匹配资产
                - ID:${asset.id} | 名称:${asset.name} | 描述:${asset.describe ?? "无"} | 类型：${asset.type}
                请从候选音频列表中为该资产选出来一个最符合该角色设定的音色，并调用 resultTool 提交结果。
           `,
            },
          ],
          tools: { resultTool },
        });
        await settlePointHoldWithModelUsage(billingHold?.id, aiResult);
      } catch (e) {
        await releasePointHold(billingHold?.id);
        await u.db("o_assets").where("id", assetId).update({ audioBindState: "生成失败" } as any);
        console.error(`[bindAudio] 资产 ${assetId} 处理失败:`, e);
      }
    }

    async function runWithConcurrency() {
      for (let i = 0; i < assetsData.length; i += batchSize) {
        const batch = assetsData.slice(i, i + batchSize);

        await Promise.all(batch.map((asset) => processAsset(asset)));
      }
    }
    await u
      .db("o_assets")
      .whereIn("id", assetDbIds)
      .update({ audioBindState: "生成中" } as any);
    runWithConcurrency();
    res.status(200).send(success());
  },
);
