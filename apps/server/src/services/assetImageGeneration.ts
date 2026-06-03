import u from "@/utils";
import { quoteModelCalls, recordPointHoldModelUsage, releasePointHold, reserveModelCallPoints, resolveModelBillingKey, settlePointHold } from "@/utils/modelBilling";
import { resolveNegativePrompt } from "@/utils/negativePrompt";

type AssetRow = Record<string, any>;

export interface StartAssetImageGenerationInput {
  assetIds: number[];
  concurrentCount?: number;
  projectId: number;
  scriptId: number;
  userId: string;
}

export interface AssetImageGenerationItem {
  errorReason?: string | null;
  id: number;
  prompt?: string | null;
  src: string | null;
  state: "未生成" | "生成中" | "已完成" | "生成失败";
}

export interface AssetImageGenerationStarted {
  background: Promise<AssetImageGenerationItem[]>;
  data: AssetImageGenerationItem[];
  generateIds: number[];
}

function httpError(message: string, statusCode = 400) {
  const err = new Error(message) as Error & { statusCode?: number };
  err.statusCode = statusCode;
  return err;
}

function normalizeIds(ids: number[]) {
  return [...new Set((ids || []).map(Number).filter((id) => Number.isFinite(id)))];
}

export async function startAssetImageGeneration(input: StartAssetImageGenerationInput): Promise<AssetImageGenerationStarted> {
  const { projectId, scriptId, userId } = input;
  const assetIds = normalizeIds(input.assetIds);
  const concurrentCount = Math.max(1, Math.floor(Number(input.concurrentCount || 5)));

  if (!userId) throw httpError("未提供token", 401);
  if (!assetIds.length) {
    return {
      background: Promise.resolve([]),
      data: [],
      generateIds: [],
    };
  }

  const assetsDataArr = await u
    .db("o_assets")
    .leftJoin("o_image", "o_assets.imageId", "o_image.id")
    .whereIn("o_assets.id", assetIds)
    .where("o_assets.projectId", projectId)
    .select(
      "o_assets.id",
      "o_assets.describe",
      "o_assets.name",
      "o_assets.type",
      "o_assets.assetsId",
      "o_image.state as imageState",
      "o_image.filePath as imageFilePath",
    );
  if (!assetsDataArr.length) {
    return {
      background: Promise.resolve([]),
      data: [],
      generateIds: [],
    };
  }

  const existingIds = assetsDataArr
    .filter((item: AssetRow) => item.imageState === "生成中" || (item.imageState === "已完成" && item.imageFilePath))
    .map((item: AssetRow) => item.id)
    .filter((id: number) => Number.isFinite(id));
  const pendingIds = existingIds.filter((id: number) => assetsDataArr.find((item: AssetRow) => item.id === id)?.imageState === "生成中");
  const assetsToGenerate = assetsDataArr.filter((item: AssetRow) => item.imageState !== "生成中" && !(item.imageState === "已完成" && item.imageFilePath));

  if (!assetsToGenerate.length) {
    const data = await getAssetImageGenerationItems(assetIds);
    return {
      background: pendingIds.length ? waitForAssetImageGeneration(pendingIds).then(() => getAssetImageGenerationItems(assetIds)) : Promise.resolve(data),
      data,
      generateIds: [],
    };
  }

  const projectSettingData = await u.db("o_project").where("id", projectId).select("imageModel", "imageQuality", "artStyle").first();
  if (!projectSettingData?.imageModel) throw httpError("项目未配置图片模型", 400);

  let quote: Awaited<ReturnType<typeof quoteModelCalls>>;
  try {
    const textBillingModel = await resolveModelBillingKey("universalAi");
    quote = await quoteModelCalls(userId, [
      {
        count: assetsToGenerate.length,
        model: textBillingModel,
        modelType: "text",
        taskType: "asset_prompt_generation",
      },
      {
        count: assetsToGenerate.length,
        model: projectSettingData.imageModel as string,
        modelType: "image",
        taskType: "asset_image_generation",
      },
    ]);
  } catch (err: any) {
    throw httpError(err?.message || "获取积分报价失败", 400);
  }
  if (!quote.enough) throw httpError(`积分不足，需要 ${quote.requiredPoints} 积分，当前可用 ${quote.availablePoints} 积分`, 400);

  const parentIds = assetsToGenerate.map((item: AssetRow) => item.assetsId).filter((id: number | null) => id !== null);
  const parentAssetsData = await u
    .db("o_assets")
    .leftJoin("o_image", "o_assets.imageId", "o_image.id")
    .whereIn("o_assets.id", parentIds as number[])
    .select("o_assets.id", "o_image.filePath", "o_assets.describe");
  assetsToGenerate.forEach((asset: AssetRow) => {
    const parent = parentAssetsData.find((item: AssetRow) => item.id === asset.assetsId);
    if (parent) asset.parentDescribe = parent.describe;
  });

  const imageUrlRecord: Record<number, string> = {};
  parentAssetsData.forEach((item: AssetRow) => {
    if (item.filePath) imageUrlRecord[item.id] = item.filePath;
  });

  const imageIdMap: Record<number, number> = {};
  const holdMap = new Map<number, Awaited<ReturnType<typeof reserveModelCallPoints>>>();
  try {
    const itemQuote = {
      ...quote,
      enough: true,
      items: quote.items.map((item) => ({ ...item, count: 1, requiredPoints: item.pointsPerCall })),
      requiredPoints: quote.items.reduce((sum, item) => sum + item.pointsPerCall, 0),
    };
    for (const item of assetsToGenerate) {
      const [imageId] = await u.db("o_image").insert({
        assetsId: item.id,
        errorReason: null,
        type: item.type,
        state: "生成中",
        resolution: projectSettingData.imageQuality,
        model: projectSettingData.imageModel,
      });
      imageIdMap[item.id!] = imageId;
      await u.db("o_assets").where("id", item.id).update({ imageId });

      const hold = await reserveModelCallPoints({
        billingMeta: itemQuote,
        description: `资产图片生成：${itemQuote.items.map((quoteItem) => quoteItem.modelLabel).join(" + ") || projectSettingData.imageModel}`,
        episodeId: scriptId,
        idempotencyKey: `model-call:image:${imageId}`,
        projectId,
        quote: itemQuote,
        relatedId: imageId,
        taskType: "asset_image_generation",
        userId,
      });
      holdMap.set(item.id!, hold);
    }
  } catch (err: any) {
    await Promise.all([...holdMap.values()].map((hold) => releasePointHold(hold?.id)));
    await Promise.all(Object.values(imageIdMap).map((imageId) => u.db("o_image").where({ id: imageId }).update({ errorReason: err?.message || "积分冻结失败", state: "生成失败" })));
    throw httpError(err?.message || "积分不足", 400);
  }

  const createdData = assetsToGenerate.map((item: AssetRow) => ({
    id: item.id,
    src: null,
    state: "生成中" as const,
  }));
  const existingData = await getAssetImageGenerationItems(existingIds);
  const data = [...existingData, ...createdData].sort((a, b) => assetIds.indexOf(a.id) - assetIds.indexOf(b.id));
  const background = runAssetImageGeneration({
    assetsDataArr: assetsToGenerate,
    concurrentCount,
    holdMap,
    imageIdMap,
    imageUrlRecord,
    projectId,
    projectSettingData,
    scriptId,
  }).then(async () => {
    if (pendingIds.length) await waitForAssetImageGeneration(pendingIds);
    return getAssetImageGenerationItems(assetIds);
  });

  return {
    background,
    data,
    generateIds: assetsToGenerate.map((item: AssetRow) => item.id).filter((id: number) => Number.isFinite(id)),
  };
}

