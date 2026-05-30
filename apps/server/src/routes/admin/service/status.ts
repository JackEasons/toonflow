import express from "express";

import { error, success } from "@/lib/responseFormat";
import { getServiceStatus } from "@/utils/serviceStatus";

const router = express.Router();

export default router.get("/", async (_req, res) => {
  try {
    return res.status(200).send(success(await getServiceStatus("admin")));
  } catch (err: any) {
    return res.status(500).send(error(err?.message || "获取服务运行状态失败"));
  }
});
