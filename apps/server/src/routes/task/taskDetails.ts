import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    taskId: z.number(),
  }),
  async (req, res) => {
    const { taskId } = req.body;
    const userId = String((req as any).user?.id || "");
    if (!userId) return res.status(401).send({ message: "未提供token" });
    const data = await u
      .db("o_tasks")
      .leftJoin("o_project", "o_project.id", "o_tasks.projectId")
      .where("o_tasks.id", taskId)
      .where("o_project.userId", userId)
      .select("o_tasks.*")
      .first();
    res.status(200).send(success(data));
  }
);
