import express from "express";
import { error, success } from "@/lib/responseFormat";
import { isAdminRequest } from "@/utils/admin";

const router = express.Router();

export default router.get("/", async (req, res) => {
  if (!isAdminRequest(req)) return res.status(403).send(error("会员账号只能登录 Web 端"));
  res.status(200).send(success(["admin", "super", "*"]));
});
