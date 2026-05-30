import express from "express";
import { error, success } from "@/lib/responseFormat";
import { getAdminAnalyticsOverview } from "@/utils/analytics";

const router = express.Router();

export default router.get("/", async (req, res) => {
  try {
    return res.status(200).send(
      success(
        await getAdminAnalyticsOverview({
          days: Number(req.query.days || 30),
        }),
      ),
    );
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取分析数据失败"));
  }
});
