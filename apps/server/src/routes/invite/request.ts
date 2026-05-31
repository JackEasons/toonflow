import express from "express";
import { z } from "zod";

import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { requestInviteCode } from "@/utils/invite";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    reason: z.string().max(500).optional(),
  }),
  async (req, res) => {
    const userId = String((req as any).user?.id || "");
    if (!userId) return res.status(401).send(error("未提供token"));

    try {
      const invite = await requestInviteCode(userId, String(req.body.reason || "").trim());
      return res.status(200).send(success(invite, "申请已提交"));
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "申请邀请码失败"));
    }
  },
);
