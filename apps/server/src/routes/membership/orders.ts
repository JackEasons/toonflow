import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import {
  createMembershipOrder,
  getMembershipOrderForPayment,
  getMembershipOrderStatus,
  getMembershipProfile,
  updateOrderStatus,
} from "@/utils/membership";
import { createPaymentForOrder } from "@/utils/payment";

const router = express.Router();

router.post(
  "/:orderNo/pay",
  validateFields({
    paymentProvider: z.enum(["alipay", "wechat"]).optional(),
  }),
  async (req, res) => {
    const userId = String((req as any).user?.id || "");
    if (!userId) return res.status(401).send(error("未提供token"));

    try {
      const order = await getMembershipOrderForPayment(userId, String(req.params.orderNo || ""));
      if (order.status === "paid") {
        const payload = await getMembershipOrderStatus(userId, order.orderNo);
        return res.status(200).send(success({ ...payload, payment: { provider: "free", type: "none", orderNo: order.orderNo } }, "订单已支付"));
      }
      const payment = await createPaymentForOrder(order, req.body.paymentProvider, req);
      const payload = await getMembershipOrderStatus(userId, order.orderNo);
      return res.status(200).send(success({ ...payload, payment }, "支付已创建"));
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "继续支付失败"));
    }
  },
);

router.get("/:orderNo", async (req, res) => {
  const userId = String((req as any).user?.id || "");
  if (!userId) return res.status(401).send(error("未提供token"));

  try {
    const payload = await getMembershipOrderStatus(userId, String(req.params.orderNo || ""));
    return res.status(200).send(success(payload));
  } catch (err: any) {
    return res.status(404).send(error(err?.message || "订单不存在"));
  }
});

router.post(
  "/",
  validateFields({
    kind: z.enum(["plan", "points"]),
    planKey: z.string().optional(),
    pointsPackageKey: z.string().optional(),
    paymentProvider: z.enum(["alipay", "wechat"]).optional(),
  }),
  async (req, res) => {
    const userId = String((req as any).user?.id || "");
    if (!userId) return res.status(401).send(error("未提供token"));

    try {
      const order =
        req.body.kind === "plan"
          ? await createMembershipOrder(userId, { kind: "plan", planKey: String(req.body.planKey || "") }, req.body.paymentProvider || "pending")
          : await createMembershipOrder(
              userId,
              { kind: "points", pointsPackageKey: String(req.body.pointsPackageKey || "") },
              req.body.paymentProvider || "pending",
            );
      let payment;
      try {
        payment = await createPaymentForOrder(order, req.body.paymentProvider, req);
      } catch (paymentError) {
        await updateOrderStatus({ id: order.id, status: "canceled" }).catch(() => undefined);
        throw paymentError;
      }
      const profile = await getMembershipProfile(userId);
      return res.status(200).send(success({ order, payment, profile }, "订单已创建"));
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "订单创建失败"));
    }
  },
);

export default router;
