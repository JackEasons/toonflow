import { v4 as uuid } from "uuid";
import type { Knex } from "knex";
import db, { db as knexDb } from "@/utils/db";
import * as vendor from "@/utils/vendor";
import { ensureUserMembership } from "@/utils/membership";

export type ModelBillingCall = {
  audio?: boolean;
  count?: number;
  duration?: number;
  model: string;
  modelType?: string;
  resolution?: string;
  taskType?: string;
};

export type ModelBillingQuoteItem = {
  count: number;
  enabled: boolean;
  model: string;
  modelLabel: string;
  modelName: string;
  modelType: string;
  pointsPerCall: number;
  requiredPoints: number;
  vendorId: string;
  vendorName: string;
};

export type ModelBillingQuote = {
  availablePoints: number;
  enough: boolean;
  frozenPoints: number;
  items: ModelBillingQuoteItem[];
  requiredPoints: number;
  totalPoints: number;
};

type BillingRuleInput = {
  enabled?: boolean;
  modelLabel?: string;
  modelName: string;
  modelType?: string;
  pointsPerCall?: number;
  pricingMeta?: unknown;
  vendorId: string;
};

type PointHold = {
  amount: number;
  billingMeta?: string | null;
  description?: string | null;
  episodeId?: string | null;
  id: string;
  idempotencyKey?: string | null;
  projectId?: string | null;
  relatedId?: string | null;
  status: string;
  taskType?: string | null;
  userId: string;
};

const logicalAiTypes = new Set([
  "scriptAgent",
  "productionAgent",
  "universalAi",
  "scriptAgent:decisionAgent",
  "scriptAgent:supervisionAgent",
  "scriptAgent:storySkeletonAgent",
  "scriptAgent:adaptationStrategyAgent",
  "scriptAgent:scriptAgent",
  "productionAgent:decisionAgent",
  "productionAgent:supervisionAgent",
  "productionAgent:deriveAssetsAgent",
  "productionAgent:generateAssetsAgent",
  "productionAgent:directorPlanAgent",
  "productionAgent:storyboardGenAgent",
  "productionAgent:storyboardPanelAgent",
  "productionAgent:storyboardTableAgent",
]);

const billingRulesTable = (trx: Knex | typeof db = db) => (trx as any)("model_billing_rules");
const pointHoldsTable = (trx: Knex | typeof db = db) => (trx as any)("point_holds");
const balanceTransactionsTable = (trx: Knex | typeof db = db) => (trx as any)("balance_transactions");
const userBalancesTable = (trx: Knex | typeof db = db) => (trx as any)("user_balances");

function now() {
  return new Date();
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function roundPoints(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value * 1_000_000) / 1_000_000);
}

function normalizeCount(value: unknown): number {
  if (value === null || value === undefined || value === "") return 1;
  const count = Math.floor(toNumber(value));
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

function splitModelId(model: string) {
  const value = String(model || "");
  const separatorIndex = value.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) throw new Error("模型参数无效");
  return {
    modelName: value.slice(separatorIndex + 1),
    vendorId: value.slice(0, separatorIndex),
  };
}

