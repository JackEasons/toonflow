import express from "express";

import { handleWechatNotify } from "@/utils/payment";

const router = express.Router();

export default router.post("/", async (req, res) => {
  try {
    await handleWechatNotify((req as any).rawBody || JSON.stringify(req.body || {}), req.headers as Record<string, unknown>);
    return res.status(200).send({ code: "SUCCESS", message: "成功" });
  } catch (err) {
    console.error("[wechat notify failed]", err);
    return res.status(200).send({ code: "FAIL", message: "失败" });
  }
});
