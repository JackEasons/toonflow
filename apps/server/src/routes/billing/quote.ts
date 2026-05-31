import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { quoteModelCalls, resolveModelBillingKey } from "@/utils/modelBilling";

const router = express.Router();

const quoteCallSchema = z.object({
  audio: z.boolean().optional(),
  count: z.number().optional(),
  duration: z.number().optional(),
  model: z.string(),
  modelType: z.string().optional(),
  resolution: z.string().optional(),
  taskType: z.string().optional(),
});

const quoteBodySchema = z.union([
  z.object({
    calls: z.array(quoteCallSchema),
  }),
  quoteCallSchema,
]);

export default router.post("/", async (req, res) => {
  const userId = String((req as any).user?.id || "");
  if (!userId) return res.status(401).send(error("未提供token"));

  const parseResult = quoteBodySchema.safeParse(req.body);
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map((issue) => `字段 ${issue.path.join(".")} ${issue.message}`);
    return res.status(400).json({ message: "参数错误", errors });
  }

  try {
    const rawCalls = "calls" in parseResult.data ? parseResult.data.calls : [parseResult.data];
    const calls = await Promise.all(rawCalls.map(async (call) => ({ ...call, model: await resolveModelBillingKey(call.model) })));
    return res.status(200).send(success(await quoteModelCalls(userId, calls)));
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取积分报价失败"));
  }
});
