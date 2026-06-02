import u from "@/utils";

export interface PromptSourceInfo {
  id: number;
  sources: string;
}

interface VideoPromptAsset {
  assetsId?: number | null;
  describe?: string | null;
  filePath?: string | null;
  id: number;
  name?: string | null;
  prompt?: string | null;
  type?: string | null;
}

interface VideoPromptStoryboard {
  associateAssets: VideoPromptAsset[];
  associateAssetsIds: number[];
  duration?: string | number | null;
  id: number;
  index?: number | null;
  prompt?: string | null;
  projectId?: number | null;
  scriptId?: number | null;
  shouldGenerateImage?: boolean | number | string | null;
  track?: string | number | null;
  trackId?: number | null;
  videoDesc?: string | null;
}

export interface VideoPromptContext {
  assets: VideoPromptAsset[];
  sequence: VideoPromptSequenceItem[];
  storyboard: VideoPromptStoryboard[];
}

const CJK_RE = /[\u3400-\u9fff]/;

interface VideoPromptSequenceItem {
  duration?: string | number | null;
  id: number;
  index?: number | null;
  prompt?: string | null;
  relation: string;
  shouldGenerateImage?: boolean | number | string | null;
  track?: string | number | null;
  trackId?: number | null;
  videoDesc?: string | null;
}

