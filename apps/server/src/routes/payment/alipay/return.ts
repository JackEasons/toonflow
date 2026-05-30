import express from "express";

import { handleAlipayReturn } from "@/utils/payment";

const router = express.Router();

export default router.get("/", async (req, res) => {
  try {
    const result = await handleAlipayReturn(req.query || {});
    const paid = ["TRADE_SUCCESS", "TRADE_FINISHED"].includes(String(result.trade_status || ""));
    return res.status(200).type("html").send(`<!doctype html>
<html><head><meta charset="utf-8"><title>支付结果</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px;">
  <h2>${paid ? "支付已确认" : "支付处理中"}</h2>
  <p>${paid ? "订单权益已更新，可以回到 DramaStudio 继续使用。" : "如果已完成付款，请稍后回到订单页刷新。支付最终结果以异步通知为准。"}</p>
</body></html>`);
  } catch (err) {
    console.error("[alipay return failed]", err);
    return res.status(400).type("html").send("<!doctype html><html><body><h2>支付结果校验失败</h2></body></html>");
  }
});
