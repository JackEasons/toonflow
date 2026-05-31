import express from "express";
import u from "@/utils";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { type ModelBillingQuote, quoteModelCalls, resolveModelBillingKey } from "@/utils/modelBilling";

const router = express.Router();

// 清洗小说原文，生成事件列表
export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    novelIds: z.array(z.number()).optional(),
    concurrentCount: z.number().min(1).optional(),
  }),
  async (req, res) => {
    const { projectId, novelIds, concurrentCount = 5 } = req.body;
    const userId = String((req as any).user?.id || "");
    if (!userId) return res.status(401).send(error("未提供token"));

    const query = u.db("o_novel").where("projectId", projectId);
    if (Array.isArray(novelIds) && novelIds.length) query.whereIn("id", novelIds);
    const allChapters = await query;
    if (allChapters.length === 0) {
      return res.status(400).send(success("没有对应章节"));
    }

    let quote: ModelBillingQuote;
    try {
      const billingModel = await resolveModelBillingKey("universalAi");
      quote = await quoteModelCalls(userId, [
        {
          count: allChapters.length,
          model: billingModel,
          modelType: "text",
          taskType: "novel_event_extraction",
        },
      ]);
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "获取积分报价失败"));
    }
    if (!quote.enough) return res.status(400).send(error(`积分不足，需要 ${quote.requiredPoints} 积分，当前可用 ${quote.availablePoints} 积分`));

    const novel = new u.cleanNovel(concurrentCount, {
      attemptId: u.uuid(),
      quote,
      taskType: "novel_event_extraction",
      userId,
    });

    const ids = allChapters.map((item: any) => item.id);
    await u.db("o_novel").where("projectId", projectId).whereIn("id", ids).update({ eventState: 0, event: null });
    novel.emitter.on("item", async (item) => {
      await u
        .db("o_novel")
        .where("id", item.id)
        .update({ event: item.event, eventState: item.event ? 1 : -1, errorReason: item?.errorReason ?? null });
    });
    novel.start(allChapters, projectId);

    return res.status(200).send(success("生成事件成功"));
  },
);
