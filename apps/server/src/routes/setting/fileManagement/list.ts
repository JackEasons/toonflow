import express from "express";
import { z } from "zod";

import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { listDirectory } from "@/utils/fileManagement";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    path: z.string().optional(),
  }),
  async (req, res) => {
    try {
      const entries = await listDirectory(req.body.path);
      res.status(200).send(success(entries));
    } catch (err: any) {
      res.status(400).send(error(err?.message || "读取目录失败"));
    }
  },
);
