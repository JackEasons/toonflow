import express from "express";
import { z } from "zod";

import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { uploadFile } from "@/utils/fileManagement";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    contentBase64: z.string(),
    currentPath: z.string().optional(),
    filename: z.string(),
  }),
  async (req, res) => {
    try {
      const entry = await uploadFile(req.body.currentPath, req.body.filename, req.body.contentBase64);
      res.status(200).send(success(entry));
    } catch (err: any) {
      res.status(400).send(error(err?.message || "上传文件失败"));
    }
  },
);
