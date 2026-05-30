import express from "express";
import { success, error } from "@/lib/responseFormat";
import { getAdminMembershipOrders } from "@/utils/membership";

const router = express.Router();

export default router.get("/", async (req, res) => {
  try {
    return res.status(200).send(
      success(
        await getAdminMembershipOrders({
          userId: req.query.userId ? String(req.query.userId) : undefined,
          status: req.query.status ? String(req.query.status) : undefined,
          page: Number(req.query.page || 1),
          pageSize: Number(req.query.pageSize || 20),
        }),
      ),
    );
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取订单失败"));
  }
});
