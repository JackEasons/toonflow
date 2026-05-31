import express from "express";
import { z } from "zod";

import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { updateAdminAsset } from "@/utils/adminAssets";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    describe: z.string().optional(),
    id: z.number(),
    name: z.string().optional(),
    prompt: z.string().optional(),
    remark: z.string().optional(),
  }),
  async (req, res) => {
    try {
      return res.status(200).send(success(await updateAdminAsset(req.body), "资产已更新"));
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "更新资产失败"));
    }
  },
);
