import express from "express";
import u from "@/utils";
import * as zod from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { quoteModelCalls, releasePointHold, reserveModelCallPoints, resolveModelBillingKey, settlePointHoldWithModelUsage } from "@/utils/modelBilling";
const router = express.Router();


type ItemType = "characters" | "props" | "scenes";

//润色提示词
export default router.post(
  "/",
  validateFields({
    assetsId: zod.number(),
    projectId: zod.number(),
    type: zod.string(),
    name: zod.string(),
    describe: zod.string(),
  }),
  async (req, res) => {
    const { assetsId, projectId, type, name, describe } = req.body;
    const userId = String((req as any).user?.id || "");
    if (!userId) return res.status(401).send(error("未提供token"));

    //获取风格
    const project = await u.db("o_project").where("id", projectId).select("artStyle", "type", "intro").first();
    //如果没有找到对应的项目，返回错误
    if (!project) return res.status(500).send(error("项目为空"));

    //查询资产是否是衍生资产
    const assetsData = await u.db("o_assets").where("id", assetsId).select("assetsId").first();
    if (!assetsData) return res.status(404).send(error("资产不存在"));
    const typeConfig: Record<string, { promptKey: string; itemType: ItemType; label: string; nameLabel: string; visualManual: string }> = {
      role: {
        promptKey: "role-polish",
        itemType: "characters",
        label: "角色标准四视图",
        nameLabel: "角色",
        visualManual: assetsData.assetsId ? "art_character_derivative" : "art_character",
      },
      scene: {
        promptKey: "scene-polish",
        itemType: "scenes",
        label: "场景图",
        nameLabel: "场景",
        visualManual: assetsData.assetsId ? "art_scene_derivative" : "art_scene",
      },
      tool: {
        promptKey: "tool-polish",
        itemType: "props",
        label: "道具图",
        nameLabel: "道具",
        visualManual: assetsData.assetsId ? "art_prop_derivative" : "art_prop",
      },
    };

    const config = typeConfig[type];
    if (!config) return res.status(500).send(error("不支持的类型"));
    if (!config.visualManual) return res.status(500).send(error("视觉手册未定义"));
    //获取到视觉手册
    const visualManual = await u.getArtPrompt(project.artStyle as string, "art_skills", config.visualManual);
    if (!visualManual) return res.status(500).send(error("视觉手册未定义"));
    const systemPrompt = visualManual;
    let quote;
    try {
      const billingModel = await resolveModelBillingKey("universalAi");
      quote = await quoteModelCalls(userId, [
        {
          count: 1,
          model: billingModel,
          modelType: "text",
          taskType: "asset_prompt_polish",
        },
      ]);
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "获取积分报价失败"));
    }
    if (!quote.enough) return res.status(400).send(error(`积分不足，需要 ${quote.requiredPoints} 积分，当前可用 ${quote.availablePoints} 积分`));

    let billingHold = null;
    try {
      billingHold = await reserveModelCallPoints({
        billingMeta: quote,
        description: `资产提示词润色：${quote.items[0]?.modelLabel || "universalAi"}`,
        idempotencyKey: `model-call:asset-prompt:${assetsId}:${u.uuid()}`,
        projectId,
        quote,
        relatedId: assetsId,
        taskType: "asset_prompt_polish",
        userId,
      });
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "积分不足"));
    }

    await u.db("o_assets").where("id", assetsId).update({ promptState: "生成中" });

    try {
      const aiResult = await u.Ai.Text("universalAi").invoke({
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `**基础参数：**
      **${config.nameLabel}设定：**
      - ${config.nameLabel}名称:${name},
      - ${config.nameLabel}描述:${describe},`,
          },
        ],
      });
      const { _output } = aiResult as any;

      if (!_output) {
        await releasePointHold(billingHold?.id);
        await u.db("o_assets").where("id", assetsId).update({ promptState: "失败", promptErrorReason: "生成失败" });
        return res.status(500).send(error("生成失败"));
      }
      await u.db("o_assets").where("id", assetsId).update({ prompt: _output, promptState: "已完成" });
      await settlePointHoldWithModelUsage(billingHold?.id, aiResult);

      res.status(200).send(success({ prompt: _output, assetsId }));
    } catch (e: any) {
      await releasePointHold(billingHold?.id);
      await u
        .db("o_assets")
        .where("id", assetsId)
        .update({ promptState: "失败", promptErrorReason: u.error(e).message });
      return res.status(500).send(error(e?.data?.error?.message ?? e?.message ?? "生成失败"));
    }
  },
);
