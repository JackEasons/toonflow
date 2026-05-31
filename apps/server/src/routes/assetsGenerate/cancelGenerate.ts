import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { releasePointHoldsByRelatedId } from "@/utils/modelBilling";
const router = express.Router();

// 取消生成
export default router.post(
  "/",
  validateFields({
    id: z.number(),
  }),
  async (req, res) => {
    const { id } = req.body;
    const userId = String((req as any).user?.id || "");
    await u.db("o_image").where("id", id).update({
      errorReason: "用户取消生成",
      state: "生成失败",
    });
    await releasePointHoldsByRelatedId({
      relatedId: id,
      taskTypes: ["asset_center_image_generation", "asset_image_generation"],
      userId,
    });
    res.status(200).send(success({ message: "取消成功" }));
  },
);
