import express from "express";

import { error, success } from "@/lib/responseFormat";
import { getMyInviteProfile } from "@/utils/invite";

const router = express.Router();

export default router.get("/", async (req, res) => {
  const userId = String((req as any).user?.id || "");
  if (!userId) return res.status(401).send(error("未提供token"));

  try {
    return res.status(200).send(success(await getMyInviteProfile(userId)));
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取邀请码信息失败"));
  }
});
