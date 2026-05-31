import express from "express";

import { error, success } from "@/lib/responseFormat";
import { generateMyInviteCode } from "@/utils/invite";

const router = express.Router();

export default router.post("/", async (req, res) => {
  const userId = String((req as any).user?.id || "");
  if (!userId) return res.status(401).send(error("未提供token"));

  try {
    return res.status(200).send(success(await generateMyInviteCode(userId), "邀请码已生成"));
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "生成邀请码失败"));
  }
});
