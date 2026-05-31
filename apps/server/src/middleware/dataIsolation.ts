import type { NextFunction, Request, Response } from "express";

import { error } from "@/lib/responseFormat";
import u from "@/utils";

type IdValue = number | string | null | undefined;

const PROJECT_SCOPED_PREFIXES = [
  "/api/assets",
  "/api/assetsGenerate",
  "/api/cornerScape",
  "/api/general",
  "/api/novel",
  "/api/production",
  "/api/project",
  "/api/script",
  "/api/scriptAgent",
  "/api/task",
];

const PROJECT_ID_ROUTES = new Set(["/api/project/editProject", "/api/project/delProject", "/api/general/getSingleProject", "/api/general/updateProject"]);

const ASSET_ID_ROUTES = new Set([
  "/api/assets/batchDelete",
  "/api/assets/delAssets",
  "/api/assets/updateAssets",
  "/api/assets/updateAudioAssets",
  "/api/assets/saveAssets",
  "/api/assetsGenerate/generateAssets",
  "/api/assetsGenerate/polishAssetsPrompt",
  "/api/cornerScape/pollingAudio",
  "/api/cornerScape/updateAssetsAudio",
  "/api/production/assets/batchGenerateAssetsImage",
  "/api/production/assets/deleteAssetsDireve",
  "/api/production/assets/pollingImage",
  "/api/production/assets/updateAssetsUrl",
]);

const IMAGE_ID_ROUTES = new Set(["/api/assets/delImage", "/api/assetsGenerate/cancelGenerate"]);
const SCRIPT_ID_ROUTES = new Set(["/api/script/delScript", "/api/script/exportScript", "/api/script/pollScriptAssets", "/api/script/updateScript"]);
const NOVEL_ID_ROUTES = new Set(["/api/novel/batchDeleteNovel", "/api/novel/delNovel", "/api/novel/getNovelEventState", "/api/novel/updateNovel"]);
const STORYBOARD_ID_ROUTES = new Set([
  "/api/production/storyboard/batchDelete",
  "/api/production/storyboard/downPreviewImage",
  "/api/production/storyboard/editStoryboardInfo",
  "/api/production/storyboard/pollingImage",
  "/api/production/storyboard/previewImage",
  "/api/production/storyboard/removeFrame",
  "/api/production/storyboard/updateStoryboardUrl",
]);
const EVENT_ID_ROUTE_PREFIX = "/api/novel/event";
const TRACK_ID_ROUTES = new Set([
  "/api/production/workbench/deleteTrack",
  "/api/production/workbench/updateVideoDuration",
  "/api/production/workbench/updateVideoPrompt",
]);
const VIDEO_ID_ROUTES = new Set(["/api/production/workbench/delVideo"]);
const IMAGE_FLOW_ID_ROUTES = new Set(["/api/production/editImage/getImageFlow", "/api/production/editImage/updateImageFlow"]);

function currentUserId(req: Request) {
  const id = (req as any).user?.id;
  return id === null || id === undefined || id === "" ? "" : String(id);
}

function normalizeIds(value: unknown): number[] {
  const rawValues = Array.isArray(value) ? value : [value];
  const ids = rawValues
    .flatMap((item) => (Array.isArray(item) ? item : [item]))
    .filter((item) => item !== null && item !== undefined && item !== "")
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
  return [...new Set(ids)];
}

function bodyIds(body: Record<string, any>, ...fields: string[]) {
  return fields.flatMap((field) => normalizeIds(body[field]));
}

async function countOwnedProjects(ids: number[], userId: string) {
  if (!ids.length) return 0;
  const rows = await u.db("o_project").whereIn("id", ids).where("userId", userId).select("id");
  return new Set(rows.map((row: any) => Number(row.id))).size;
}

async function countOwnedProjectRecords(table: string, ids: number[], userId: string, projectId?: number | null) {
  if (!ids.length) return 0;
  const query = u
    .db(`${table} as record`)
    .join("o_project", "o_project.id", "record.projectId")
    .whereIn("record.id", ids)
    .where("o_project.userId", userId)
    .select("record.id");
  if (projectId !== null && projectId !== undefined) query.where("record.projectId", projectId);
  const rows = await query;
  return new Set(rows.map((row: any) => Number(row.id))).size;
}

