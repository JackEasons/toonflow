import express from "express";
import { z } from "zod";

import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { getFileEntry, readTextFile } from "@/utils/fileManagement";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    path: z.string(),
  }),
  async (req, res) => {
    try {
      const content = await readTextFile(req.body.path);
      const entry = await getFileEntry(req.body.path);
      res.status(200).send(success({ content, entry }));
    } catch (err: any) {
      res.status(400).send(error(err?.message || "读取文件失败"));
    }
  },
);
