import express from "express";

import { success, error } from "@/lib/responseFormat";
import { getPaymentConfig, getEnabledPaymentOptions, maskPaymentConfig } from "@/utils/payment";

const router = express.Router();

export default router.get("/", async (_req, res) => {
  try {
    const config = await getPaymentConfig();
    return res.status(200).send(
      success({
        config: maskPaymentConfig(config),
        options: getEnabledPaymentOptions(config),
      }),
    );
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取支付配置失败"));
  }
});
