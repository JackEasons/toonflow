import express from "express";
import { z } from "zod";

import { hashPassword } from "@/lib/password";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import u from "@/utils";
import { isAdminUser, USER_ROLE_ADMIN } from "@/utils/admin";

const router = express.Router();
const PROTECTED_ADMIN_USERNAME = "admin";

function currentUserId(req: express.Request) {
  return String((req as any).user?.id || "");
}

function isProtectedAdminUsername(username: string) {
  return username.trim().toLowerCase() === PROTECTED_ADMIN_USERNAME;
}

function isProtectedAdminUser(user: any) {
  return isProtectedAdminUsername(String(user?.name || ""));
}

function toAdminAccount(user: any, currentId = "") {
  return {
    avatar: String(user.avatar || ""),
    id: String(user.id || ""),
    isCurrent: currentId ? String(user.id) === currentId : false,
    name: String(user.name || ""),
    realName: String(user.realName || user.name || ""),
    role: USER_ROLE_ADMIN,
  };
}

router.get("/", async (req, res) => {
  const users = await u.db("o_user").select("id", "name", "realName", "avatar", "role").orderBy("id", "asc");
  const currentId = currentUserId(req);
  return res
    .status(200)
    .send(success(users.filter((user: any) => isAdminUser(user) && !isProtectedAdminUser(user)).map((user: any) => toAdminAccount(user, currentId))));
});

router.post(
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
    if (isProtectedAdminUsername(username)) return res.status(400).send(error("admin 为内置保护账号，不能创建同名管理员"));
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

router.put(
  "/:id",
  validateFields({
    password: z.string().optional(),
    realName: z.string().optional(),
    username: z.string(),
  }),
  async (req, res) => {
    const id = String(req.params.id || "").trim();
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const realName = String(req.body.realName || "").trim();

    if (!id) return res.status(400).send(error("管理员 ID 不能为空"));
    if (!username) return res.status(400).send(error("请输入用户名"));
    if (username.length < 2 || username.length > 20) return res.status(400).send(error("用户名长度为 2-20 个字符"));
    if (isProtectedAdminUsername(username)) return res.status(400).send(error("admin 为内置保护账号，不能用于普通管理员"));
    if (realName.length > 30) return res.status(400).send(error("姓名长度不能超过 30 个字符"));
    if (password && (password.length < 6 || password.length > 20)) return res.status(400).send(error("密码长度为 6-20 个字符"));

    const user = await u.db("o_user").where("id", id).first();
    if (!user || !isAdminUser(user)) return res.status(404).send(error("管理员账号不存在"));
    if (isProtectedAdminUser(user)) return res.status(403).send(error("admin 为内置保护账号，不能编辑"));

    const exists = await u.db("o_user").where("name", username).whereNot("id", id).first();
    if (exists) return res.status(400).send(error("用户名已存在"));

    const payload: Record<string, any> = {
      name: username,
      realName: realName || username,
      role: USER_ROLE_ADMIN,
    };
    if (password) payload.password = await hashPassword(password);

    await u.db("o_user").where("id", id).update(payload);
    const nextUser = await u.db("o_user").where("id", id).first();

    return res.status(200).send(success(toAdminAccount(nextUser, currentUserId(req)), "管理员账号已更新"));
  },
);

router.delete("/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).send(error("管理员 ID 不能为空"));
  if (id === currentUserId(req)) return res.status(400).send(error("不能删除当前登录账号"));

  const user = await u.db("o_user").where("id", id).first();
  if (!user || !isAdminUser(user)) return res.status(404).send(error("管理员账号不存在"));
  if (isProtectedAdminUser(user)) return res.status(403).send(error("admin 为内置保护账号，不能删除"));

  const admins = await u.db("o_user").select("id", "role", "name");
  const adminCount = admins.filter((item: any) => isAdminUser(item)).length;
  if (adminCount <= 1) return res.status(400).send(error("至少保留一个管理员账号"));

  await u.db("o_user").where("id", id).del();
  return res.status(200).send(success(null, "管理员账号已删除"));
});

export default router;
