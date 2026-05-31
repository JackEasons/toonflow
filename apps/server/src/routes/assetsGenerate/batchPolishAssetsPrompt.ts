import express from "express";
import u from "@/utils";
import pLimit from "p-limit";
import * as zod from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { quoteModelCalls, releasePointHold, reserveModelCallPoints, resolveModelBillingKey, settlePointHoldWithModelUsage } from "@/utils/modelBilling";
const router = express.Router();
interface OutlineItem {
  description: string;
  name: string;
}

interface OutlineData {
  chapterRange: number[];
  characters?: OutlineItem[];
  props?: OutlineItem[];
  scenes?: OutlineItem[];
}

interface NovelChapter {
  id: number;
  reel: string;
  chapter: string;
  chapterData: string;
  projectId: number;
}

type ItemType = "characters" | "props" | "scenes";

//润色提示词
export default router.post(
  "/",
  validateFields({
    items: zod.array(
      zod.object({
        assetsId: zod.number(),
        type: zod.string(),
        name: zod.string(),
        describe: zod.string(),
      }),
    ),
    projectId: zod.number(),
    concurrentCount: zod.number().int().min(1).optional(),
    otherTextPrompt: zod.string(),
  }),
  async (req, res) => {
    const { projectId, items, concurrentCount, otherTextPrompt } = req.body;
    const userId = String((req as any).user?.id || "");
    if (!userId) return res.status(401).send(error("未提供token"));
    if (!items.length) return res.status(200).send(success({ total: 0 }));

    //获取风格
    const project = await u.db("o_project").where("id", projectId).select("artStyle", "type", "intro").first();
    //如果没有找到对应的项目，返回错误
    if (!project) return res.status(500).send(error("项目为空"));

    // 预加载公共数据
    const assetsIds = items.map((item: { assetsId: number }) => item.assetsId);
    //查询所有资产，用于判断每个资产是否是衍生资产
    const assetsDataList = await u.db("o_assets").whereIn("id", assetsIds).select("id", "assetsId");
    if (!assetsDataList || assetsDataList.length !== assetsIds.length) return res.status(500).send(error("资产不存在"));
    const assetsDataMap = new Map(assetsDataList.map((a: any) => [a.id, a]));

    const getTypeConfig = (
      isDerivative: boolean,
    ): Record<string, { promptKey: string; itemType: ItemType; label: string; nameLabel: string; visualManual: string }> => ({
      role: {
        promptKey: "role-polish",
        itemType: "characters",
        label: "角色标准四视图",
        nameLabel: "角色",
        visualManual: isDerivative ? "art_character_derivative" : "art_character",
      },
      scene: {
        promptKey: "scene-polish",
        itemType: "scenes",
        label: "场景图",
        nameLabel: "场景",
        visualManual: isDerivative ? "art_scene_derivative" : "art_scene",
      },
      tool: {
        promptKey: "tool-polish",
        itemType: "props",
        label: "道具图",
        nameLabel: "道具",
        visualManual: isDerivative ? "art_prop_derivative" : "art_prop",
      },
    });

    let quote;
    try {
      const billingModel = await resolveModelBillingKey("universalAi");
      quote = await quoteModelCalls(userId, [
        {
          count: items.length,
          model: billingModel,
          modelType: "text",
          taskType: "asset_prompt_polish",
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
      for (const item of items) {
        const itemQuote = {
          ...quote,
          enough: true,
          items: quote.items[0] ? [{ ...quote.items[0], count: 1, requiredPoints: pointsPerCall }] : [],
          requiredPoints: pointsPerCall,
        };
        const hold = await reserveModelCallPoints({
          billingMeta: itemQuote,
          description: `资产提示词批量润色：${quote.items[0]?.modelLabel || "universalAi"}`,
          idempotencyKey: `model-call:asset-prompt:${item.assetsId}:${billingAttemptId}`,
          projectId,
          quote: itemQuote,
          relatedId: item.assetsId,
          taskType: "asset_prompt_polish",
          userId,
        });
        holdMap.set(item.assetsId, hold);
      }
    } catch (err: any) {
      await Promise.all([...holdMap.values()].map((hold) => releasePointHold(hold?.id)));
      await u.db("o_assets").whereIn("id", assetsIds).update({ promptState: "失败", promptErrorReason: err?.message || "积分冻结失败" });
      return res.status(400).send(error(err?.message || "积分不足"));
    }

    // 所有前置检测通过后，再批量更新状态为生成中
    await u.db("o_assets").whereIn("id", assetsIds).update({ promptState: "生成中" });

    // 后台异步并发生成，不阻塞响应
    const limit = pLimit(concurrentCount ?? 1);
    const tasks = items.map((item: { assetsId: number; type: string; name: string; describe: string }) =>
      limit(async () => {
        const billingHold = holdMap.get(item.assetsId);
        const assetData = assetsDataMap.get(item.assetsId);
        if (!assetData) {
          await releasePointHold(billingHold?.id);
          return;
        }
        const typeConfig = getTypeConfig(!!assetData.assetsId);
        const config = typeConfig[item.type];
        if (!config) {
          await releasePointHold(billingHold?.id);
          await u.db("o_assets").where("id", item.assetsId).update({ promptState: "失败", promptErrorReason: "不支持的类型" });
          return;
        }
        //获取到视觉手册
        const visualManual = await u.getArtPrompt(project.artStyle as string, "art_skills", config.visualManual);
        if (!visualManual) {
          await releasePointHold(billingHold?.id);
          await u.db("o_assets").where("id", item.assetsId).update({ promptState: "生成失败", promptErrorReason: "视觉手册未定义" });
          return;
        }
        const systemPrompt = visualManual;
        try {
          const aiResult = await u.Ai.Text("universalAi").invoke({
            system: systemPrompt + "\n" + otherTextPrompt,
            messages: [
              {
                role: "user",
                content: `
                    **基础参数：**
      **${config.nameLabel}设定：**
      - ${config.nameLabel}名称:${item.name},
      - ${config.nameLabel}描述:${item.describe},`,
              },
            ],
          });
          const { _output } = aiResult as any;

          if (!_output) {
            await releasePointHold(billingHold?.id);
            await u.db("o_assets").where("id", item.assetsId).update({ promptState: "生成失败" });
            return;
          }

          await u.db("o_assets").where("id", item.assetsId).update({ prompt: _output, promptState: "已完成" });
          await settlePointHoldWithModelUsage(billingHold?.id, aiResult);
        } catch (e: any) {
          await releasePointHold(billingHold?.id);
          await u
            .db("o_assets")
            .where("id", item.assetsId)
            .update({ promptState: "失败", promptErrorReason: u.error(e).message });
        }
      }),
    );

    // 后台执行，不等待结果
    Promise.all(tasks).catch(() => {});

    return res.status(200).send(success({ total: items.length }));
  },
);
