import { db } from "@/utils/db";

export type AdminTaskFilters = {
  keyword?: string;
  projectId?: string;
  startFrom?: number;
  startTo?: number;
  state?: string;
  taskClass?: string;
  userId?: string;
};

export type AdminTaskListParams = AdminTaskFilters & {
  page?: number;
  pageSize?: number;
};

type AdminTaskBucket = {
  count: number;
  name: string;
};

type AdminTaskBillingMode = "detail" | "summary";

type TokenUsage = {
  completionTokens: null | number;
  promptTokens: null | number;
  reasoningTokens: null | number;
  source: string;
  totalTokens: null | number;
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

function toOptionalTimestamp(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
}

function countValue(row: any) {
  return Number(row?.count ?? row?.total ?? row?.value ?? 0);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toIso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function createTaskQuery() {
  return db("o_tasks")
    .leftJoin("o_project", "o_project.id", "o_tasks.projectId")
    .leftJoin("o_user", "o_user.id", "o_project.userId");
}

function applyTaskFilters(query: any, filters: AdminTaskFilters) {
  const taskClass = cleanText(filters.taskClass);
  const state = cleanText(filters.state);
  const projectId = cleanText(filters.projectId);
  const userId = cleanText(filters.userId);
  const keyword = cleanText(filters.keyword);

  if (taskClass) query.andWhere("o_tasks.taskClass", taskClass);
  if (state) query.andWhere("o_tasks.state", state);
  if (projectId) query.andWhere("o_tasks.projectId", projectId);
  if (userId) query.andWhere("o_project.userId", userId);
  if (filters.startFrom) query.andWhere("o_tasks.startTime", ">=", filters.startFrom);
  if (filters.startTo) query.andWhere("o_tasks.startTime", "<=", filters.startTo);

  if (keyword) {
    const likeKeyword = `%${keyword}%`;
    const keywordId = Number(keyword);
    query.andWhere((qb: any) => {
      qb.where("o_tasks.taskClass", "like", likeKeyword)
        .orWhere("o_tasks.relatedObjects", "like", likeKeyword)
        .orWhere("o_tasks.model", "like", likeKeyword)
        .orWhere("o_tasks.describe", "like", likeKeyword)
        .orWhere("o_tasks.prompt", "like", likeKeyword)
        .orWhere("o_tasks.negativePrompt", "like", likeKeyword)
        .orWhere("o_tasks.reason", "like", likeKeyword)
        .orWhere("o_project.name", "like", likeKeyword)
        .orWhere("o_user.name", "like", likeKeyword)
        .orWhere("o_user.realName", "like", likeKeyword);
      if (Number.isFinite(keywordId)) qb.orWhere("o_tasks.id", keywordId);
    });
  }

  return query;
}

function taskColumns() {
  return [
    "o_tasks.id",
    "o_tasks.projectId",
    "o_tasks.taskClass",
    "o_tasks.relatedObjects",
    "o_tasks.model",
    "o_tasks.describe",
    "o_tasks.prompt",
    "o_tasks.negativePrompt",
    "o_tasks.state",
    "o_tasks.startTime",
    "o_tasks.reason",
    "o_project.name as projectName",
    "o_project.userId as userId",
    "o_user.name as userName",
    "o_user.realName as userRealName",
  ];
}

function parseRelatedObjects(value: unknown): Record<string, any> {
  if (!value || typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeId(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : "";
}

function pushUnique(target: Set<string>, value: unknown) {
  const text = normalizeId(value);
  if (text) target.add(text);
}

function taskTypeCandidates(taskClass: string, relatedObjectData: Record<string, any>) {
  const types = new Set<string>();
  pushUnique(types, relatedObjectData.billingTaskType);
  pushUnique(types, relatedObjectData.taskType);

  if (taskClass.includes("视频生成")) types.add("video_generation");
  if (taskClass.includes("生成分镜图片")) types.add("storyboard_image_generation");
  if (taskClass.includes("角色图生成") || taskClass.includes("场景图生成") || taskClass.includes("道具图生成")) types.add("asset_center_image_generation");
  if (taskClass.includes("资产图片") || taskClass.includes("资产图") || taskClass === "生成图片") types.add("asset_image_generation");
  if (taskClass.includes("工作流图片")) types.add("workflow_image_generation");
  if (taskClass.includes("提示词")) types.add("video_prompt_generation");
  if (taskClass.includes("配音") || taskClass.includes("音频")) types.add("asset_audio_binding");

  return [...types];
}

function relatedIdsForBilling(taskClass: string, relatedObjectData: Record<string, any>) {
  const ids = new Set<string>();
  pushUnique(ids, relatedObjectData.billingRelatedId);
  pushUnique(ids, relatedObjectData.relatedId);
  pushUnique(ids, relatedObjectData.videoId);
  pushUnique(ids, relatedObjectData.imageId);
  pushUnique(ids, relatedObjectData.storyboardId);
  pushUnique(ids, relatedObjectData.trackId);

  if (taskClass.includes("生成分镜图片")) pushUnique(ids, relatedObjectData.id);
  if (taskClass.includes("提示词") || taskClass.includes("配音")) pushUnique(ids, relatedObjectData.assetsId || relatedObjectData.assetId || relatedObjectData.id);

  return [...ids];
}

function freezeIdsForBilling(relatedObjectData: Record<string, any>) {
  const ids = new Set<string>();
  pushUnique(ids, relatedObjectData.billingHoldId);
  pushUnique(ids, relatedObjectData.freezeId);
  return [...ids];
}

function parseMeta(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function pickNumber(source: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) return numberValue;
  }
  return null;
}

function extractTokenUsage(...sources: unknown[]): TokenUsage {
  const empty: TokenUsage = {
    completionTokens: null,
    promptTokens: null,
    reasoningTokens: null,
    source: "not_recorded",
    totalTokens: null,
  };

  for (const source of sources) {
    const meta = parseMeta(source);
    const candidates = [meta.usage, meta.tokenUsage, meta.tokens, meta.providerUsage, meta];
    for (const candidate of candidates) {
      const usage = parseMeta(candidate);
      const promptTokens = pickNumber(usage, ["promptTokens", "prompt_tokens", "inputTokens", "input_tokens"]);
      const completionTokens = pickNumber(usage, ["completionTokens", "completion_tokens", "outputTokens", "output_tokens"]);
      const reasoningTokens = pickNumber(usage, ["reasoningTokens", "reasoning_tokens"]);
      const totalTokens = pickNumber(usage, ["totalTokens", "total_tokens"]) ?? (promptTokens !== null || completionTokens !== null ? (promptTokens || 0) + (completionTokens || 0) + (reasoningTokens || 0) : null);

      if (promptTokens !== null || completionTokens !== null || reasoningTokens !== null || totalTokens !== null) {
        return {
          completionTokens,
          promptTokens,
          reasoningTokens,
          source: "billing_meta",
          totalTokens,
        };
      }
    }
  }

  return empty;
}

function compactBillingMeta(meta: Record<string, any>) {
  const firstItem = Array.isArray(meta.items) ? meta.items[0] : null;
  return {
    count: toNumber(firstItem?.count),
    modelLabel: String(firstItem?.modelLabel || firstItem?.model || ""),
    pointsPerCall: toNumber(firstItem?.pointsPerCall),
    requiredPoints: toNumber(meta.requiredPoints || firstItem?.requiredPoints),
    taskType: String(firstItem?.taskType || ""),
  };
}

function normalizeTransaction(row: any, mode: AdminTaskBillingMode) {
  const billingMeta = parseMeta(row.billingMeta);
  return {
    amount: toNumber(row.amount),
    balanceAfter: toNumber(row.balanceAfter),
    billingMeta: mode === "detail" ? billingMeta : undefined,
    createdAt: toIso(row.createdAt),
    description: String(row.description || ""),
    freezeId: String(row.freezeId || ""),
    id: String(row.id || ""),
    projectId: row.projectId ?? null,
    relatedId: row.relatedId ?? null,
    taskType: String(row.taskType || ""),
    type: String(row.type || ""),
    userId: String(row.userId || ""),
  };
}

function normalizeHold(row: any, mode: AdminTaskBillingMode) {
  const billingMeta = parseMeta(row.billingMeta);
  return {
    amount: toNumber(row.amount),
    billingMeta: mode === "detail" ? billingMeta : undefined,
    createdAt: toIso(row.createdAt),
    description: String(row.description || ""),
    id: String(row.id || ""),
    projectId: row.projectId ?? null,
    relatedId: row.relatedId ?? null,
    releasedAt: toIso(row.releasedAt),
    settledAt: toIso(row.settledAt),
    status: String(row.status || ""),
    taskType: String(row.taskType || ""),
    userId: String(row.userId || ""),
  };
}

function sumBucketDeductions(rows: any[]) {
  return rows.reduce(
    (sum, row) => {
      const meta = parseMeta(row.billingMeta);
      const buckets = parseMeta(meta.pointDeduction?.bucketDeductions);
      return {
        bonus: sum.bonus + toNumber(buckets.bonus),
        membership: sum.membership + toNumber(buckets.membership),
        recharge: sum.recharge + toNumber(buckets.recharge),
      };
    },
    { bonus: 0, membership: 0, recharge: 0 },
  );
}

async function findTaskBilling(task: any, relatedObjectData: Record<string, any>, mode: AdminTaskBillingMode) {
  const taskTypes = taskTypeCandidates(task.taskClass, relatedObjectData);
  const relatedIds = relatedIdsForBilling(task.taskClass, relatedObjectData);
  const freezeIds = freezeIdsForBilling(relatedObjectData);
  const projectId = normalizeId(task.projectId);
  const userId = normalizeId(task.userId);

  if (!relatedIds.length && !freezeIds.length) {
    return {
      bucketDeductions: { bonus: 0, membership: 0, recharge: 0 },
      count: 0,
      frozenPoints: 0,
      holds: [],
      modelLabel: "",
      pointsPerCall: 0,
      relatedIds,
      releasedPoints: 0,
      requiredPoints: 0,
      settledPoints: 0,
      status: "unmatched",
      taskTypes,
      tokenUsage: extractTokenUsage(relatedObjectData),
      transactions: [],
    };
  }

  const buildBillingScope = (query: any) => {
    query.where((outer: any) => {
      let hasCondition = false;
      if (freezeIds.length) {
        outer.whereIn("freezeId", freezeIds).orWhereIn("id", freezeIds);
        hasCondition = true;
      }
      if (relatedIds.length) {
        const method = hasCondition ? "orWhere" : "where";
        outer[method]((inner: any) => {
          inner.whereIn("relatedId", relatedIds);
          if (taskTypes.length) inner.whereIn("taskType", taskTypes);
          if (projectId) inner.where("projectId", projectId);
          if (userId) inner.where("userId", userId);
        });
      }
    });
  };

  const buildHoldScope = (query: any) => {
    query.where((outer: any) => {
      let hasCondition = false;
      if (freezeIds.length) {
        outer.whereIn("id", freezeIds);
        hasCondition = true;
      }
      if (relatedIds.length) {
        const method = hasCondition ? "orWhere" : "where";
        outer[method]((inner: any) => {
          inner.whereIn("relatedId", relatedIds);
          if (taskTypes.length) inner.whereIn("taskType", taskTypes);
          if (projectId) inner.where("projectId", projectId);
          if (userId) inner.where("userId", userId);
        });
      }
    });
  };

  const [transactionRows, holdRows] = await Promise.all([
    db("balance_transactions")
      .select("id", "userId", "type", "amount", "balanceAfter", "description", "relatedId", "freezeId", "projectId", "episodeId", "taskType", "billingMeta", "createdAt")
      .modify(buildBillingScope)
      .orderBy("createdAt", "desc")
      .limit(20),
    db("point_holds")
      .select("id", "userId", "amount", "status", "description", "relatedId", "projectId", "episodeId", "taskType", "billingMeta", "createdAt", "settledAt", "releasedAt")
      .modify(buildHoldScope)
      .orderBy("createdAt", "desc")
      .limit(20),
  ]);

  const transactions: ReturnType<typeof normalizeTransaction>[] = (transactionRows as any[]).map((row: any) => normalizeTransaction(row, mode));
  const holds: ReturnType<typeof normalizeHold>[] = (holdRows as any[]).map((row: any) => normalizeHold(row, mode));
  const firstMeta = parseMeta(transactionRows[0]?.billingMeta || holdRows[0]?.billingMeta);
  const metaSummary = compactBillingMeta(firstMeta);
  const settledPoints = transactions.filter((item) => item.type === "model_consume" || item.amount < 0).reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const frozenPoints = holds.filter((item) => item.status === "frozen").reduce((sum, item) => sum + item.amount, 0);
  const releasedPoints = holds.filter((item) => item.status === "released").reduce((sum, item) => sum + item.amount, 0);

  return {
    bucketDeductions: sumBucketDeductions(transactionRows as any[]),
    count: metaSummary.count,
    frozenPoints,
    holds: mode === "detail" ? holds : [],
    modelLabel: metaSummary.modelLabel,
    pointsPerCall: metaSummary.pointsPerCall,
    relatedIds,
    releasedPoints,
    requiredPoints: metaSummary.requiredPoints || settledPoints || frozenPoints || releasedPoints,
    settledPoints,
    status: settledPoints > 0 ? "settled" : frozenPoints > 0 ? "frozen" : releasedPoints > 0 ? "released" : "unmatched",
    taskTypes,
    tokenUsage: extractTokenUsage(firstMeta, relatedObjectData),
    transactions: mode === "detail" ? transactions : [],
  };
}

function normalizeTask(row: any) {
  const relatedObjects = String(row.relatedObjects || "");
  const relatedObjectData = parseRelatedObjects(relatedObjects);
  const prompt = String(row.prompt || relatedObjectData.prompt || "");
  const negativePrompt = String(row.negativePrompt || relatedObjectData.negativePrompt || "");
  return {
    describe: String(row.describe || ""),
    hasNegativePrompt: negativePrompt.trim().length > 0,
    hasPrompt: prompt.trim().length > 0,
    id: row.id,
    model: String(row.model || ""),
    negativePrompt,
    projectId: row.projectId ?? null,
    projectName: String(row.projectName || ""),
    prompt,
    reason: String(row.reason || ""),
    relatedObjects,
    startTime: row.startTime ?? null,
    state: String(row.state || ""),
    taskClass: String(row.taskClass || ""),
    userId: row.userId ?? null,
    userName: String(row.userRealName || row.userName || ""),
    username: String(row.userName || ""),
  };
}

async function normalizeTaskWithBilling(row: any, mode: AdminTaskBillingMode = "summary") {
  const task = normalizeTask(row);
  const relatedObjectData = parseRelatedObjects(task.relatedObjects);
  return {
    ...task,
    billing: await findTaskBilling(task, relatedObjectData, mode),
  };
}

async function countTasks(filters: AdminTaskFilters, mutate?: (query: any) => void) {
  const query = applyTaskFilters(createTaskQuery(), filters);
  if (mutate) mutate(query);
  const row = await query.count({ total: "o_tasks.id" }).first();
  return countValue(row);
}

async function countPromptRecords(filters: AdminTaskFilters, column: "negativePrompt" | "prompt") {
  return countTasks(filters, (query) => {
    query.andWhere((qb: any) => {
      qb.whereNotNull(`o_tasks.${column}`).whereNot(`o_tasks.${column}`, "").orWhere("o_tasks.relatedObjects", "like", `%"${column}"%`);
    });
  });
}

async function bucketBy(filters: AdminTaskFilters, column: string, limit = 10): Promise<AdminTaskBucket[]> {
  const rows = await applyTaskFilters(createTaskQuery(), filters)
    .select(db.raw("?? as ??", [column, "name"]))
    .count({ count: "o_tasks.id" })
    .whereNotNull(column)
    .whereNot(column, "")
    .groupBy(column)
    .orderBy("count", "desc")
    .limit(limit);

  return rows.map((row: any) => ({
    count: countValue(row),
    name: String(row.name || ""),
  }));
}

export function parseAdminTaskListParams(query: Record<string, unknown>): AdminTaskListParams {
  return {
    keyword: cleanText(query.keyword),
    page: toPositiveNumber(query.page, 1),
    pageSize: toPositiveNumber(query.pageSize, 20, 100),
    projectId: cleanText(query.projectId),
    startFrom: toOptionalTimestamp(query.startFrom),
    startTo: toOptionalTimestamp(query.startTo),
    state: cleanText(query.state),
    taskClass: cleanText(query.taskClass),
    userId: cleanText(query.userId),
  };
}

export async function getAdminTaskList(params: AdminTaskListParams) {
  const page = toPositiveNumber(params.page, 1);
  const pageSize = toPositiveNumber(params.pageSize, 20, 100);
  const offset = (page - 1) * pageSize;
  const filters: AdminTaskFilters = {
    keyword: params.keyword,
    projectId: params.projectId,
    startFrom: params.startFrom,
    startTo: params.startTo,
    state: params.state,
    taskClass: params.taskClass,
    userId: params.userId,
  };

  const dataQuery = applyTaskFilters(createTaskQuery(), filters)
    .select(taskColumns())
    .orderBy("o_tasks.id", "desc")
    .offset(offset)
    .limit(pageSize);

  const [rows, total, stateBuckets, taskClassBuckets, modelBuckets, withPrompt, withNegativePrompt] = await Promise.all([
    dataQuery,
    countTasks(filters),
    bucketBy(filters, "o_tasks.state", 8),
    bucketBy(filters, "o_tasks.taskClass", 12),
    bucketBy(filters, "o_tasks.model", 12),
    countPromptRecords(filters, "prompt"),
    countPromptRecords(filters, "negativePrompt"),
  ]);

  const countByState = (state: string) => stateBuckets.find((item: AdminTaskBucket) => item.name === state)?.count || 0;

  const list = await Promise.all(rows.map((row: any) => normalizeTaskWithBilling(row, "summary")));

  return {
    list,
    page,
    pageSize,
    statistics: {
      completed: countByState("已完成"),
      failed: countByState("生成失败"),
      running: countByState("进行中"),
      successRate: total > 0 ? Math.round((countByState("已完成") / total) * 1000) / 10 : 0,
      total,
      withNegativePrompt,
      withPrompt,
    },
    taskClassBuckets,
    modelBuckets,
    stateBuckets,
    total,
  };
}

export async function getAdminTaskDetail(id: number) {
  const row = await createTaskQuery().select(taskColumns()).where("o_tasks.id", id).first();
  return row ? normalizeTaskWithBilling(row, "detail") : null;
}

export async function getAdminTaskOptions() {
  const [taskClasses, states, projects, users] = await Promise.all([
    db("o_tasks").distinct("taskClass as value").whereNotNull("taskClass").whereNot("taskClass", "").orderBy("taskClass", "asc"),
    db("o_tasks").distinct("state as value").whereNotNull("state").whereNot("state", "").orderBy("state", "asc"),
    db("o_tasks")
      .leftJoin("o_project", "o_project.id", "o_tasks.projectId")
      .distinct("o_project.id as value", "o_project.name as label")
      .whereNotNull("o_project.id")
      .whereNotNull("o_project.name")
      .whereNot("o_project.name", "")
      .orderBy("o_project.name", "asc"),
    db("o_tasks")
      .leftJoin("o_project", "o_project.id", "o_tasks.projectId")
      .leftJoin("o_user", "o_user.id", "o_project.userId")
      .distinct("o_project.userId as value", "o_user.name as username", "o_user.realName as realName")
      .whereNotNull("o_project.userId")
      .orderBy("o_project.userId", "asc"),
  ]);

  return {
    projects: projects.map((item: any) => ({ label: String(item.label || `项目 ${item.value}`), value: String(item.value) })),
    states: states.map((item: any) => ({ label: String(item.value), value: String(item.value) })),
    taskClasses: taskClasses.map((item: any) => ({ label: String(item.value), value: String(item.value) })),
    users: users.map((item: any) => ({
      label: String(item.realName || item.username || `用户 ${item.value}`),
      value: String(item.value),
    })),
  };
}
