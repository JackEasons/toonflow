import express from "express";
import u from "@/utils";
import { success, error } from "@/lib/responseFormat";
import { setToken } from "@/routes/login/login";
import { isAdminUser, normalizeUserRole } from "@/utils/admin";

const router = express.Router();

export default router.post("/", async (req, res) => {
  const tokenUser = (req as any).user;
  if (!tokenUser?.id) return res.status(401).send(error("未提供token"));

  const user = await u.db("o_user").where("id", tokenUser.id).first();
  if (!user) return res.status(401).send(error("用户不存在"));
  if (!isAdminUser(user)) return res.status(403).send(error("会员账号只能登录 Web 端"));

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

  res.status(200).send(success(accessToken));
});
