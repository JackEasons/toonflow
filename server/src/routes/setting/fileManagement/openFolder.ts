import express from "express";
import { z } from "zod";
import { error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    path: z.string(),
  }),
  async (req, res) => {
    return res.status(400).send(error("后端服务模式不支持打开本地文件夹"));
  },
);
