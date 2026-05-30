import express from "express";

import { error, success } from "@/lib/responseFormat";
import u from "@/utils";

const router = express.Router();

export default router.post("/", async (req, res) => {
  try {
    res.status(200).send(success(await u.oss.saveAdminConfig(req.body), "OSS 配置已保存"));
  } catch (err: any) {
    res.status(400).send(error(err?.message || "保存 OSS 配置失败"));
  }
});
