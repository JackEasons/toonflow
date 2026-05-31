import express from "express";

import { error, success } from "@/lib/responseFormat";
import { getAdminAssetOptions } from "@/utils/adminAssets";

const router = express.Router();

export default router.get("/", async (_req, res) => {
  try {
    return res.status(200).send(success(await getAdminAssetOptions()));
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取资产筛选项失败"));
  }
});
