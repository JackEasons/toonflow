import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { savePointsPackage } from "@/utils/membership";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    key: z.string(),
    points: z.number().optional(),
    priceCny: z.number().optional(),
    description: z.string().optional(),
    validityDays: z.number().optional(),
    enabled: z.boolean().optional(),
    sortOrder: z.number().optional(),
  }),
  async (req, res) => {
    try {
      return res.status(200).send(success(await savePointsPackage(req.body), "积分包已保存"));
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "保存积分包失败"));
    }
  },
);
