import express from "express";
import path from "node:path";
import { z } from "zod";

import { error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { assertFileReadable } from "@/utils/fileManagement";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    path: z.string(),
  }),
  async (req, res) => {
    try {
      const result = await assertFileReadable(req.body.path);
      const relPath = result.relPath;
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(path.basename(relPath))}"`);
      if ("buffer" in result) {
        res.status(200).send(result.buffer);
        return;
      }
      res.sendFile(result.absPath);
    } catch (err: any) {
      res.status(400).send(error(err?.message || "下载文件失败"));
    }
  },
);
