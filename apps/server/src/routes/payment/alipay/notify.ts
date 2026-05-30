import express from "express";

import { handleAlipayNotify } from "@/utils/payment";

const router = express.Router();

export default router.post("/", async (req, res) => {
  try {
    await handleAlipayNotify(req.body || {});
    return res.status(200).type("text/plain").send("success");
  } catch (err) {
    console.error("[alipay notify failed]", err);
    return res.status(200).type("text/plain").send("failure");
  }
});
