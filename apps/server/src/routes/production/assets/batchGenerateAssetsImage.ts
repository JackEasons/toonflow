import express from "express";
import { z } from "zod";

import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { startAssetImageGeneration } from "@/services/assetImageGeneration";
import u from "@/utils";

const router = express.Router();

export default router.post(
  "/",
  validateFields({
    assetIds: z.array(z.number()),
    projectId: z.number(),
    scriptId: z.number(),
    concurrentCount: z.number().min(1).optional(),
  }),
  async (req, res) => {
    try {
      const { assetIds, projectId, scriptId, concurrentCount = 5 } = req.body;
      const userId = String((req as any).user?.id || "");
      const generation = await startAssetImageGeneration({
        assetIds,
        concurrentCount,
        projectId,
        scriptId,
        userId,
      });

      res.status(200).send(success(generation.data));
      void generation.background.catch((err) => {
        console.error("[assets] batchGenerateAssetsImage background error:", u.error(err).message);
      });
    } catch (err: any) {
      res.status(err?.statusCode || 400).send(error(err?.message || "资产图片生成失败"));
    }
  },
);