function boolFromDb(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

export function isVendorModelEnabled(model: Record<string, unknown>): boolean {
  if (boolFromDb(model.disabled)) return false;
  const raw = model.enabled ?? model.enable;
  if (raw === undefined || raw === null || raw === "") return true;
  return boolFromDb(raw);
}

function stringifyMeta(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function parseMetaObject(value: unknown): Record<string, any> {
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

function mergeMeta(existing: unknown, patch?: unknown): string | null {
  const patchData = parseMetaObject(patch);
  if (!Object.keys(patchData).length) return stringifyMeta(existing);
  return stringifyMeta({
    ...parseMetaObject(existing),
    ...patchData,
  });
}

function normalizeUsageNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

async function resolveUsage(value: unknown) {
  if (!value) return null;
  const awaited = typeof (value as any)?.then === "function" ? await value : value;
  const source = (awaited as any)?.totalUsage || (awaited as any)?.usage || awaited;
  const usage = typeof (source as any)?.then === "function" ? await source : source;
  if (!usage || typeof usage !== "object") return null;

  const promptTokens = normalizeUsageNumber((usage as any).promptTokens ?? (usage as any).prompt_tokens ?? (usage as any).inputTokens ?? (usage as any).input_tokens);
  const completionTokens = normalizeUsageNumber((usage as any).completionTokens ?? (usage as any).completion_tokens ?? (usage as any).outputTokens ?? (usage as any).output_tokens);
  const reasoningTokens = normalizeUsageNumber((usage as any).reasoningTokens ?? (usage as any).reasoning_tokens ?? (usage as any).outputTokenDetails?.reasoningTokens);
  const cachedInputTokens = normalizeUsageNumber((usage as any).cachedInputTokens ?? (usage as any).cached_input_tokens ?? (usage as any).inputTokenDetails?.cacheReadTokens);
  const totalTokens =
    normalizeUsageNumber((usage as any).totalTokens ?? (usage as any).total_tokens) ??
    (promptTokens !== undefined || completionTokens !== undefined ? roundPoints((promptTokens || 0) + (completionTokens || 0) + (reasoningTokens || 0)) : undefined);

  if (promptTokens === undefined && completionTokens === undefined && reasoningTokens === undefined && totalTokens === undefined && cachedInputTokens === undefined) return null;

  return {
    cachedInputTokens,
    completionTokens,
    promptTokens,
    reasoningTokens,
    totalTokens,
  };
}

function deductBuckets(current: any, amount: number) {
  const values = {
    bonusPoints: toNumber(current.bonusPoints),
    membershipPoints: toNumber(current.membershipPoints),
    rechargePoints: toNumber(current.rechargePoints),
  };
  const orderedColumns = ["bonusPoints", "rechargePoints", "membershipPoints"] as Array<keyof typeof values>;

  let remaining = amount;
  for (const column of orderedColumns) {
    const used = Math.min(values[column], remaining);
    values[column] = roundPoints(values[column] - used);
    remaining = roundPoints(remaining - used);
    if (remaining <= 0) break;
  }

  if (remaining > 0) throw new Error("用户积分不足");
  return values;
}

export async function updatePointHoldBillingMeta(holdId?: null | string, patch?: unknown) {
  if (!holdId || patch === null || patch === undefined) return;
  const current = await pointHoldsTable().select("billingMeta").where("id", holdId).first();
  if (!current) return;
  await pointHoldsTable().where("id", holdId).update({
    billingMeta: mergeMeta(current.billingMeta, patch),
    updatedAt: now(),
  });
}

export async function recordPointHoldModelUsage(holdId?: null | string, result?: unknown, extraMeta?: Record<string, unknown>) {
  const tokenUsage = await resolveUsage(result);
  if (!tokenUsage) return;
  await updatePointHoldBillingMeta(holdId, {
    ...(extraMeta || {}),
    tokenUsage,
    usage: tokenUsage,
    usageRecordedAt: now().toISOString(),
    usageSource: "ai-sdk",
  });
}

export async function resolveModelBillingKey(modelKey: string): Promise<string> {
  const key = String(modelKey || "").trim();
  if (!logicalAiTypes.has(key)) return key;

  const agentUseModeVal = await db("o_setting").where("key", "agentUseMode").first();
  if (agentUseModeVal?.value === "1") {
    const agentDeployData = await db("o_agentDeploy").where("key", key).first();
    if (!agentDeployData?.modelName) throw new Error(`高级配置模式下，未找到对应的模型配置 ${key}`);
    return String(agentDeployData.modelName);
  }

  if (agentUseModeVal?.value === "0") {
    const [mainly] = key.split(/:(.+)/);
    const mainlyData = await db("o_agentDeploy").where("key", mainly).first();
    if (!mainlyData?.modelName) throw new Error(`简易配置模式下，未找到部署配置 ${key}`);
    return String(mainlyData.modelName);
  }

  const agentDeployData = await db("o_agentDeploy").where("key", key).first();
  if (agentDeployData?.modelName) return String(agentDeployData.modelName);

  const [mainly] = key.split(/:(.+)/);
  const mainlyData = await db("o_agentDeploy").where("key", mainly).first();
  if (!mainlyData?.modelName) throw new Error(`未找到部署配置 ${key}`);
  return String(mainlyData.modelName);
}

export async function listModelBillingRules() {
  const vendorRows = await db("o_vendorConfig").select("id", "enable").where("enable", 1).orderBy("id", "asc");
  const rules = await billingRulesTable().select("*");
  const ruleMap = new Map<string, any>();
  for (const rule of rules) {
    ruleMap.set(`${rule.vendorId}:${rule.modelName}`, rule);
  }

  const models = [];
  for (const row of vendorRows) {
    let vendorName = String(row.id);
    let modelList: any[] = [];
    try {
      const vendorData = vendor.getVendor(String(row.id));
      vendorName = vendorData?.name || vendorName;
      modelList = await vendor.getModelList(String(row.id));
    } catch {
      modelList = [];
    }

    for (const model of modelList.filter(isVendorModelEnabled)) {
      const rule = ruleMap.get(`${row.id}:${model.modelName}`);
      models.push({
        enabled: rule ? boolFromDb(rule.enabled) : false,
        model: `${row.id}:${model.modelName}`,
        modelLabel: rule?.modelLabel || model.name || model.modelName,
        modelName: model.modelName,
        modelType: rule?.modelType || model.type || "text",
        pointsPerCall: rule ? toNumber(rule.pointsPerCall) : 0,
        pricingMeta: rule?.pricingMeta || null,
        ruleId: rule?.id || null,
        vendorEnabled: boolFromDb(row.enable),
        vendorId: String(row.id),
        vendorName,
      });
    }
  }

  return {
    models,
    summary: {
      billableModels: models.filter((item) => item.enabled && item.pointsPerCall > 0).length,
      models: models.length,
      vendors: vendorRows.length,
    },
  };
}

export async function saveModelBillingRules(rules: BillingRuleInput[]) {
  const currentTime = now();
  for (const input of rules) {
    const vendorId = String(input.vendorId || "").trim();
    const modelName = String(input.modelName || "").trim();
    if (!vendorId || !modelName) throw new Error("模型计费规则缺少模型标识");

    const payload = {
      enabled: input.enabled !== false,
      modelLabel: input.modelLabel ? String(input.modelLabel) : modelName,
      modelName,
      modelType: input.modelType ? String(input.modelType) : "text",
      pointsPerCall: roundPoints(toNumber(input.pointsPerCall)),
      pricingMeta: stringifyMeta(input.pricingMeta),
      updatedAt: currentTime,
      vendorId,
    };

    const existing = await billingRulesTable().where({ vendorId, modelName }).first();
    if (existing) {
      await billingRulesTable().where({ id: existing.id }).update(payload);
    } else {
      await billingRulesTable().insert({
        id: uuid(),
        ...payload,
        createdAt: currentTime,
      });
    }
  }
  return listModelBillingRules();
}

async function getRuleMapForCalls(calls: ModelBillingCall[]) {
  const keys = calls.map((call) => splitModelId(call.model));
  const rules = await billingRulesTable().where((builder: any) => {
    keys.forEach(({ vendorId, modelName }, index) => {
      const method = index === 0 ? "where" : "orWhere";
      builder[method]({ vendorId, modelName });
    });
  });
  const ruleMap = new Map<string, any>();
  for (const rule of rules) {
    ruleMap.set(`${rule.vendorId}:${rule.modelName}`, rule);
  }
  return ruleMap;
}

async function resolveActiveModel(modelId: string) {
  const { vendorId, modelName } = splitModelId(modelId);
  const vendorRow = await db("o_vendorConfig").select("id", "enable").where("id", vendorId).first();
  if (!vendorRow || !boolFromDb(vendorRow.enable)) throw new Error("模型供应商不存在或未启用");

  let vendorName = vendorId;
  let modelList: any[] = [];
  try {
    const vendorData = vendor.getVendor(vendorId);
    vendorName = vendorData?.name || vendorName;
    modelList = await vendor.getModelList(vendorId);
  } catch {
    throw new Error("模型供应商配置不可用");
  }

  const model = modelList.find((item) => item?.modelName === modelName && isVendorModelEnabled(item));
  if (!model) throw new Error("模型不存在或未启用");

  return {
    model,
    modelName,
    vendorId,
    vendorName,
  };
}

export async function quoteModelCalls(userId: string | null | undefined, calls: ModelBillingCall[]): Promise<ModelBillingQuote> {
  const normalizedCalls = calls.filter((call) => normalizeCount(call?.count) > 0);
  for (const call of normalizedCalls) {
    if (!String(call?.model || "").trim()) throw new Error("模型参数无效");
  }
  const ruleMap = normalizedCalls.length ? await getRuleMapForCalls(normalizedCalls) : new Map<string, any>();

  const items: ModelBillingQuoteItem[] = [];
  for (const call of normalizedCalls) {
    const { model, modelName, vendorId, vendorName } = await resolveActiveModel(call.model);
    const rule = ruleMap.get(`${vendorId}:${modelName}`);
    const count = normalizeCount(call.count);
    const pointsPerCall = rule && boolFromDb(rule.enabled) ? roundPoints(toNumber(rule.pointsPerCall)) : 0;

    items.push({
      count,
      enabled: rule ? boolFromDb(rule.enabled) : false,
      model: call.model,
      modelLabel: rule?.modelLabel || model.name || modelName,
      modelName,
      modelType: rule?.modelType || model.type || call.modelType || "text",
      pointsPerCall,
      requiredPoints: roundPoints(pointsPerCall * count),
      vendorId,
      vendorName,
    });
  }

  let totalPoints = 0;
  let frozenPoints = 0;
  if (userId) {
    await ensureUserMembership(String(userId), false);
    const balance = await userBalancesTable().where("userId", String(userId)).first();
    totalPoints = toNumber(balance?.balance);
    frozenPoints = toNumber(balance?.frozenAmount);
  }

  const requiredPoints = roundPoints(items.reduce((sum, item) => sum + item.requiredPoints, 0));
  const availablePoints = Math.max(0, roundPoints(totalPoints - frozenPoints));
  return {
    availablePoints,
    enough: requiredPoints <= availablePoints,
    frozenPoints,
    items,
    requiredPoints,
    totalPoints,
  };
}

export async function reserveModelCallPoints(params: {
  billingMeta?: unknown;
  description?: string;
  episodeId?: string | number | null;
  idempotencyKey: string;
  projectId?: string | number | null;
  quote: ModelBillingQuote;
  relatedId?: string | number | null;
  taskType?: string | null;
  userId: string;
}): Promise<PointHold | null> {
  const amount = roundPoints(params.quote.requiredPoints);
  if (amount <= 0) return null;

  await ensureUserMembership(params.userId, false);
  return await knexDb.transaction(async (trx: Knex) => {
    const existing = await pointHoldsTable(trx).where("idempotencyKey", params.idempotencyKey).first();
    if (existing) {
      const status = String(existing.status || "");
      if (status === "frozen" || status === "settled") return existing as PointHold;
      throw new Error("该模型调用冻结记录已释放，请重新发起生成");
    }

    const current = await userBalancesTable(trx).where("userId", params.userId).forUpdate().first();
    if (!current) throw new Error("用户积分账户不存在");

    const balance = toNumber(current.balance);
    const frozen = toNumber(current.frozenAmount);
    const available = roundPoints(balance - frozen);
    if (available < amount) {
      throw new Error(`积分不足，需要 ${amount} 积分，当前可用 ${Math.max(0, available)} 积分`);
    }

    const hold: PointHold = {
      amount,
      billingMeta: stringifyMeta(params.billingMeta ?? params.quote),
      description: params.description || `模型调用冻结 ${amount} 积分`,
      episodeId: params.episodeId === null || params.episodeId === undefined ? null : String(params.episodeId),
      id: uuid(),
      idempotencyKey: params.idempotencyKey,
      projectId: params.projectId === null || params.projectId === undefined ? null : String(params.projectId),
      relatedId: params.relatedId === null || params.relatedId === undefined ? null : String(params.relatedId),
      status: "frozen",
      taskType: params.taskType || null,
      userId: params.userId,
    };

    await userBalancesTable(trx).where("userId", params.userId).update({
      frozenAmount: roundPoints(frozen + amount),
      updatedAt: now(),
    });
    await pointHoldsTable(trx).insert({
      ...hold,
      createdAt: now(),
      releasedAt: null,
      settledAt: null,
      updatedAt: now(),
    });
    return hold;
  });
}

export async function settlePointHold(holdId?: null | string, billingMetaPatch?: unknown) {
  if (!holdId) return;
  await knexDb.transaction(async (trx: Knex) => {
    const hold = (await pointHoldsTable(trx).where("id", holdId).forUpdate().first()) as PointHold | undefined;
    if (!hold || hold.status !== "frozen") return;

    const current = await userBalancesTable(trx).where("userId", hold.userId).forUpdate().first();
    if (!current) throw new Error("用户积分账户不存在");

    const amount = roundPoints(toNumber(hold.amount));
    const frozen = toNumber(current.frozenAmount);
    const nextBreakdown = deductBuckets(current, amount);
    const nextBalance = roundPoints(nextBreakdown.membershipPoints + nextBreakdown.rechargePoints + nextBreakdown.bonusPoints);
    const bucketDeductions = {
      bonus: roundPoints(toNumber(current.bonusPoints) - nextBreakdown.bonusPoints),
      membership: roundPoints(toNumber(current.membershipPoints) - nextBreakdown.membershipPoints),
      recharge: roundPoints(toNumber(current.rechargePoints) - nextBreakdown.rechargePoints),
    };
    const billingMeta = mergeMeta(hold.billingMeta, {
      ...parseMetaObject(billingMetaPatch),
      pointDeduction: {
        balanceAfter: nextBalance,
        balanceBefore: toNumber(current.balance),
        bucketDeductions,
      },
    });

    await userBalancesTable(trx).where("userId", hold.userId).update({
      balance: nextBalance,
      bonusPoints: nextBreakdown.bonusPoints,
      frozenAmount: Math.max(0, roundPoints(frozen - amount)),
      membershipPoints: nextBreakdown.membershipPoints,
      rechargePoints: nextBreakdown.rechargePoints,
      totalSpent: roundPoints(toNumber(current.totalSpent) + amount),
      updatedAt: now(),
    });
    await balanceTransactionsTable(trx).insert({
      amount: -amount,
      balanceAfter: nextBalance,
      billingMeta,
      createdAt: now(),
      description: hold.description || `模型调用消耗 ${amount} 积分`,
      episodeId: hold.episodeId || null,
      freezeId: hold.id,
      id: uuid(),
      idempotencyKey: `consume:${hold.id}`,
      projectId: hold.projectId || null,
      relatedId: hold.relatedId || null,
      taskType: hold.taskType || null,
      type: "model_consume",
      userId: hold.userId,
    });
    await pointHoldsTable(trx).where("id", hold.id).update({
      billingMeta,
      settledAt: now(),
      status: "settled",
      updatedAt: now(),
    });
  });
}

export async function settlePointHoldWithModelUsage(holdId?: null | string, result?: unknown, extraMeta?: Record<string, unknown>) {
  await recordPointHoldModelUsage(holdId, result, extraMeta);
  await settlePointHold(holdId);
}

export async function releasePointHold(holdId?: null | string) {
  if (!holdId) return;
  await knexDb.transaction(async (trx: Knex) => {
    const hold = (await pointHoldsTable(trx).where("id", holdId).forUpdate().first()) as PointHold | undefined;
    if (!hold || hold.status !== "frozen") return;

    const current = await userBalancesTable(trx).where("userId", hold.userId).forUpdate().first();
    if (current) {
      await userBalancesTable(trx).where("userId", hold.userId).update({
        frozenAmount: Math.max(0, roundPoints(toNumber(current.frozenAmount) - toNumber(hold.amount))),
        updatedAt: now(),
      });
    }
    await pointHoldsTable(trx).where("id", hold.id).update({
      releasedAt: now(),
      status: "released",
      updatedAt: now(),
    });
  });
}

export async function releasePointHoldsByRelatedId(params: {
  relatedId: string | number;
  taskTypes?: string[];
  userId?: string | number | null;
}) {
  const relatedId = String(params.relatedId);
  const query = pointHoldsTable().select("id").where({ relatedId, status: "frozen" });
  if (params.taskTypes?.length) query.whereIn("taskType", params.taskTypes);
  if (params.userId !== null && params.userId !== undefined && params.userId !== "") query.where("userId", String(params.userId));

  const holds = (await query) as Array<{ id: string }>;
  await Promise.all(holds.map((hold) => releasePointHold(hold.id)));
  return holds.length;
}
