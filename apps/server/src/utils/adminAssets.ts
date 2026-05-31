import u from "@/utils";
import { db } from "@/utils/db";
import type { OssStorageProvider } from "@/utils/oss";

export type AdminAssetFilters = {
  keyword?: string;
  projectId?: string;
  scope?: string;
  state?: string;
  type?: string;
  userId?: string;
};

export type AdminAssetListParams = AdminAssetFilters & {
  page?: number;
  pageSize?: number;
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  audio: "音频",
  clip: "素材",
  role: "角色",
  scene: "场景",
  tool: "道具",
};

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text && text !== "all" ? text : "";
}

function toPositiveNumber(value: unknown, fallback: number, max?: number) {
  const numberValue = Math.floor(Number(value));
  if (!Number.isFinite(numberValue) || numberValue <= 0) return fallback;
  return max ? Math.min(numberValue, max) : numberValue;
}

function countValue(row: any) {
  return Number(row?.count ?? row?.total ?? row?.value ?? 0);
}

function createAssetQuery() {
  return db("o_assets")
    .leftJoin("o_image", "o_assets.imageId", "o_image.id")
    .leftJoin("o_assets as parent_assets", "parent_assets.id", "o_assets.assetsId")
    .leftJoin("o_project", "o_project.id", "o_assets.projectId")
    .leftJoin("o_user", "o_user.id", "o_project.userId");
}

function applyAssetFilters(query: any, filters: AdminAssetFilters) {
  const keyword = cleanText(filters.keyword);
  const projectId = cleanText(filters.projectId);
  const scope = cleanText(filters.scope);
  const state = cleanText(filters.state);
  const type = cleanText(filters.type);
  const userId = cleanText(filters.userId);

  if (type) query.andWhere("o_assets.type", type);
  if (projectId) query.andWhere("o_assets.projectId", projectId);
  if (userId) query.andWhere("o_project.userId", userId);
  if (state) query.andWhere("o_image.state", state);
  if (scope === "parent") query.whereNull("o_assets.assetsId");
  if (scope === "child") query.whereNotNull("o_assets.assetsId");

  if (keyword) {
    const likeKeyword = `%${keyword}%`;
    const keywordId = Number(keyword);
    query.andWhere((qb: any) => {
      qb.where("o_assets.name", "like", likeKeyword)
        .orWhere("o_assets.describe", "like", likeKeyword)
        .orWhere("o_assets.prompt", "like", likeKeyword)
        .orWhere("o_assets.remark", "like", likeKeyword)
        .orWhere("o_project.name", "like", likeKeyword)
        .orWhere("o_user.name", "like", likeKeyword)
        .orWhere("o_user.realName", "like", likeKeyword)
        .orWhere("parent_assets.name", "like", likeKeyword);
      if (Number.isFinite(keywordId)) qb.orWhere("o_assets.id", keywordId);
    });
  }

  return query;
}

function assetColumns() {
  return [
    "o_assets.id",
    "o_assets.assetsId",
    "o_assets.name",
    "o_assets.prompt",
    "o_assets.remark",
    "o_assets.type",
    "o_assets.describe",
    "o_assets.imageId",
    "o_assets.projectId",
    "o_assets.startTime",
    "o_assets.promptState",
    "o_assets.promptErrorReason",
    "o_image.filePath",
    "o_image.storageProvider",
    "o_image.type as fileType",
    "o_image.state as imageState",
    "o_image.errorReason as imageErrorReason",
    "parent_assets.name as parentName",
    "o_project.name as projectName",
    "o_project.userId as userId",
    "o_user.name as username",
    "o_user.realName as userRealName",
  ];
}

function isImageAssetType(type: string) {
  return ["role", "scene", "tool"].includes(type);
}

async function fileUrl(row: any, smallImage = false) {
  const filePath = String(row.filePath || "").trim();
  if (!filePath) return "";

  try {
    const provider = row.storageProvider as OssStorageProvider | undefined;
    return smallImage
      ? await u.oss.getSmallImageUrl(filePath, provider)
      : await u.oss.getFileUrl(filePath, "oss", provider);
  } catch {
    return "";
  }
}

