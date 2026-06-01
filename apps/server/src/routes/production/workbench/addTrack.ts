import express from "express";
import u from "@/utils";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();
export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number(),
    duration: z.number().optional(),
  }),
  async (req, res) => {
    const { projectId, scriptId, duration } = req.body;
    const data = await u.db("o_project").where("id", projectId).first();
    const video = data?.videoModel?.split(/:(.+)/);
    const modelList = await u.vendor.getEnabledModelList(video?.[0]!);
    const model = modelList.find((item: any) => item.modelName === video?.[1]);
    if (!model) return res.status(400).send(error("项目视频模型不存在或未启用"));
    const trackId = Date.now()
    await u.db("o_videoTrack").insert({
      id: trackId,
      projectId,
      scriptId,
      duration,
    });
    res.status(200).send(success(trackId));
  },
);
