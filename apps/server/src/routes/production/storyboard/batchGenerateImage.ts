import express from "express";
import { z } from "zod";

import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { startStoryboardImageGeneration } from "@/services/storyboardImageGeneration";
import u from "@/utils";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    storyboardIds: z.array(z.number()),
    projectId: z.number(),
    scriptId: z.number(),
    concurrentCount: z.number().min(1).optional(),
    compulsory: z.boolean().optional(),
  }),
  async (req, res) => {
    try {
      const {
        storyboardIds,
        projectId,
        scriptId,
        concurrentCount = 5,
        compulsory = false,
      }: {
        storyboardIds: number[];
        projectId: number;
        scriptId: number;
        concurrentCount: number;
        compulsory: boolean;
      } = req.body;
      const userId = String((req as any).user?.id || "");
      const generation = await startStoryboardImageGeneration({
        compulsory,
        concurrentCount,
        projectId,
        scriptId,
        storyboardIds,
        userId,
      });

      res.status(200).send(success(generation.data));
      void generation.background.catch((err) => {
        console.error("[storyboard] batchGenerateImage background error:", u.error(err).message);
      });
    } catch (err: any) {
      res.status(err?.statusCode || 400).send(error(err?.message || "分镜图片生成失败"));
    }
  },
);