function compactText(value: unknown, maxLength = 500): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function attr(value: unknown): string {
  return compactText(value, 1000)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatAssetSummary(asset: VideoPromptAsset, audioAssetId?: number): string {
  return `[${asset.id},${asset.type ?? "unknown"},${asset.name ?? ""}${audioAssetId ? ` audio:${audioAssetId}` : ""}]`;
}

function formatAssetDetail(asset: VideoPromptAsset, audioAssetId?: number): string {
  const details = [
    `id='${attr(asset.id)}'`,
    `type='${attr(asset.type ?? "unknown")}'`,
    `name='${attr(asset.name ?? "")}'`,
    audioAssetId ? `audioAssetId='${attr(audioAssetId)}'` : "",
    asset.describe ? `describe='${attr(asset.describe)}'` : "",
    asset.prompt ? `visualPrompt='${attr(asset.prompt)}'` : "",
  ].filter(Boolean);
  return `<asset ${details.join(" ")}></asset>`;
}

function formatStoryboardItem(item: VideoPromptStoryboard): string {
  const linkedAssets = item.associateAssets
    .map((asset) => `${asset.id}:${asset.type ?? "unknown"}:${compactText(asset.name, 80)}`)
    .join("; ");

  return `<storyboardItem
  id='${attr(item.id)}'
  index='${attr(item.index)}'
  videoDesc='${attr(item.videoDesc)}'
  prompt='${attr(item.prompt)}'
  track='${attr(item.track)}'
  trackId='${attr(item.trackId)}'
  duration='${attr(item.duration)}'
  associateAssetsIds='${attr(JSON.stringify(item.associateAssetsIds))}'
  associateAssets='${attr(linkedAssets)}'
  shouldGenerateImage='${attr(item.shouldGenerateImage ?? true)}'
></storyboardItem>`;
}

function formatSequenceItem(item: VideoPromptSequenceItem): string {
  return `<sequenceItem
  relation='${attr(item.relation)}'
  id='${attr(item.id)}'
  index='${attr(item.index)}'
  track='${attr(item.track)}'
  trackId='${attr(item.trackId)}'
  duration='${attr(item.duration)}'
  videoDesc='${attr(item.videoDesc)}'
  prompt='${attr(item.prompt)}'
></sequenceItem>`;
}

async function loadAssetsByIds(ids: number[]): Promise<VideoPromptAsset[]> {
  if (!ids.length) return [];
  const rows = await u
    .db("o_assets")
    .leftJoin("o_image", "o_image.id", "o_assets.imageId")
    .whereIn("o_assets.id", ids)
    .select(
      "o_assets.id",
      "o_assets.assetsId",
      "o_assets.type",
      "o_assets.name",
      "o_assets.describe",
      "o_assets.prompt",
      "o_image.filePath",
    );
  const byId = new Map<number, VideoPromptAsset>();
  rows.forEach((row: VideoPromptAsset) => byId.set(Number(row.id), row));
  return ids.map((id) => byId.get(id)).filter(Boolean) as VideoPromptAsset[];
}

async function loadAudioAssetMap(assets: VideoPromptAsset[]): Promise<Record<number, number>> {
  const audioIds = assets.filter((asset) => asset.type === "audio").map((asset) => asset.id);
  if (!audioIds.length) return {};

  const rows = await u
    .db("o_assets")
    .whereIn("o_assets.id", audioIds)
    .join("o_assetsRole2Audio", "o_assetsRole2Audio.assetsAudioId", "o_assets.assetsId")
    .select("o_assets.id", "o_assetsRole2Audio.assetsRoleId");

  const record: Record<number, number> = {};
  rows.forEach((row: { assetsRoleId?: number; id?: number }) => {
    if (row.assetsRoleId && row.id) record[row.assetsRoleId] = row.id;
  });
  return record;
}

export async function loadVideoPromptContext(info: PromptSourceInfo[]): Promise<VideoPromptContext> {
  const items = await Promise.all(
    info.map(async (item) => {
      if (item.sources === "storyboard") {
        const storyboard = await u
          .db("o_storyboard")
          .where("o_storyboard.id", item.id)
          .select("id", "scriptId", "projectId", "videoDesc", "prompt", "track", "trackId", "duration", "shouldGenerateImage", "index")
          .first();
        if (!storyboard) return null;

        const assetRows = await u.db("o_assets2Storyboard").where("storyboardId", item.id).orderBy("sort", "asc").orderBy("assetId", "asc").select("assetId");
        const associateAssetsIds = assetRows.map((row: { assetId: number }) => row.assetId).filter(Boolean);
        const associateAssets = await loadAssetsByIds(associateAssetsIds);
        return {
          ...storyboard,
          id: Number(storyboard.id ?? item.id),
          associateAssets,
          associateAssetsIds,
          _type: "storyboard" as const,
        };
      }

      if (item.sources === "assets") {
        const [asset] = await loadAssetsByIds([item.id]);
        return asset ? { ...asset, _type: "assets" as const } : null;
      }

      return null;
    }),
  );

  const assets: VideoPromptAsset[] = [];
  const storyboard: VideoPromptStoryboard[] = [];
  for (const item of items) {
    if (!item) continue;
    if (item._type === "assets") assets.push(item);
    if (item._type === "storyboard") storyboard.push(item);
  }

  return { assets, sequence: await loadStoryboardSequence(storyboard), storyboard };
}

async function loadStoryboardSequence(selectedStoryboards: VideoPromptStoryboard[]): Promise<VideoPromptSequenceItem[]> {
  const anchors = selectedStoryboards.filter((item) => item.projectId != null && item.scriptId != null);
  if (!anchors.length) return [];

  const sequenceMap = new Map<number, VideoPromptSequenceItem & { relations: Set<string> }>();

  function addSequenceItem(row: any, relation: string) {
    if (!row?.id) return;
    const id = Number(row.id);
    const existing = sequenceMap.get(id);
    if (existing) {
      existing.relations.add(relation);
      existing.relation = [...existing.relations].join(",");
      return;
    }
    sequenceMap.set(id, {
      duration: row.duration,
      id,
      index: row.index,
      prompt: row.prompt,
      relation,
      relations: new Set([relation]),
      shouldGenerateImage: row.shouldGenerateImage,
      track: row.track,
      trackId: row.trackId,
      videoDesc: row.videoDesc,
    });
  }

  const groups = new Map<string, VideoPromptStoryboard[]>();
  anchors.forEach((item) => {
    const key = `${item.projectId}:${item.scriptId}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  });

  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    const rows = await u
      .db("o_storyboard")
      .where({ projectId: first.projectId, scriptId: first.scriptId })
      .select("id", "index", "track", "trackId", "duration", "videoDesc", "prompt", "shouldGenerateImage")
      .orderBy("index", "asc")
      .orderBy("id", "asc");
    const selectedIds = new Set(group.map((item) => item.id));
    const selectedTrackIds = new Set(group.map((item) => item.trackId).filter((trackId): trackId is number => trackId != null));

    rows.forEach((row: any, position: number) => {
      const id = Number(row.id);
      if (selectedIds.has(id)) {
        addSequenceItem(row, "current");
        addSequenceItem(rows[position - 1], "previous");
        addSequenceItem(rows[position + 1], "next");
      }
      if (row.trackId != null && selectedTrackIds.has(Number(row.trackId))) addSequenceItem(row, "sameTrack");
    });
  }

  return [...sequenceMap.values()]
    .map(({ relations, ...item }) => item)
    .sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0) || a.id - b.id);
}

export async function buildVideoPromptInput(context: VideoPromptContext, modelName: string): Promise<string> {
  const assets = collectPromptAssets(context);
  const audioAssetMap = await loadAudioAssetMap(context.assets);
  const assetSummary = assets
    .filter((asset) => asset.filePath)
    .map((asset) => formatAssetSummary(asset, audioAssetMap[asset.id]))
    .join("，");
  const assetDetails = assets.map((asset) => formatAssetDetail(asset, audioAssetMap[asset.id])).join("\n");
  const storyboardItems = context.storyboard.map(formatStoryboardItem).join("\n");
  const sequenceItems = context.sequence.map(formatSequenceItem).join("\n");

  return `
          **模型名称**：${modelName},

          **资产信息**（角色、场景、道具、音频):${assetSummary},

          **资产细节**：
${assetDetails || "无"}

          **分镜信息**：
${storyboardItems || "无"}

          **分镜连续性上下文**（previous/next 是全片相邻分镜，sameTrack 是同一视频轨道内的分镜）：
${sequenceItems || "无"}

          **一致性要求**：
- 角色参考图是身份硬约束：同一角色的脸型、五官、发型、体型、服饰颜色、配饰必须前后保持一致。
- 场景参考图是空间硬约束：房间布局、墙面材质、家具位置、光源方向、色调必须保持一致。
- 分镜之间必须承接上一镜的角色姿态、情绪状态、空间位置、光线方向与环境物件；不得每个分镜重新抽一套人物和场景。
- 同一视频轨道内的分镜是一段连续动作：只允许 videoDesc 明确描述的动作、景别、运镜发生变化，其他身份和空间锚点保持不变。
- 不得新增未列出的角色、手、手臂、腿、道具或场景元素；不得让人物衣服、年龄、发型、脸型跨镜头漂移。
- 肢体必须自然可信：禁止多余手指、手指从腿部或身体长出、手掌融合、手臂重复、关节反折、身体局部融化。
- 运镜以 videoDesc 为准；除非 videoDesc 明确要求切换，输出应保持单一连贯镜头和稳定时序。
          `;
}

function collectPromptAssets(context: VideoPromptContext): VideoPromptAsset[] {
  const byId = new Map<number, VideoPromptAsset>();
  const add = (asset: VideoPromptAsset) => {
    if (!asset?.id) return;
    const existing = byId.get(asset.id);
    byId.set(asset.id, {
      ...asset,
      ...existing,
      describe: existing?.describe || asset.describe,
      filePath: existing?.filePath || asset.filePath,
      name: existing?.name || asset.name,
      prompt: existing?.prompt || asset.prompt,
      type: existing?.type || asset.type,
    });
  };
  context.assets.forEach(add);
  context.storyboard.forEach((storyboard) => storyboard.associateAssets.forEach(add));
  return [...byId.values()];
}

function uniqueNamedAssets(context: VideoPromptContext, type: string): string[] {
  const names = new Set<string>();
  for (const asset of context.assets) {
    if (asset.type === type && asset.name) names.add(compactText(asset.name, 80));
  }
  for (const storyboard of context.storyboard) {
    for (const asset of storyboard.associateAssets) {
      if (asset.type === type && asset.name) names.add(compactText(asset.name, 80));
    }
  }
  return [...names];
}

export function appendVideoConsistencyGuard(prompt: string, context: VideoPromptContext): string {
  const trimmed = prompt.trim();
  if (!trimmed || trimmed.includes("[Consistency lock]") || trimmed.includes("【一致性锁定】")) return prompt;

  const roleNames = uniqueNamedAssets(context, "role");
  const sceneNames = uniqueNamedAssets(context, "scene");
  const sequenceBrief = context.sequence
    .slice(0, 8)
    .map((item) => `${item.relation}#${item.index ?? item.id}:${compactText(item.videoDesc, 120)}`)
    .join(" | ");
  const useChinese = CJK_RE.test(trimmed);

  const guard = useChinese
    ? [
        "【一致性锁定】",
        `角色：${roleNames.length ? roleNames.join("、") : "所有参考角色"}。必须锁定同一身份、同一脸型、同一发型、同一体型、同一服饰和配饰。`,
        `场景：${sceneNames.length ? sceneNames.join("、") : "所有参考场景"}。必须锁定同一空间布局、墙面材质、家具位置、光源方向和色调。`,
        sequenceBrief ? `分镜连续性：${sequenceBrief}。当前镜头必须承接相邻分镜的人物姿态、情绪、空间位置、光线方向，不得重置画面。` : "",
        "只允许 videoDesc 中指定的动作和运镜；不得突然换房间、换服装、换年龄、换脸、换发型或新增人物。",
        "肢体自然可信：禁止多余手指、腿部或身体长出手指、多余手臂、手掌融合、关节反折、身体局部融化。",
      ].filter(Boolean)
    : [
        "[Consistency lock]",
        `Characters: ${roleNames.length ? roleNames.join(", ") : "all referenced characters"}. Keep the same identity, face, hairstyle, body shape, outfit colors, and accessories throughout the shot.`,
        `Scenes: ${sceneNames.length ? sceneNames.join(", ") : "all referenced scenes"}. Keep the same room layout, wall texture, furniture positions, lighting direction, and color palette.`,
        sequenceBrief ? `Storyboard continuity: ${sequenceBrief}. Continue the adjacent shots' pose, emotion, spatial position, lighting direction, and environment. Do not reset the image between shots.` : "",
        "Only perform the action and camera movement described in videoDesc. Do not suddenly change rooms, clothing, age, face, hairstyle, or introduce extra people.",
        "Natural anatomy only: no extra fingers, no fingers growing from legs or body, no extra arms, no fused hands, no broken joints, no melting body parts.",
      ].filter(Boolean);

  return `${trimmed}\n\n${guard.join("\n")}`;
}
