import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { saveMembershipPlan } from "@/utils/membership";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    key: z.string(),
    name: z.string(),
    levelKey: z.string(),
    levelName: z.string(),
    billingPeriod: z.string(),
    priceCny: z.number().optional(),
    originalPriceCny: z.number().optional().nullable(),
    yearlyDiscountLabel: z.string().optional().nullable(),
    points: z.number().optional(),
    pointValidityDays: z.number().optional(),
    maxShots: z.number().optional().nullable(),
    maxSeries: z.number().optional().nullable(),
    features: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
    popular: z.boolean().optional(),
    sortOrder: z.number().optional(),
  }),
  async (req, res) => {
    try {
      return res.status(200).send(success(await saveMembershipPlan(req.body), "会员套餐已保存"));
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "保存会员套餐失败"));
    }
  },
);
