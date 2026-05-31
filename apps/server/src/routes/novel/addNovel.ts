import express from "express";
import u from "@/utils";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { type ModelBillingQuote, quoteModelCalls, resolveModelBillingKey } from "@/utils/modelBilling";
const router = express.Router();

// 新增原文数据
export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    data: z.array(
      z.object({
        index: z.number(),
        reel: z.string(),
        chapter: z.string(),
        chapterData: z.string(),
      }),
    ),
  }),
  async (req, res) => {
    const { projectId, data } = req.body;
    const userId = String((req as any).user?.id || "");
    if (!userId) return res.status(401).send(error("未提供token"));

    let quote: ModelBillingQuote;
    try {
      const billingModel = await resolveModelBillingKey("universalAi");
      quote = await quoteModelCalls(userId, [
        {
          count: data.length,
          model: billingModel,
          modelType: "text",
          taskType: "novel_event_extraction",
        },
      ]);
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "获取积分报价失败"));
    }
    if (!quote.enough) return res.status(400).send(error(`积分不足，需要 ${quote.requiredPoints} 积分，当前可用 ${quote.availablePoints} 积分`));

    const totalNovelId = [];
    const getLastChapterIndex = await u.db("o_novel").where("projectId", projectId).select("chapterIndex").orderBy("chapterIndex", "desc").first();
    let lastChapterIndex = 0;
    if (getLastChapterIndex) {
      lastChapterIndex = getLastChapterIndex.chapterIndex!;
    }
    for (const item of data) {
      const [id] = await u.db("o_novel").insert({
        projectId,
        chapterIndex: ++lastChapterIndex,
        reel: item.reel,
        chapter: item.chapter,
        chapterData: item.chapterData,
        createTime: Date.now(),
        eventState: 0,
      });
      totalNovelId.push(id);
    }
    const chapterAllList = await u.db("o_novel").where("projectId", projectId).whereIn("id", totalNovelId);
    const novelClass = new u.cleanNovel(5, {
      attemptId: u.uuid(),
      quote,
      taskType: "novel_event_extraction",
      userId,
    });
    novelClass.emitter.on("item", async (item) => {
      await u
        .db("o_novel")
        .where("id", item.id)
        .update({ event: item.event, eventState: item.event ? 1 : -1, errorReason: item?.errReason ?? null });
    });
    novelClass.start(chapterAllList, projectId);

    res.status(200).send(success({ message: "新增原文成功" }));
  },
);