export async function getAssetImageGenerationItems(assetIds: number[]): Promise<AssetImageGenerationItem[]> {
  const ids = normalizeIds(assetIds);
  if (!ids.length) return [];
  const rows = await u
    .db("o_assets")
    .leftJoin("o_image", "o_assets.imageId", "o_image.id")
    .whereIn("o_assets.id", ids)
    .select("o_image.state", "o_assets.id", "o_image.filePath", "o_image.errorReason", "o_assets.prompt");

  return Promise.all(
    rows.map(async (item: AssetRow) => ({
      errorReason: item.state === "生成失败" ? (item.errorReason ?? null) : null,
      id: item.id,
      prompt: item.prompt ?? null,
      src: item.filePath ? await u.oss.getSmallImageUrl(item.filePath) : null,
      state: (item.state || "未生成") as AssetImageGenerationItem["state"],
    })),
  );
}

export async function waitForAssetImageGeneration(assetIds: number[], opts: { intervalMs?: number; timeoutMs?: number } = {}) {
  const ids = normalizeIds(assetIds);
  const intervalMs = opts.intervalMs ?? 5000;
  const timeoutMs = opts.timeoutMs ?? 30 * 60 * 1000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const items = await getAssetImageGenerationItems(ids);
    if (items.length >= ids.length && items.every((item) => item.state !== "生成中")) return items;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("衍生资产图片生成等待超时");
}

