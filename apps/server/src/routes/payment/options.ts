import express from "express";

import { success, error } from "@/lib/responseFormat";
import { getEnabledPaymentOptions, getPaymentConfig } from "@/utils/payment";

const router = express.Router();

export default router.get("/", async (_req, res) => {
  try {
    return res.status(200).send(success(getEnabledPaymentOptions(await getPaymentConfig())));
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取支付方式失败"));
  }
});
