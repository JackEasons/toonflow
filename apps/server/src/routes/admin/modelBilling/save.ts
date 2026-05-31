import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { saveModelBillingRules } from "@/utils/modelBilling";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    rules: z.array(
      z.object({
        enabled: z.boolean().optional(),
        modelLabel: z.string().optional(),
        modelName: z.string(),
        modelType: z.string().optional(),
        pointsPerCall: z.number().optional(),
        pricingMeta: z.unknown().optional(),
        vendorId: z.string(),
      }),
    ),
  }),
  async (req, res) => {
    try {
      return res.status(200).send(success(await saveModelBillingRules(req.body.rules), "模型计费规则已保存"));
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "保存模型计费规则失败"));
    }
  },
);

