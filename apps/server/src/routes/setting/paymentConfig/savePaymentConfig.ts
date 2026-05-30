import express from "express";

import { success, error } from "@/lib/responseFormat";
import { getEnabledPaymentOptions, maskPaymentConfig, savePaymentConfig } from "@/utils/payment";

const router = express.Router();

export default router.post("/", async (req, res) => {
  try {
    const config = await savePaymentConfig(req.body || {});
    return res.status(200).send(
      success(
        {
          config: maskPaymentConfig(config),
          options: getEnabledPaymentOptions(config),
        },
        "支付配置已保存",
      ),
    );
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "保存支付配置失败"));
  }
});
