import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { updateOrderStatus } from "@/utils/membership";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    id: z.string(),
    status: z.enum(["pending", "paid", "canceled", "refunded"]),
  }),
  async (req, res) => {
    try {
      await updateOrderStatus({
        id: String(req.body.id),
        status: req.body.status,
        operatorId: String((req as any).user?.id || ""),
      });
      return res.status(200).send(success(null, "订单已更新"));
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "订单更新失败"));
    }
  },
);
