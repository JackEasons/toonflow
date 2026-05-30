import express from "express";
import { z } from "zod";

import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import u from "@/utils";
import { buildUserInfo } from "@/utils/userProfile";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    avatar: z.string().optional(),
    introduction: z.string().optional(),
    realName: z.string().optional(),
    username: z.string(),
  }),
  async (req, res) => {
    const tokenUser = (req as any).user;
    if (!tokenUser?.id) return res.status(401).send(error("未提供token"));

    const user = await u.db("o_user").where("id", tokenUser.id).first();
    if (!user) return res.status(401).send(error("用户不存在"));

    const username = String(req.body.username || "").trim();
    const realName = String(req.body.realName || "").trim();
    const avatar = typeof req.body.avatar === "string" ? String(req.body.avatar).trim() : String(user.avatar || "");
    const introduction = String(req.body.introduction || "").trim();

    if (!username) return res.status(400).send(error("请输入用户名"));
    if (username.length < 2 || username.length > 20) return res.status(400).send(error("用户名长度为 2-20 个字符"));
    if (realName.length > 30) return res.status(400).send(error("姓名长度不能超过 30 个字符"));
    if (introduction.length > 300) return res.status(400).send(error("个人简介不能超过 300 个字符"));

    const existingUser = await u.db("o_user").where("name", username).whereNot("id", user.id).first();
    if (existingUser) return res.status(400).send(error("用户名已存在"));

    await u
      .db("o_user")
      .where("id", user.id)
      .update({
        avatar,
        introduction,
        name: username,
        realName: realName || username,
      });

    const nextUser = await u.db("o_user").where("id", user.id).first();
    res.status(200).send(success(buildUserInfo(nextUser), "个人信息已更新"));
  },
);
