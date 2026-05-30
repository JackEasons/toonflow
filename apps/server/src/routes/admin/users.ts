import express from "express";
import { z } from "zod";

import { hashPassword } from "@/lib/password";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import u from "@/utils";
import { isAdminUser, USER_ROLE_ADMIN } from "@/utils/admin";

const router = express.Router();

function toAdminAccount(user: any) {
  return {
    avatar: String(user.avatar || ""),
    id: String(user.id || ""),
    name: String(user.name || ""),
    realName: String(user.realName || user.name || ""),
    role: USER_ROLE_ADMIN,
  };
}

router.get("/", async (_req, res) => {
  const users = await u.db("o_user").select("id", "name", "realName", "avatar", "role").orderBy("id", "asc");
  return res.status(200).send(success(users.filter((user: any) => isAdminUser(user)).map(toAdminAccount)));
});

export default router.post(
  "/",
  validateFields({
    password: z.string(),
    realName: z.string().optional(),
    username: z.string(),
  }),
  async (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const realName = String(req.body.realName || "").trim();

    if (!username) return res.status(400).send(error("请输入用户名"));
    if (username.length < 2 || username.length > 20) return res.status(400).send(error("用户名长度为 2-20 个字符"));
    if (realName.length > 30) return res.status(400).send(error("姓名长度不能超过 30 个字符"));
    if (password.length < 6 || password.length > 20) return res.status(400).send(error("密码长度为 6-20 个字符"));

    const exists = await u.db("o_user").where("name", username).first();
    if (exists) return res.status(400).send(error("用户名已存在"));

    const inserted = await u.db("o_user").insert({
      name: username,
      password: await hashPassword(password),
      realName: realName || username,
      role: USER_ROLE_ADMIN,
    } as any);
    const userId = String(Array.isArray(inserted) ? inserted[0] : inserted);
    const user = await u.db("o_user").where("id", userId).first();

    return res.status(200).send(success(toAdminAccount(user), "管理员账号已创建"));
  },
);
