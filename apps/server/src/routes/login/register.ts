import express from "express";
import u from "@/utils";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
import { hashPassword } from "@/lib/password";
import { ensureUserMembership } from "@/utils/membership";
import { USER_ROLE_MEMBER } from "@/utils/admin";

const router = express.Router();
const DEFAULT_INVITE_CODE = "DRAMASTUDIO2026";

function getInviteCode(): string {
  return (process.env.DRAMASTUDIO_INVITE_CODE || process.env.INVITE_CODE || DEFAULT_INVITE_CODE).trim();
}

export default router.post(
  "/",
  validateFields({
    username: z.string(),
    password: z.string(),
    confirmPassword: z.string(),
    inviteCode: z.string(),
  }),
  async (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const confirmPassword = String(req.body.confirmPassword || "");
    const inviteCode = String(req.body.inviteCode || "").trim();

    if (!username) return res.status(400).send(error("请输入用户名"));
    if (username.length < 2 || username.length > 20) return res.status(400).send(error("用户名长度为 2-20 个字符"));
    if (password.length < 6) return res.status(400).send(error("密码长度至少 6 位"));
    if (!confirmPassword) return res.status(400).send(error("请再次输入密码"));
    if (confirmPassword !== password) return res.status(400).send(error("两次输入的密码不一致"));
    if (!inviteCode) return res.status(400).send(error("请输入邀请码"));
    if (inviteCode !== getInviteCode()) return res.status(400).send(error("邀请码无效"));

    const exists = await u.db("o_user").where("name", username).first();
    if (exists) return res.status(400).send(error("用户名已存在"));

    const hashedPassword = await hashPassword(password);
    const inserted = await u.db("o_user").insert({
      name: username,
      password: hashedPassword,
      role: USER_ROLE_MEMBER,
    } as any);
    const userId = String(Array.isArray(inserted) ? inserted[0] : inserted);
    await ensureUserMembership(userId);

    return res.status(200).send(
      success(
        {
          id: userId,
          name: username,
        },
        "注册成功",
      ),
    );
  },
);
