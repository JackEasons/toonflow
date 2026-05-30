import express from "express";
import u from "@/utils";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { verifyPassword, hashPassword } from "@/lib/password";
import { setToken } from "@/routes/login/login";
import { isAdminUser, normalizeUserRole } from "@/utils/admin";
import { z } from "zod";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    username: z.string(),
    password: z.string(),
  }),
  async (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    const user = await u.db("o_user").where("name", "=", username).first();
    if (!user) return res.status(400).send(error("登录失败"));
    if (!isAdminUser(user)) return res.status(403).send(error("会员账号只能登录 Web 端"));

    const passwordResult = await verifyPassword(password, user.password);
    if (!passwordResult.valid) return res.status(400).send(error("用户名或密码错误"));

    if (passwordResult.needsRehash) {
      await u
        .db("o_user")
        .where("id", user.id)
        .update({ password: await hashPassword(password) });
    }

    const tokenData = await u.db("o_setting").where("key", "tokenKey").first();
    if (!tokenData) return res.status(400).send(error("未找到tokenKey"));

    const accessToken = setToken(
      {
        id: user.id,
        name: user.name,
        role: normalizeUserRole(user),
      },
      "180Days",
      tokenData.value as string,
    );

    return res.status(200).send(
      success(
        {
          accessToken,
          id: user.id,
          name: user.name,
          token: `Bearer ${accessToken}`,
        },
        "登录成功",
      ),
    );
  },
);