async function countOwnedImages(ids: number[], userId: string, projectId?: number | null) {
  if (!ids.length) return 0;
  const query = u
    .db("o_image as image")
    .join("o_assets as asset", "asset.id", "image.assetsId")
    .join("o_project", "o_project.id", "asset.projectId")
    .whereIn("image.id", ids)
    .where("o_project.userId", userId)
    .select("image.id");
  if (projectId !== null && projectId !== undefined) query.where("asset.projectId", projectId);
  const rows = await query;
  return new Set(rows.map((row: any) => Number(row.id))).size;
}

async function countOwnedEvents(ids: number[], userId: string, projectId?: number | null) {
  if (!ids.length) return 0;
  const query = u
    .db("o_event as event")
    .join("o_eventChapter as eventChapter", "eventChapter.eventId", "event.id")
    .join("o_novel as novel", "novel.id", "eventChapter.novelId")
    .join("o_project", "o_project.id", "novel.projectId")
    .whereIn("event.id", ids)
    .where("o_project.userId", userId)
    .select("event.id");
  if (projectId !== null && projectId !== undefined) query.where("novel.projectId", projectId);
  const rows = await query;
  return new Set(rows.map((row: any) => Number(row.id))).size;
}

async function countOwnedImageFlows(ids: number[], userId: string, projectId?: number | null) {
  if (!ids.length) return 0;
  const owned = new Set<number>();

  const directQuery = u
    .db("o_imageFlow as flow")
    .join("o_project", "o_project.id", "flow.projectId")
    .whereIn("flow.id", ids)
    .where("o_project.userId", userId)
    .select("flow.id");
  if (projectId !== null && projectId !== undefined) directQuery.where("flow.projectId", projectId);
  const directRows = await directQuery;
  directRows.forEach((row: any) => owned.add(Number(row.id)));

  const assetQuery = u
    .db("o_assets as asset")
    .join("o_project", "o_project.id", "asset.projectId")
    .whereIn("asset.flowId", ids)
    .where("o_project.userId", userId)
    .select("asset.flowId as id");
  if (projectId !== null && projectId !== undefined) assetQuery.where("asset.projectId", projectId);
  const assetRows = await assetQuery;
  assetRows.forEach((row: any) => owned.add(Number(row.id)));

  const storyboardQuery = u
    .db("o_storyboard as storyboard")
    .join("o_project", "o_project.id", "storyboard.projectId")
    .whereIn("storyboard.flowId", ids)
    .where("o_project.userId", userId)
    .select("storyboard.flowId as id");
  if (projectId !== null && projectId !== undefined) storyboardQuery.where("storyboard.projectId", projectId);
  const storyboardRows = await storyboardQuery;
  storyboardRows.forEach((row: any) => owned.add(Number(row.id)));

  return owned.size;
}

function collectSourceIds(items: any[] | undefined, source: string) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item?.sources === source).flatMap((item) => normalizeIds(item.id));
}

function collectTrackSourceIds(trackData: any[] | undefined, source: string) {
  if (!Array.isArray(trackData)) return [];
  return trackData.flatMap((track) => [...collectSourceIds(track?.info, source), ...collectSourceIds(track?.uploadData, source)]);
}

async function requireOwnedCount(res: Response, label: string, ids: number[], countFn: () => Promise<number>) {
  const normalized = [...new Set(ids)];
  if (!normalized.length) return true;
  const count = await countFn();
  if (count !== normalized.length) {
    res.status(403).send(error(`无权访问${label}`));
    return false;
  }
  return true;
}

