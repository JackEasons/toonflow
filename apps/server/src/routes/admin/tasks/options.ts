import express from "express";

import { error, success } from "@/lib/responseFormat";
import { getAdminTaskOptions } from "@/utils/adminTasks";

const router = express.Router();

export default router.get("/", async (_req, res) => {
  try {
    return res.status(200).send(success(await getAdminTaskOptions()));
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取任务筛选项失败"));
  }
});
