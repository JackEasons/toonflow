import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import fs from "fs/promises";
import path from "path";
import { type ModelBillingQuote, quoteModelCalls, releasePointHold, reserveModelCallPoints, resolveModelBillingKey, settlePointHold } from "@/utils/modelBilling";
import { buildVideoPromptInput, buildVideoPromptSources, loadVideoPromptContext } from "@/utils/videoPromptContext";
const router = express.Router();

function selectVideoPromptTemplateFile(modelName: string | undefined, mode: unknown): string | null {
  const modelLower = (modelName ?? "").toLowerCase();
  if (modelLower.includes("wan") && modelLower.includes("2.6")) return "wan2.6Single-imageFirstFrameMode.md";
  if (/seedance.*2[.\-]0/i.test(modelName ?? "")) return "seedance2Multi-parameterMode.md";
  if (mode === "startEndRequired" || mode === "endFrameOptional" || mode === "startFrameOptional") return "universalFirstAndLastFrameMode.md";
  if (typeof mode === "string" && mode.startsWith('["') && mode.endsWith('"]')) return "universalMulti-parameterMode.md";
  return null;
}

async function loadModelVideoPromptTemplate(model: string, mode: unknown): Promise<string | undefined> {
  const [vendorId, modelName] = model.split(/:(.+)/);
  const modelPromptRoot = u.getPath(["modelPrompt"]);
  const modelPromptData = await u.db("o_modelPrompt").where("vendorId", vendorId).where("model", modelName).first();
  if (modelPromptData?.path) {
    try {
      return await fs.readFile(path.join(modelPromptRoot, modelPromptData.path), "utf-8");
    } catch {}
  }

  const fileName = selectVideoPromptTemplateFile(modelName, mode);
  if (!fileName) return undefined;
  try {
    return await fs.readFile(path.join(modelPromptRoot, "video", fileName), "utf-8");
  } catch {
    return undefined;
  }
}

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    trackData: z.array(
      z.object({
        trackId: z.number(),
        info: z.array(
          z.object({
            id: z.number(),
            sources: z.string(),
          }),
        ),
      }),
    ),
    model: z.string(),
    mode: z.string().optional(),
  }),
  async (req, res) => {
    const { projectId, trackData, model, mode } = req.body;
    const userId = String((req as any).user?.id || "");
    if (!userId) return res.status(401).send(error("未提供token"));
    if (!trackData.length) return res.status(400).send(error("请选择需要生成提示词的轨道"));

    let quote: ModelBillingQuote;
    try {
      const billingModel = await resolveModelBillingKey("universalAi");
      quote = await quoteModelCalls(userId, [
        {
          count: trackData.length,
          model: billingModel,
          modelType: "text",
          taskType: "video_prompt_generation",
        },
      ]);
    } catch (err: any) {
      return res.status(400).send(error(err?.message || "获取积分报价失败"));
    }
    if (!quote.enough) return res.status(400).send(error(`积分不足，需要 ${quote.requiredPoints} 积分，当前可用 ${quote.availablePoints} 积分`));

    const [, modelData] = model.split(/:(.+)/);
    const projectData = await u.db("o_project").select("*").where({ id: projectId }).first();
    const promptMode = mode ?? projectData?.mode ?? "";
    const videoPrompt = await u.db("o_prompt").where("type", "videoPromptGeneration").first();
    let videoPromptGeneration = await loadModelVideoPromptTemplate(model, promptMode);
    if (!videoPromptGeneration && videoPrompt && videoPrompt.useData) {
      videoPromptGeneration = videoPrompt.useData;
    } else if (!videoPromptGeneration) {
      videoPromptGeneration = videoPrompt?.data ?? undefined;
    }
    const artStyle = projectData?.artStyle || "无";
    const visualManual = u.getArtPrompt(artStyle, "art_skills", "art_storyboard_video");

    const pointsPerCall = quote.items[0]?.pointsPerCall || 0;
    const billingAttemptId = u.uuid();

    async function generateTrackPrompt(trackItem: { trackId: number; info: { id: number; sources: string }[] }) {
      const itemQuote = {
        ...quote,
        enough: true,
        items: quote.items[0] ? [{ ...quote.items[0], count: 1, requiredPoints: pointsPerCall }] : [],
        requiredPoints: pointsPerCall,
      };
      let billingHold: Awaited<ReturnType<typeof reserveModelCallPoints>> | null = null;
      try {
        billingHold = await reserveModelCallPoints({
          billingMeta: itemQuote,
          description: `批量视频提示词生成：${quote.items[0]?.modelLabel || "universalAi"}`,
          idempotencyKey: `model-call:batch-video-prompt:${trackItem.trackId}:${billingAttemptId}`,
          projectId,
          quote: itemQuote,
          relatedId: trackItem.trackId,
          taskType: "video_prompt_generation",
          userId,
        });

        const promptSources = await buildVideoPromptSources(trackItem.info, { mode: promptMode, trackId: trackItem.trackId });
        const promptContext = await loadVideoPromptContext(promptSources);
        const content = await buildVideoPromptInput(promptContext, modelData);

        const { text } = await u.Ai.Text("universalAi").invoke({
          system: videoPromptGeneration,
          messages: [
            {
              role: "assistant",
              content: `${visualManual}`,
            },
            {
              role: "user",
              content: content,
            },
          ],
        });
        if (!text.trim()) throw new Error("AI 未返回视频提示词");
        await u.db("o_videoTrack").where({ id: trackItem.trackId }).update({
          prompt: text,
        });
        await settlePointHold(billingHold?.id);
        return { id: trackItem.trackId, prompt: text, state: "success" };
      } catch (e) {
        await releasePointHold(billingHold?.id);
        return { errorReason: u.error(e).message, id: trackItem.trackId, state: "failed" };
      }
    }

    const results = await Promise.all(trackData.map((item: { trackId: number; info: { id: number; sources: string }[] }) => generateTrackPrompt(item)));
    res.status(200).send(success(results));
  },
);
