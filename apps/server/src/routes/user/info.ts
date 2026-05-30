import express from "express";
import u from "@/utils";
import { success, error } from "@/lib/responseFormat";

const router = express.Router();

export default router.get("/", async (req, res) => {
  const tokenUser = (req as any).user;
  if (!tokenUser?.id) return res.status(401).send(error("未提供token"));

  const user = await u.db("o_user").where("id", tokenUser.id).first();
  if (!user) return res.status(401).send(error("用户不存在"));

  res.status(200).send(
    success({
      avatar: "",
      homePath: "/analytics",
      realName: user.name,
      roles: ["admin"],
      userId: String(user.id),
      username: user.name,
    }),
  );
});
