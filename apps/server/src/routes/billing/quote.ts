import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { quoteModelCalls, resolveModelBillingKey } from "@/utils/modelBilling";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    calls: z.array(
      z.object({
        audio: z.boolean().optional(),
        count: z.number().optional(),
        duration: z.number().optional(),
        model: z.string(),
        modelType: z.string().optional(),
        resolution: z.string().optional(),
        taskType: z.string().optional(),
      }),
    ),
  }),
  async (req, res) => {
    const userId = String((req as any).user?.id || "");
    if (!userId) return res.status(401).send(error("未提供token"));

    try {
      const calls = await Promise.all(req.body.calls.map(async (call: any) => ({ ...call, model: await resolveModelBillingKey(call.model) })));
      return res.status(200).send(success(await quoteModelCalls(userId, calls)));
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "获取积分报价失败"));
    }
  },
);
