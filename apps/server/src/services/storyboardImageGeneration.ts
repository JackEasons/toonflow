import u from "@/utils";
import { quoteModelCalls, releasePointHold, reserveModelCallPoints, settlePointHold } from "@/utils/modelBilling";
import { resolveNegativePrompt } from "@/utils/negativePrompt";
import { appendStoryboardImageConsistencyGuard, loadVideoPromptContext } from "@/utils/videoPromptContext";

const MAX_IMAGE_REFERENCE_COUNT = 8;

type StoryboardRow = Record<string, any>;

export interface StartStoryboardImageGenerationInput {
  compulsory?: boolean;
  concurrentCount?: number;
  projectId: number;
  scriptId: number;
  storyboardIds: number[];
  userId: string;
}

export interface StoryboardImageGenerationItem {
  associateAssetsIds: number[];
  id: number;
  negativePrompt?: string | null;
  prompt?: string | null;
  shouldGenerateImage?: number | null;
  src: null;
  state?: string | null;
  videoDesc?: string | null;
}

export interface StoryboardImageGenerationStarted {
  background: Promise<void>;
  data: StoryboardImageGenerationItem[];
  generateIds: number[];
  skippedIds: number[];
  storyIds: number[];
}

function httpError(message: string, statusCode = 400) {
  const err = new Error(message) as Error & { statusCode?: number };
  err.statusCode = statusCode;
  return err;
}

function normalizeIds(ids: number[]) {
  return [...new Set(ids.map(Number).filter((id) => Number.isFinite(id)))];
}

export async function startStoryboardImageGeneration(input: StartStoryboardImageGenerationInput): Promise<StoryboardImageGenerationStarted> {
  const { compulsory = false, projectId, scriptId, userId } = input;
  const storyboardIds = normalizeIds(input.storyboardIds || []);
  const concurrentCount = Math.max(1, Math.floor(Number(input.concurrentCount || 5)));

  if (!userId) throw httpError("未提供token", 401);
  if (!storyboardIds.length) throw httpError("storyboardIds不能为空", 400);

  const storyboardData = await u.db("o_storyboard").where("scriptId", scriptId).where("projectId", projectId).whereIn("id", storyboardIds);
  if (!storyboardData.length) throw httpError("未查到分镜数据", 500);

  const storyIds = normalizeIds(storyboardData.map((item: StoryboardRow) => item.id));
  const projectSettingData = await u.db("o_project").where("id", projectId).select("imageModel", "imageQuality", "artStyle", "videoRatio").first();
  if (!projectSettingData?.imageModel) throw httpError("项目未配置图片模型", 400);

  const generateList = compulsory ? storyboardData : storyboardData.filter((item: StoryboardRow) => item.shouldGenerateImage !== 0);

  let quote: Awaited<ReturnType<typeof quoteModelCalls>> | null = null;
  if (generateList.length > 0) {
    quote = await quoteModelCalls(userId, [
      {
        count: generateList.length,
        model: projectSettingData.imageModel as string,
        modelType: "image",
        taskType: "storyboard_image_generation",
      },
    ]);
    if (!quote.enough) throw httpError(`积分不足，需要 ${quote.requiredPoints} 积分，当前可用 ${quote.availablePoints} 积分`, 400);
  }

  if (compulsory) {
    await u.db("o_storyboard").whereIn("id", storyIds).where("scriptId", scriptId).update({ state: "生成中", shouldGenerateImage: 1 });
  } else {
    await u.db("o_storyboard").whereIn("id", storyIds).where("scriptId", scriptId).where("shouldGenerateImage", 0).update({ state: "未生成" });
    await u.db("o_storyboard").whereIn("id", storyIds).where("scriptId", scriptId).where("shouldGenerateImage", 1).update({ state: "生成中" });
  }

  const assetRecord = await buildStoryboardAssetRecord(storyIds);
  const realStoryData = await u.db("o_storyboard").where("scriptId", scriptId).where("projectId", projectId).whereIn("id", storyIds);
  const responseData = realStoryData.map((item: StoryboardRow) => ({
    associateAssetsIds: assetRecord[item.id] || [],
    id: item.id,
    negativePrompt: item.negativePrompt,
    prompt: item.prompt,
    shouldGenerateImage: item.shouldGenerateImage,
    src: null,
    state: item.state,
    videoDesc: item.videoDesc,
  }));

  if (!generateList.length || !quote) {
    return {
      background: Promise.resolve(),
      data: responseData,
      generateIds: [],
      skippedIds: storyIds,
      storyIds,
    };
  }

  const holdMap = new Map<number, Awaited<ReturnType<typeof reserveModelCallPoints>>>();
  const billingAttemptId = u.uuid();
  try {
    const pointsPerCall = quote.items[0]?.pointsPerCall || 0;
    for (const item of generateList) {
      const itemQuote = {
        ...quote,
        enough: true,
        items: quote.items[0] ? [{ ...quote.items[0], count: 1, requiredPoints: pointsPerCall }] : [],
        requiredPoints: pointsPerCall,
      };
      const hold = await reserveModelCallPoints({
        billingMeta: itemQuote,
        description: `分镜图片生成：${quote.items[0]?.modelLabel || projectSettingData.imageModel}`,
        episodeId: scriptId,
        idempotencyKey: `model-call:storyboard:${item.id}:${billingAttemptId}`,
        projectId,
        quote: itemQuote,
        relatedId: item.id,
        taskType: "storyboard_image_generation",
        userId,
      });
      holdMap.set(item.id!, hold);
    }
  } catch (err: any) {
    await Promise.all([...holdMap.values()].map((hold) => releasePointHold(hold?.id)));
    await u.db("o_storyboard").whereIn("id", storyIds).where("scriptId", scriptId).update({ reason: err?.message || "积分冻结失败", state: "生成失败" });
    throw httpError(err?.message || "积分不足", 400);
  }

  const storyboardNegativePromptSource = u.getArtPrompt(projectSettingData?.artStyle ?? "", "art_skills", "director_storyboard");
  const background = runStoryboardImageGeneration({
    assetRecord,
    concurrentCount,
    generateList,
    holdMap,
    projectId,
    projectSettingData,
    scriptId,
    storyboardNegativePromptSource,
  });

  return {
    background,
    data: responseData,
    generateIds: generateList.map((item: StoryboardRow) => item.id).filter((id: number) => Number.isFinite(id)),
    skippedIds: storyIds.filter((id) => !generateList.some((item: StoryboardRow) => Number(item.id) === id)),
    storyIds,
  };
}

