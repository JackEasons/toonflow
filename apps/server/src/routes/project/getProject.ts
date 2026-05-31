import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
const router = express.Router();

// 获取项目
export default router.post("/", async (req, res) => {
  const userId = String((req as any).user?.id || "");
  if (!userId) return res.status(401).send({ message: "未提供token" });
  const data = await u.db("o_project").where("userId", userId).select("*");
  res.status(200).send(success(data));
});
