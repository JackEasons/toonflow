import express from "express";

import { error, success } from "@/lib/responseFormat";
import { getAdminAssetList, parseAdminAssetListParams } from "@/utils/adminAssets";

const router = express.Router();

export default router.get("/", async (req, res) => {
  try {
    return res.status(200).send(success(await getAdminAssetList(parseAdminAssetListParams(req.query as Record<string, unknown>))));
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取资产列表失败"));
  }
});
