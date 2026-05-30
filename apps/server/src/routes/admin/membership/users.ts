import express from "express";
import { success, error } from "@/lib/responseFormat";
import { getAdminMembershipUsers } from "@/utils/membership";

const router = express.Router();

export default router.get("/", async (req, res) => {
  try {
    return res.status(200).send(
      success(
        await getAdminMembershipUsers({
          keyword: String(req.query.keyword || ""),
          page: Number(req.query.page || 1),
          pageSize: Number(req.query.pageSize || 20),
        }),
      ),
    );
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取会员用户失败"));
  }
});
