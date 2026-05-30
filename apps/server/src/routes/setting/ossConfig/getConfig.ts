import express from "express";

import { error, success } from "@/lib/responseFormat";
import u from "@/utils";

const router = express.Router();

export default router.get("/", async (_req, res) => {
  try {
    res.status(200).send(success(await u.oss.getAdminConfig()));
  } catch (err: any) {
    res.status(500).send(error(err?.message || "获取 OSS 配置失败"));
  }
});
