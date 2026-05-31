import express from "express";

import { error, success } from "@/lib/responseFormat";
import { getAdminTaskDetail } from "@/utils/adminTasks";

const router = express.Router();

export default router.get("/", async (req, res) => {
  const taskId = Number(req.query.id);
  if (!Number.isFinite(taskId) || taskId <= 0) {
    return res.status(400).send(error("任务 ID 不能为空"));
  }

  try {
    const task = await getAdminTaskDetail(taskId);
    if (!task) return res.status(404).send(error("任务不存在"));
    return res.status(200).send(success(task));
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取任务详情失败"));
  }
});