async function buildStoryboardAssetRecord(storyIds: number[]) {
  const assets2StoryboardRows = await u.db("o_assets2Storyboard").whereIn("storyboardId", storyIds).orderBy("sort", "asc").orderBy("assetId", "asc").select("storyboardId", "assetId");
  const allAssetIds = [...new Set(assets2StoryboardRows.map((row: StoryboardRow) => row.assetId))];
  const assetImageMap: Record<number, number> = {};
  if (allAssetIds.length > 0) {
    const assetRows = await u.db("o_assets").whereIn("id", allAssetIds).select("id", "imageId");
    assetRows.forEach((row: StoryboardRow) => {
      assetImageMap[row.id] = row.imageId;
    });
  }

  const assetRecord: Record<number, number[]> = {};
  assets2StoryboardRows.forEach((item: StoryboardRow) => {
    if (!assetRecord[item.storyboardId]) assetRecord[item.storyboardId] = [];
    const imageId = assetImageMap[item.assetId];
    if (imageId != null) assetRecord[item.storyboardId].push(imageId);
  });
  return assetRecord;
}

async function runStoryboardImageGeneration({
  assetRecord,
  concurrentCount,
  generateList,
  holdMap,
  projectId,
  projectSettingData,
  scriptId,
  storyboardNegativePromptSource,
}: {
  assetRecord: Record<number, number[]>;
  concurrentCount: number;
  generateList: StoryboardRow[];
  holdMap: Map<number, Awaited<ReturnType<typeof reserveModelCallPoints>>>;
  projectId: number;
  projectSettingData: StoryboardRow;
  scriptId: number;
  storyboardNegativePromptSource: string;
}) {
  const generateTask = async (item: StoryboardRow) => {
    const billingHold = holdMap.get(item.id!);
    const promptContext = await loadVideoPromptContext([{ id: item.id!, sources: "storyboard" }]);
    const requestPrompt = appendStoryboardImageConsistencyGuard(item.prompt || item.videoDesc || "", promptContext);
    const negativePrompt = resolveNegativePrompt(
      { prompt: requestPrompt, negativePromptSource: storyboardNegativePromptSource },
      { mediaType: "image", modelKey: projectSettingData.imageModel as `${string}:${string}` },
    );
    const payload = {
      aspectRatio: projectSettingData?.videoRatio as `${number}:${number}`,
      billingHoldId: billingHold?.id || null,
      billingRelatedId: item.id,
      billingTaskType: "storyboard_image_generation",
      negativePrompt,
      projectId,
      prompt: requestPrompt,
      scriptId,
      size: projectSettingData?.imageQuality as "1K" | "2K" | "4K",
      storyboardId: item.id,
    };

    try {
      await u.db("o_storyboard").where("id", item.id).update({ negativePrompt: payload.negativePrompt });
      const imageCls = await u.Ai.Image(projectSettingData.imageModel as `${string}:${string}`).run(
        {
          referenceList: await getStoryboardImageReferenceList(item.id!, assetRecord[item.id!] || []),
          negativePromptSource: storyboardNegativePromptSource,
          ...payload,
        },
        {
          taskClass: "生成分镜图片",
          describe: "分镜图片生成",
          relatedObjects: JSON.stringify(payload),
          projectId,
        },
      );
      const savePath = `/${projectId}/assets/${scriptId}/${u.uuid()}.jpg`;
      const storageProvider = u.oss.getStorageProvider();
      await imageCls.save(savePath, storageProvider);
      await settlePointHold(billingHold?.id);
      await u.db("o_storyboard").where("id", item.id).update({
        filePath: savePath,
        storageProvider,
        state: "已完成",
      });
    } catch (e) {
      await releasePointHold(billingHold?.id);
      await u.db("o_storyboard").where("id", item.id).update({
        filePath: "",
        reason: u.error(e).message,
        state: "生成失败",
        storageProvider: null,
      });
    }
  };

  for (let i = 0; i < generateList.length; i += concurrentCount) {
    const batch = generateList.slice(i, i + concurrentCount);
    await Promise.all(batch.map(generateTask));
  }
}

