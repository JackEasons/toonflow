import express from "express";
import { z } from "zod";

import { hashPassword, verifyPassword } from "@/lib/password";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import u from "@/utils";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    confirmPassword: z.string(),
    newPassword: z.string(),
    oldPassword: z.string(),
  }),
  async (req, res) => {
    const tokenUser = (req as any).user;
    if (!tokenUser?.id) return res.status(401).send(error("未提供token"));

    const user = await u.db("o_user").where("id", tokenUser.id).first();
    if (!user) return res.status(401).send(error("用户不存在"));

    const oldPassword = String(req.body.oldPassword || "");
    const newPassword = String(req.body.newPassword || "");
    const confirmPassword = String(req.body.confirmPassword || "");

    if (newPassword.length < 6 || newPassword.length > 20) {
      return res.status(400).send(error("密码长度为 6-20 个字符"));
    }
    if (newPassword !== confirmPassword) return res.status(400).send(error("两次输入的密码不一致"));

    const passwordResult = await verifyPassword(oldPassword, user.password);
    if (!passwordResult.valid) return res.status(400).send(error("旧密码不正确"));

    await u
      .db("o_user")
      .where("id", user.id)
      .update({ password: await hashPassword(newPassword) });

    res.status(200).send(success(null, "密码修改成功"));
  },
);