async function normalizeAsset(row: any) {
  const type = String(row.type || "");
  const [previewUrl, originalUrl] = await Promise.all([
    fileUrl(row, isImageAssetType(type)),
    fileUrl(row, false),
  ]);

  return {
    assetsId: row.assetsId ?? null,
    describe: String(row.describe || ""),
    filePath: String(row.filePath || ""),
    fileType: String(row.fileType || ""),
    id: row.id,
    imageErrorReason: String(row.imageErrorReason || ""),
    imageId: row.imageId ?? null,
    imageState: String(row.imageState || ""),
    name: String(row.name || ""),
    parentName: String(row.parentName || ""),
    previewUrl,
    projectId: row.projectId ?? null,
    projectName: String(row.projectName || ""),
    prompt: String(row.prompt || ""),
    promptErrorReason: String(row.promptErrorReason || ""),
    promptState: String(row.promptState || ""),
    remark: String(row.remark || ""),
    src: originalUrl,
    startTime: row.startTime ?? null,
    type,
    typeLabel: ASSET_TYPE_LABELS[type] || type || "未知",
    userId: row.userId ?? null,
    userName: String(row.userRealName || row.username || ""),
    username: String(row.username || ""),
  };
}

async function countAssets(filters: AdminAssetFilters, mutate?: (query: any) => void) {
  const query = applyAssetFilters(createAssetQuery(), filters);
  if (mutate) mutate(query);
  const row = await query.count({ total: "o_assets.id" }).first();
  return countValue(row);
}

export function parseAdminAssetListParams(query: Record<string, unknown>): AdminAssetListParams {
  return {
    keyword: cleanText(query.keyword),
    page: toPositiveNumber(query.page, 1),
    pageSize: toPositiveNumber(query.pageSize, 20, 100),
    projectId: cleanText(query.projectId),
    scope: cleanText(query.scope),
    state: cleanText(query.state),
    type: cleanText(query.type),
    userId: cleanText(query.userId),
  };
}

export async function getAdminAssetList(params: AdminAssetListParams) {
  const page = toPositiveNumber(params.page, 1);
  const pageSize = toPositiveNumber(params.pageSize, 20, 100);
  const offset = (page - 1) * pageSize;
  const filters: AdminAssetFilters = {
    keyword: params.keyword,
    projectId: params.projectId,
    scope: params.scope,
    state: params.state,
    type: params.type,
    userId: params.userId,
  };

  const rows = await applyAssetFilters(createAssetQuery(), filters)
    .select(assetColumns())
    .orderBy("o_assets.id", "desc")
    .offset(offset)
    .limit(pageSize);

  const [total, generated, running, failed, withPrompt, childAssets] = await Promise.all([
    countAssets(filters),
    countAssets(filters, (query) => query.andWhere("o_image.state", "已完成")),
    countAssets(filters, (query) =>
      query.andWhere((qb: any) => {
        qb.where("o_image.state", "生成中").orWhere("o_assets.promptState", "生成中");
      }),
    ),
    countAssets(filters, (query) =>
      query.andWhere((qb: any) => {
        qb.where("o_image.state", "生成失败").orWhere("o_assets.promptState", "生成失败");
      }),
    ),
    countAssets(filters, (query) => query.whereNotNull("o_assets.prompt").whereNot("o_assets.prompt", "")),
    countAssets(filters, (query) => query.whereNotNull("o_assets.assetsId")),
  ]);

  return {
    list: await Promise.all(rows.map((row: any) => normalizeAsset(row))),
    page,
    pageSize,
    statistics: {
      childAssets,
      failed,
      generated,
      running,
      total,
      withPrompt,
    },
    total,
  };
}

