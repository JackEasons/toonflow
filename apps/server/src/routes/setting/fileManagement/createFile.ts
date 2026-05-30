import express from "express";
import { z } from "zod";

import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { createFile } from "@/utils/fileManagement";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    content: z.string().optional(),
    currentPath: z.string().optional(),
    name: z.string(),
  }),
  async (req, res) => {
    try {
      const entry = await createFile(req.body.currentPath, req.body.name, req.body.content);
      res.status(200).send(success(entry));
    } catch (err: any) {
      res.status(400).send(error(err?.message || "创建文件失败"));
    }
  },
);
