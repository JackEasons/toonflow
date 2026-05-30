import express from "express";
import { success, error } from "@/lib/responseFormat";
import { getAdminMembershipOverview } from "@/utils/membership";

const router = express.Router();

export default router.get("/", async (_req, res) => {
  try {
    return res.status(200).send(success(await getAdminMembershipOverview()));
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取会员概览失败"));
  }
});
