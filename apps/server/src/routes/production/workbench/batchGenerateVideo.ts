import express from "express";
import u from "@/utils";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { ReferenceList } from "@/utils/ai";
import { resolveNegativePrompt } from "@/utils/negativePrompt";
import { quoteModelCalls, releasePointHold, reserveModelCallPoints, settlePointHold } from "@/utils/modelBilling";
import { appendVideoConsistencyGuard, buildVideoPromptSources, buildVideoReferenceSources, loadVideoPromptContext } from "@/utils/videoPromptContext";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number(),
    trackData: z.array(
      z.object({
        uploadData: z.array(
          z.object({
            id: z.number(),
            sources: z.string(),
          }),
        ),
        trackId: z.number(),
        prompt: z.string(),
        duration: z.number(),
      }),
    ),
    model: z.string(),
    mode: z.string(),
    resolution: z.string(),
    audio: z.boolean().optional(),
  }),
  async (req, res) => {
    const { scriptId, projectId, trackData, model, resolution, audio, mode } = req.body;
    const userId = String((req as any).user?.id || "");
    if (!userId) return res.status(401).send(error("未提供token"));

    let quote;
    try {
      quote = await quoteModelCalls(userId, [
        {
          audio,
          count: trackData.length,
          model,
          modelType: "video",
          resolution,
          taskType: "video_generation",
        },
      ]);
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "获取积分报价失败"));
    }
    if (!quote.enough) return res.status(400).send(error(`积分不足，需要 ${quote.requiredPoints} 积分，当前可用 ${quote.availablePoints} 积分`));

    let modeData = [];
    if (Array.isArray(mode)) {
    } else if (typeof mode === "string" && mode.startsWith('["') && mode.endsWith('"]')) {
      try {
        modeData = JSON.parse(mode);
      } catch (e) {}
    }

    // 获取生成视频比例
    const project = await u.db("o_project").select("videoRatio", "artStyle").where("id", projectId).first();
    const negativePromptSource = u.getArtPrompt(project?.artStyle ?? "", "art_skills", "director_storyboard");

    // 为每个 track 预处理数据并插入数据库，返回任务列表
    const tasks = [];
    const reservedHolds: Array<null | { id: string }> = [];
    try {
      for (const track of trackData as { uploadData: { id: number; sources: string }[]; trackId: number; prompt: string; duration: number }[]) {
        const { uploadData, trackId, prompt, duration } = track;

        const promptSources = await buildVideoPromptSources(uploadData, { mode, trackId });
        const referenceSources = await buildVideoReferenceSources(uploadData, { mode, trackId });

        // 查询出图片数据
        const images = await Promise.all(
          referenceSources.map(async (item) => {
            if (item.sources === "storyboard") {
              const filePath = await u.db("o_storyboard").where("id", item.id).select("filePath").first();
              return { path: filePath?.filePath, sources: "storyBoard" };
            }
            if (item.sources === "assets") {
              const filePath = await u
                .db("o_assets")
                .where("o_assets.id", item.id)
                .leftJoin("o_image", "o_assets.imageId", "o_image.id")
                .select("o_image.filePath", "o_image.type")
                .first();
              return { path: filePath?.filePath, sources: filePath.type };
            }
          }),
        );

        const videoPath = `/${projectId}/video/${uuidv4()}.mp4`;
        const storageProvider = u.oss.getStorageProvider();
        const promptContext = await loadVideoPromptContext(promptSources);
        const requestPrompt = appendVideoConsistencyGuard(prompt, promptContext);
        const negativePrompt = resolveNegativePrompt({ prompt: requestPrompt, negativePromptSource }, { mediaType: "video", modelKey: model });
        const [videoId] = await u.db("o_video").insert({
          filePath: videoPath,
          storageProvider,
          time: Date.now(),
          state: "生成中",
          prompt: requestPrompt,
          negativePrompt,
          scriptId,
          projectId,
          videoTrackId: trackId,
        });
        await u.db("o_videoTrack").where("id", trackId).update({ negativePrompt });

        const pointsPerCall = quote.items[0]?.pointsPerCall || 0;
        const itemQuote = {
          ...quote,
          enough: true,
          items: quote.items[0] ? [{ ...quote.items[0], count: 1, requiredPoints: pointsPerCall }] : [],
          requiredPoints: pointsPerCall,
        };
        const billingHold = await reserveModelCallPoints({
          billingMeta: itemQuote,
          description: `批量视频生成：${quote.items[0]?.modelLabel || model}`,
          episodeId: scriptId,
          idempotencyKey: `model-call:video:${videoId}`,
          projectId,
          quote: itemQuote,
          relatedId: videoId,
          taskType: "video_generation",
          userId,
        });
        reservedHolds.push(billingHold);
        tasks.push({ billingHold, duration, images, negativePrompt, prompt: requestPrompt, storageProvider, trackId, videoId, videoPath });
      }
    } catch (err: any) {
      await Promise.all(reservedHolds.map((hold) => releasePointHold(hold?.id)));
      await Promise.all(tasks.map((task) => u.db("o_video").where("id", task.videoId).update({ errorReason: err?.message || "积分冻结失败", state: "生成失败" })));
      return res.status(400).send(error(err?.message || "积分不足"));
    }

    res.status(200).send(success(tasks.map((t) => ({ videoId: t.videoId, trackId: t.trackId }))));
    for (const { billingHold, videoId, videoPath, storageProvider, prompt, negativePrompt, duration, images } of tasks) {
      // 所有任务全部并发后台执行，完全不阻塞任何进程
      const base64 = await Promise.all(
        images.map(async (item) => {
          if (!item) return null;
          return { base64: await u.oss.getImageBase64(item.path), type: item.sources == "audio" ? "audio" : "image" };
        }),
      );
      const relatedObjects = {
        billingHoldId: billingHold?.id || null,
        billingRelatedId: videoId,
        billingTaskType: "video_generation",
        projectId,
        videoId,
        scriptId,
        type: "视频",
        prompt,
        negativePrompt,
      };
      const aiVideo = u.Ai.Video(model);
      aiVideo
        .run(
          {
            prompt,
            negativePrompt,
            negativePromptSource,
            referenceList: base64.filter(Boolean) as ReferenceList[],
            mode: modeData.length > 0 ? modeData : mode,
            duration,
            aspectRatio: (project?.videoRatio as "16:9" | "9:16") || "16:9",
            resolution,
            audio,
          },
          {
            projectId,
            taskClass: "视频生成",
            describe: "根据提示词生成视频",
            relatedObjects: JSON.stringify(relatedObjects),
          },
        )
        .then(async () => await aiVideo.save(videoPath, storageProvider))
        .then(async () => await settlePointHold(billingHold?.id))
        .then(async () => await u.db("o_video").where("id", videoId).update({ state: "生成成功" }))
        .catch(async (error: any) => {
          await releasePointHold(billingHold?.id);
          await u
            .db("o_video")
            .where("id", videoId)
            .update({
              state: "生成失败",
              errorReason: u.error(error).message,
            });
        });
    }
  },
);
