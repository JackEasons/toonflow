import express from "express";
import { z } from "zod";

import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { listAdminInvites, listInviteRegistrationsForAdmin, updateInviteByAdmin } from "@/utils/invite";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    return res.status(200).send(
      success(
        await listAdminInvites({
          keyword: String(req.query.keyword || ""),
          page: Number(req.query.page || 1),
          pageSize: Number(req.query.pageSize || 20),
          status: String(req.query.status || ""),
        }),
      ),
    );
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取邀请码列表失败"));
  }
});

router.get("/:id/registrations", async (req, res) => {
  try {
    return res.status(200).send(success(await listInviteRegistrationsForAdmin(String(req.params.id || ""))));
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取邀请注册账号失败"));
  }
});

router.post(
  "/:id",
  validateFields({
    action: z.enum(["approve", "disable", "enable", "reject", "updateLimits"]),
    dailyLimit: z.number().min(1).max(20).optional(),
    ipDailyLimit: z.number().min(1).max(5).optional(),
    maxUses: z.number().min(1).max(100).optional(),
    reviewNote: z.string().max(500).optional(),
  }),
  async (req, res) => {
    const adminId = String((req as any).user?.id || "");
    if (!adminId) return res.status(401).send(error("未提供token"));

    try {
      return res.status(200).send(
        success(
          await updateInviteByAdmin({
            action: req.body.action,
            adminId,
            dailyLimit: req.body.dailyLimit,
            id: String(req.params.id || ""),
            ipDailyLimit: req.body.ipDailyLimit,
            maxUses: req.body.maxUses,
            reviewNote: String(req.body.reviewNote || ""),
          }),
          "邀请码已更新",
        ),
      );
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "更新邀请码失败"));
    }
  },
);

export default router;
