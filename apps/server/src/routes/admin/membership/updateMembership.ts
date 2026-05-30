import express from "express";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { updateUserMembership, getAdminMembershipUsers } from "@/utils/membership";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    userId: z.string(),
    levelKey: z.string(),
    levelName: z.string(),
    status: z.string(),
    planKey: z.string().optional(),
    autoRenew: z.boolean().optional(),
    expiresAt: z.string().optional().nullable(),
  }),
  async (req, res) => {
    try {
      await updateUserMembership({
        userId: String(req.body.userId),
        levelKey: String(req.body.levelKey),
        levelName: String(req.body.levelName),
        status: String(req.body.status),
        planKey: req.body.planKey ? String(req.body.planKey) : null,
        autoRenew: Boolean(req.body.autoRenew),
        expiresAt: req.body.expiresAt ? String(req.body.expiresAt) : null,
        operatorId: String((req as any).user?.id || ""),
      });
      return res.status(200).send(success(await getAdminMembershipUsers({ page: 1, pageSize: 20 }), "会员已更新"));
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "会员更新失败"));
    }
  },
);