export async function getAdminAssetOptions() {
  const [types, states, projects, users] = await Promise.all([
    db("o_assets").distinct("type as value").whereNotNull("type").whereNot("type", "").orderBy("type", "asc"),
    db("o_image").distinct("state as value").whereNotNull("state").whereNot("state", "").orderBy("state", "asc"),
    createAssetQuery()
      .distinct("o_project.id as value", "o_project.name as label")
      .whereNotNull("o_project.id")
      .whereNotNull("o_project.name")
      .whereNot("o_project.name", "")
      .orderBy("o_project.name", "asc"),
    createAssetQuery()
      .distinct("o_project.userId as value", "o_user.name as username", "o_user.realName as realName")
      .whereNotNull("o_project.userId")
      .orderBy("o_project.userId", "asc"),
  ]);

  return {
    projects: projects.map((item: any) => ({
      label: String(item.label || `项目 ${item.value}`),
      value: String(item.value),
    })),
    states: states.map((item: any) => ({
      label: String(item.value),
      value: String(item.value),
    })),
    types: types.map((item: any) => {
      const value = String(item.value || "");
      return { label: ASSET_TYPE_LABELS[value] || value, value };
    }),
    users: users.map((item: any) => ({
      label: String(item.realName || item.username || `用户 ${item.value}`),
      value: String(item.value),
    })),
  };
}

export async function updateAdminAsset(payload: {
  describe?: string;
  id: number;
  name?: string;
  prompt?: string;
  remark?: string;
}) {
  const id = Number(payload.id);
  if (!Number.isFinite(id) || id <= 0) throw new Error("资产 ID 不能为空");

  const exists = await db("o_assets").where("id", id).first();
  if (!exists) throw new Error("资产不存在");

  await db("o_assets")
    .where("id", id)
    .update({
      describe: payload.describe ?? "",
      name: payload.name ?? "",
      prompt: payload.prompt ?? "",
      remark: payload.remark ?? "",
    });

  const row = await createAssetQuery().select(assetColumns()).where("o_assets.id", id).first();
  return row ? await normalizeAsset(row) : null;
}

async function expandAssetIds(ids: number[]) {
  const pending = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  const result = new Set<number>(pending);

  while (pending.length > 0) {
    const current = pending.splice(0, pending.length);
    const children = await db("o_assets").whereIn("assetsId", current).select("id");
    for (const child of children as any[]) {
      const id = Number(child.id);
      if (Number.isFinite(id) && !result.has(id)) {
        result.add(id);
        pending.push(id);
      }
    }
  }

  return [...result];
}

async function deleteFiles(rows: any[]) {
  await Promise.all(
    rows.map(async (row) => {
      const filePath = String(row.filePath || "").trim();
      if (!filePath) return;
      try {
        await u.oss.deleteFile(filePath, row.storageProvider as OssStorageProvider | undefined);
      } catch (err: any) {
        if (err?.code !== "ENOENT" && err?.status !== 404) throw err;
      }
    }),
  );
}

export async function deleteAdminAssets(ids: number[]) {
  const expandedIds = await expandAssetIds(ids);
  if (expandedIds.length === 0) return { deleted: 0 };

  const assets = await db("o_assets").whereIn("id", expandedIds).select("id", "imageId", "flowId");
  const imageIds = [
    ...new Set(
      (assets as any[])
        .map((asset) => Number(asset.imageId))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  const flowIds = [
    ...new Set(
      (assets as any[])
        .map((asset) => Number(asset.flowId))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];

  const imageRowsQuery = db("o_image").whereIn("assetsId", expandedIds);
  if (imageIds.length > 0) imageRowsQuery.orWhereIn("id", imageIds);
  const imageRows = await imageRowsQuery.select("id", "filePath", "storageProvider");
  const allImageIds = [
    ...new Set(
      (imageRows as any[])
        .map((image) => Number(image.id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];

  await deleteFiles(imageRows as any[]);

  await db.transaction(async (trx) => {
    await trx("o_assets2Storyboard").whereIn("assetId", expandedIds).delete();
    await trx("o_assetsRole2Audio")
      .whereIn("assetsRoleId", expandedIds)
      .orWhereIn("assetsAudioId", expandedIds)
      .delete();
    if (flowIds.length > 0) await trx("o_imageFlow").whereIn("id", flowIds).delete();
    await trx("o_assets").whereIn("id", expandedIds).update({ imageId: null });
    if (allImageIds.length > 0) await trx("o_image").whereIn("id", allImageIds).delete();
    await trx("o_assets").whereIn("id", expandedIds).delete();
  });

  return { deleted: expandedIds.length };
}
