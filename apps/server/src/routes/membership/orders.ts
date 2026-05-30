import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { createMembershipOrder, getMembershipProfile } from "@/utils/membership";
import { createPaymentForOrder } from "@/utils/payment";

const router = express.Router();

export default router.post(
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
      const payment = await createPaymentForOrder(order, req.body.paymentProvider, req);
      const profile = await getMembershipProfile(userId);
      return res.status(200).send(success({ order, payment, profile }, "订单已创建"));
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "订单创建失败"));
    }
  },
);
