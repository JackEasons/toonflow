import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { adjustUserPoints, getAdminMembershipUsers } from "@/utils/membership";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    userId: z.string(),
    amount: z.number(),
    bucket: z.enum(["bonus", "membership", "recharge"]).optional(),
    description: z.string().optional(),
  }),
  async (req, res) => {
    try {
      await adjustUserPoints({
        userId: String(req.body.userId),
        amount: Number(req.body.amount),
        bucket: req.body.bucket,
        description: req.body.description,
        operatorId: String((req as any).user?.id || ""),
      });
      return res.status(200).send(success(await getAdminMembershipUsers({ page: 1, pageSize: 20 }), "积分已调整"));
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "积分调整失败"));
    }
  },
);