async function getStoryboardImageReferenceList(storyboardId: number, assetImageIds: number[]) {
  const assetRefs = await getAssetsImageBase64(assetImageIds.slice(0, MAX_IMAGE_REFERENCE_COUNT));
  const remaining = MAX_IMAGE_REFERENCE_COUNT - assetRefs.length;
  if (remaining <= 0) return assetRefs;

  const continuityPaths = await getStoryboardContinuityFilePaths(storyboardId, remaining);
  const continuityRefs = await getImageFilePathsBase64(continuityPaths);
  return [...assetRefs, ...continuityRefs].slice(0, MAX_IMAGE_REFERENCE_COUNT);
}

async function getStoryboardContinuityFilePaths(storyboardId: number, limit: number): Promise<string[]> {
  if (limit <= 0) return [];
  const current = await u.db("o_storyboard").where("id", storyboardId).select("id", "projectId", "scriptId", "trackId", "index").first();
  if (!current?.projectId || !current?.scriptId) return [];

  const rows = await u
    .db("o_storyboard")
    .where({ projectId: current.projectId, scriptId: current.scriptId })
    .whereNot("id", storyboardId)
    .whereNotNull("filePath")
    .select("id", "filePath", "trackId", "index")
    .orderBy("index", "asc")
    .orderBy("id", "asc");

  const currentIndex = Number(current.index ?? current.id ?? 0);
  const seen = new Set<string>();
  const paths: string[] = [];
  const add = (row?: any) => {
    const filePath = row?.filePath;
    if (!filePath || seen.has(filePath)) return;
    seen.add(filePath);
    paths.push(filePath);
  };

  const withDistance: (StoryboardRow & { distance: number; position: number })[] = (rows as StoryboardRow[]).map((row) => ({
    ...row,
    distance: Math.abs(Number(row.index ?? row.id ?? 0) - currentIndex),
    position: Number(row.index ?? row.id ?? 0),
  }));
  add(
    withDistance
      .filter((row: StoryboardRow) => row.position < currentIndex)
      .sort((a: StoryboardRow, b: StoryboardRow) => b.position - a.position)[0],
  );
  add(
    withDistance
      .filter((row: StoryboardRow) => row.position > currentIndex)
      .sort((a: StoryboardRow, b: StoryboardRow) => a.position - b.position)[0],
  );
  withDistance
    .filter((row: StoryboardRow) => row.trackId != null && current.trackId != null && Number(row.trackId) === Number(current.trackId))
    .sort((a: StoryboardRow, b: StoryboardRow) => a.distance - b.distance || a.position - b.position)
    .forEach(add);

  return paths.slice(0, limit);
}

async function getImageFilePathsBase64(filePaths: string[]) {
  const imageUrls = await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        return await u.oss.getImageBase64(filePath);
      } catch {
        return null;
      }
    }),
  );
  return (imageUrls.filter(Boolean) as string[]).map((url) => ({ type: "image" as const, base64: url }));
}

async function getAssetsImageBase64(imageIds: number[]) {
  if (!imageIds.length) return [];

  const imagePaths = await u.db("o_image").whereIn("o_image.id", imageIds).select("o_image.id", "o_image.filePath");
  const id2Path = new Map<number, string>();
  for (const row of imagePaths) {
    id2Path.set(row.id, row.filePath);
  }

  const imageUrls = await Promise.all(
    imageIds.map(async (id) => {
      const filePath = id2Path.get(id);
      if (!filePath) return null;
      try {
        return await u.oss.getImageBase64(filePath);
      } catch {
        return null;
      }
    }),
  );
  return (imageUrls.filter(Boolean) as string[]).map((url) => ({ type: "image" as const, base64: url }));
}
