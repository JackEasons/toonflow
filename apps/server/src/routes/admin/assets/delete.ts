import express from "express";
import { z } from "zod";

import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { deleteAdminAssets } from "@/utils/adminAssets";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    id: z.number(),
  }),
  async (req, res) => {
    try {
      return res.status(200).send(success(await deleteAdminAssets([Number(req.body.id)]), "资产已删除"));
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "删除资产失败"));
    }
  },
);