async function runAssetImageGeneration({
  assetsDataArr,
  concurrentCount,
  holdMap,
  imageIdMap,
  imageUrlRecord,
  projectId,
  projectSettingData,
  scriptId,
}: {
  assetsDataArr: AssetRow[];
  concurrentCount: number;
  holdMap: Map<number, Awaited<ReturnType<typeof reserveModelCallPoints>>>;
  imageIdMap: Record<number, number>;
  imageUrlRecord: Record<number, string>;
  projectId: number;
  projectSettingData: AssetRow;
  scriptId: number;
}) {
  const rolePrompt = u.getArtPrompt(projectSettingData.artStyle!, "art_skills", "art_character_derivative");
  const toolPrompt = u.getArtPrompt(projectSettingData.artStyle!, "art_skills", "art_prop_derivative");
  const scenePrompt = u.getArtPrompt(projectSettingData.artStyle!, "art_skills", "art_scene_derivative");
  const promptRecord: Record<string, { prompt: string }> = {
    role: { prompt: rolePrompt },
    tool: { prompt: toolPrompt },
    scene: { prompt: scenePrompt },
  };

  const generateSingleAsset = async (item: AssetRow) => {
    const imageId = imageIdMap[item.id!];
    const typeConfig = promptRecord[item.type!] || promptRecord.role;
    const billingHold = holdMap.get(item.id!);
    try {
      const textResult = await u.Ai.Text("universalAi").invoke({
        system: `${typeConfig.prompt}`,
        messages: [
          {
            role: "user",
            content: `
            父级资产描述: ${item.parentDescribe || "无详细描述"}
            当前资产描述: ${item.describe || "无详细描述"}`,
          },
        ],
      });
      const { text } = textResult;
      await recordPointHoldModelUsage(billingHold?.id, textResult, { usagePhase: "asset_prompt_generation" });
      await u.db("o_assets").where("id", item.id).update({ prompt: text });

      const imageBase64 = imageUrlRecord[item.assetsId!] ? await u.oss.getImageBase64(imageUrlRecord[item.assetsId!]) : null;
      const negativePrompt = resolveNegativePrompt(
        { prompt: text, negativePromptSource: typeConfig.prompt },
        { mediaType: "image", modelKey: projectSettingData.imageModel as `${string}:${string}` },
      );
      const payload = {
        aspectRatio: "16:9" as `${number}:${number}`,
        assetsId: item.id,
        billingHoldId: billingHold?.id || null,
        billingRelatedId: imageId,
        billingTaskType: "asset_image_generation",
        imageId,
        negativePrompt,
        projectId,
        prompt: text,
        size: projectSettingData.imageQuality as "1K" | "2K" | "4K",
      };
      await u.db("o_image").where({ id: imageId }).update({ prompt: text, negativePrompt });
      const imageCls = await u.Ai.Image(projectSettingData.imageModel as `${string}:${string}`).run(
        {
          referenceList: imageBase64 ? [{ type: "image", base64: imageBase64 }] : [],
          negativePromptSource: typeConfig.prompt,
          ...payload,
        },
        {
          taskClass: "生成图片",
          describe: "资产图片生成",
          relatedObjects: JSON.stringify(payload),
          projectId,
        },
      );
      const savePath = `/${projectId}/assets/${scriptId}/${item.type}/${u.uuid()}.jpg`;
      const storageProvider = u.oss.getStorageProvider();
      await imageCls.save(savePath, storageProvider);
      await settlePointHold(billingHold?.id);
      await u.db("o_image").where({ id: imageId }).update({ errorReason: null, state: "已完成", filePath: savePath, storageProvider });
    } catch (e) {
      await releasePointHold(billingHold?.id);
      await u.db("o_image").where({ id: imageId }).update({ state: "生成失败", errorReason: u.error(e).message });
    }
  };

  for (let i = 0; i < assetsDataArr.length; i += concurrentCount) {
    const batch = assetsDataArr.slice(i, i + concurrentCount);
    await Promise.all(batch.map(generateSingleAsset));
  }

  return getAssetImageGenerationItems(assetsDataArr.map((item: AssetRow) => item.id));
}
