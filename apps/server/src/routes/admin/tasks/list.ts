import express from "express";

import { error, success } from "@/lib/responseFormat";
import { getAdminTaskList, parseAdminTaskListParams } from "@/utils/adminTasks";

const router = express.Router();

export default router.get("/", async (req, res) => {
  try {
    return res.status(200).send(success(await getAdminTaskList(parseAdminTaskListParams(req.query as Record<string, unknown>))));
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取任务列表失败"));
  }
});
