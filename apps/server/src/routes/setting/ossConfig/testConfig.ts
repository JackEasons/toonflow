import express from "express";

import { error, success } from "@/lib/responseFormat";
import u from "@/utils";

const router = express.Router();

export default router.post("/", async (req, res) => {
  try {
    res.status(200).send(success(await u.oss.testAdminConfig(req.body), "OSS 连接测试成功"));
  } catch (err: any) {
    res.status(400).send(error(err?.message || "OSS 连接测试失败"));
  }
});