export async function enforceProjectDataIsolation(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.method !== "POST") return next();
    if (!PROJECT_SCOPED_PREFIXES.some((prefix) => req.path.startsWith(prefix))) return next();

    const userId = currentUserId(req);
    if (!userId) return res.status(401).send(error("未提供token"));

    const body = (req.body || {}) as Record<string, any>;
    const projectIds = bodyIds(body, "projectId");
    const primaryProjectId = projectIds[0] ?? null;

    if (!(await requireOwnedCount(res, "项目", projectIds, () => countOwnedProjects(projectIds, userId)))) return;

    if (PROJECT_ID_ROUTES.has(req.path)) {
      const ids = bodyIds(body, "id");
      if (!(await requireOwnedCount(res, "项目", ids, () => countOwnedProjects(ids, userId)))) return;
    }

    const scriptIds = bodyIds(body, "scriptId", "episodesId", "scriptIds");
    if (SCRIPT_ID_ROUTES.has(req.path)) scriptIds.push(...bodyIds(body, "id", "ids"));
    if (!(await requireOwnedCount(res, "剧本", scriptIds, () => countOwnedProjectRecords("o_script", scriptIds, userId, primaryProjectId)))) return;

    const assetIds = bodyIds(body, "assets", "assetsId", "assetIds", "assetsIds", "audioIds");
    if (ASSET_ID_ROUTES.has(req.path)) assetIds.push(...bodyIds(body, "id", "ids"));
    if (Array.isArray(body.items)) assetIds.push(...body.items.flatMap((item: any) => normalizeIds(item?.id)));
    if (Array.isArray(body.assetsItem)) assetIds.push(...body.assetsItem.flatMap((item: any) => normalizeIds(item?.id)));
    assetIds.push(...collectTrackSourceIds(body.trackData, "assets"));
    if (!(await requireOwnedCount(res, "资产", assetIds, () => countOwnedProjectRecords("o_assets", assetIds, userId, primaryProjectId)))) return;

    const novelIds = bodyIds(body, "novelIds");
    if (NOVEL_ID_ROUTES.has(req.path)) novelIds.push(...bodyIds(body, "id", "ids"));
    if (!(await requireOwnedCount(res, "原文", novelIds, () => countOwnedProjectRecords("o_novel", novelIds, userId, primaryProjectId)))) return;

    const storyboardIds = bodyIds(body, "storyboardIds");
    if (STORYBOARD_ID_ROUTES.has(req.path)) storyboardIds.push(...bodyIds(body, "id", "ids"));
    if (Array.isArray(body.data?.storyboard)) storyboardIds.push(...body.data.storyboard.flatMap((item: any) => normalizeIds(item?.id)));
    storyboardIds.push(...collectTrackSourceIds(body.trackData, "storyboard"));
    if (!(await requireOwnedCount(res, "分镜", storyboardIds, () => countOwnedProjectRecords("o_storyboard", storyboardIds, userId, primaryProjectId)))) return;

    const taskIds = bodyIds(body, "taskId");
    if (!(await requireOwnedCount(res, "任务", taskIds, () => countOwnedProjectRecords("o_tasks", taskIds, userId, primaryProjectId)))) return;

    const imageIds = IMAGE_ID_ROUTES.has(req.path) ? bodyIds(body, "id") : [];
    if (!(await requireOwnedCount(res, "图片", imageIds, () => countOwnedImages(imageIds, userId, primaryProjectId)))) return;

    const eventIds = req.path.startsWith(EVENT_ID_ROUTE_PREFIX) ? bodyIds(body, "id", "ids") : [];
    if (!(await requireOwnedCount(res, "事件", eventIds, () => countOwnedEvents(eventIds, userId, primaryProjectId)))) return;

    const trackIds = bodyIds(body, "trackId");
    if (TRACK_ID_ROUTES.has(req.path)) trackIds.push(...bodyIds(body, "id"));
    if (Array.isArray(body.trackData)) trackIds.push(...body.trackData.flatMap((track: any) => normalizeIds(track?.trackId)));
    if (!(await requireOwnedCount(res, "视频轨道", trackIds, () => countOwnedProjectRecords("o_videoTrack", trackIds, userId, primaryProjectId)))) return;

    const videoIds = bodyIds(body, "videoId");
    if (VIDEO_ID_ROUTES.has(req.path)) videoIds.push(...bodyIds(body, "id"));
    if (!(await requireOwnedCount(res, "视频", videoIds, () => countOwnedProjectRecords("o_video", videoIds, userId, primaryProjectId)))) return;

    const workDataIds = req.path === "/api/scriptAgent/updateData" ? bodyIds(body, "id") : [];
    if (!(await requireOwnedCount(res, "工作流数据", workDataIds, () => countOwnedProjectRecords("o_agentWorkData", workDataIds, userId, primaryProjectId)))) return;

    const flowIds = IMAGE_FLOW_ID_ROUTES.has(req.path) ? bodyIds(body, "id", "flowId") : [];
    if (!(await requireOwnedCount(res, "图片工作流", flowIds, () => countOwnedImageFlows(flowIds, userId, primaryProjectId)))) return;

    next();
  } catch (err) {
    next(err);
  }
}
