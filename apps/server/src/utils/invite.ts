import type { Request } from "express";
import type { Knex } from "knex";
import crypto from "node:crypto";
import { v4 as uuid } from "uuid";

import db, { db as knexDb } from "@/utils/db";
import { isAdminUser } from "@/utils/admin";

export type InviteStatus = "approved" | "disabled" | "pending" | "rejected";

const DEFAULT_INVITE_RULES = {
  dailyLimit: 5,
  ipDailyLimit: 2,
  maxUses: 20,
};

const INVITE_RULE_LIMITS = {
  dailyLimit: 20,
  ipDailyLimit: 5,
  maxUses: 100,
  textLength: 500,
};

const GLOBAL_INVITE_IP_DAILY_LIMIT = 5;

function now() {
  return new Date();
}

function startOfToday() {
  const date = now();
  date.setHours(0, 0, 0, 0);
  return date;
}

function normalizeInviteCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function clientIp(req: Request) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  return String(firstForwarded || req.ip || req.socket.remoteAddress || "")
    .split(",")[0]
    .trim()
    .slice(0, 128);
}

function userAgent(req: Request) {
  return String(req.headers["user-agent"] || "").slice(0, 1000);
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function sanitizeText(value: unknown) {
  return String(value || "").trim().slice(0, INVITE_RULE_LIMITS.textLength);
}

function clampRule(value: unknown, fallback: number, max: number) {
  const numeric = Math.floor(toNumber(value, fallback));
  return Math.min(max, Math.max(1, numeric || fallback));
}

function toIso(value: unknown): null | string {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function makeInviteCode() {
  return `DS${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

async function createUniqueInviteCode(trx: Knex.Transaction | typeof db) {
  for (let index = 0; index < 8; index += 1) {
    const code = makeInviteCode();
    const exists = await trx("invite_codes").where("code", code).first();
    if (!exists) return code;
  }
  throw new Error("邀请码生成失败，请重试");
}

async function findUser(userId: string) {
  return await db("o_user").where("id", userId).first();
}

export function isInviteOwnerAllowed(user: any) {
  return user && !isAdminUser(user);
}

export function inviteRegisterPath(code: string) {
  return `/#/login?mode=register&inviteCode=${encodeURIComponent(code)}`;
}

export function normalizeInviteRow(row: any, owner?: any, reviewer?: any) {
  const code = normalizeInviteCode(row?.code);
  return {
    code,
    createdAt: toIso(row?.createdAt),
    dailyLimit: toNumber(row?.dailyLimit, DEFAULT_INVITE_RULES.dailyLimit),
    disabled: Boolean(row?.disabled) || row?.status === "disabled",
    generatedAt: toIso(row?.generatedAt),
    id: String(row?.id || ""),
    invitePath: code ? inviteRegisterPath(code) : "",
    ipDailyLimit: toNumber(row?.ipDailyLimit, DEFAULT_INVITE_RULES.ipDailyLimit),
    maxUses: toNumber(row?.maxUses, DEFAULT_INVITE_RULES.maxUses),
    owner: owner
      ? {
          id: String(owner.id || ""),
          name: String(owner.name || ""),
          realName: String(owner.realName || owner.name || ""),
        }
      : undefined,
    requestReason: String(row?.requestReason || ""),
    reviewNote: String(row?.reviewNote || ""),
    reviewedAt: toIso(row?.reviewedAt),
    reviewer: reviewer
      ? {
          id: String(reviewer.id || ""),
          name: String(reviewer.name || ""),
        }
      : undefined,
    status: String(row?.status || "pending") as InviteStatus,
    updatedAt: toIso(row?.updatedAt),
    useCount: toNumber(row?.useCount),
    userId: String(row?.userId || ""),
  };
}

async function invitedUsers(userId: string) {
  const rows = await db("o_user")
    .leftJoin("invite_registrations as registration", "registration.inviteeUserId", "o_user.id")
    .select("o_user.id", "o_user.name", "o_user.realName", "o_user.avatar", "o_user.inviteCode", "registration.createdAt as registeredAt")
    .where("invitedByUserId", userId)
    .orderBy("registration.createdAt", "desc")
    .orderBy("o_user.id", "desc");

  return rows.map((row: any) => ({
    avatar: String(row.avatar || ""),
    id: String(row.id || ""),
    inviteCode: normalizeInviteCode(row.inviteCode),
    name: String(row.name || ""),
    registeredAt: toIso(row.registeredAt),
    realName: String(row.realName || row.name || ""),
  }));
}

async function getInviteUsageStats(inviteIds: string[]) {
  const stats = new Map<
    string,
    {
      lastRegisteredAt: null | string;
      todayMaxIpUses: number;
      todayUses: number;
      uniqueIpCount: number;
    }
  >();
  const ids = inviteIds.filter(Boolean);
  if (ids.length === 0) return stats;

  const dayStart = startOfToday();
  const rows = await db("invite_registrations")
    .select("inviteCodeId", "ipAddress", "createdAt")
    .whereIn("inviteCodeId", ids)
    .orderBy("createdAt", "desc");

  const ipSets = new Map<string, Set<string>>();
  const todayIpCounts = new Map<string, Map<string, number>>();
  for (const id of ids) {
    stats.set(id, {
      lastRegisteredAt: null,
      todayMaxIpUses: 0,
      todayUses: 0,
      uniqueIpCount: 0,
    });
    ipSets.set(id, new Set());
    todayIpCounts.set(id, new Map());
  }

  for (const row of rows as any[]) {
    const inviteId = String(row.inviteCodeId || "");
    const item = stats.get(inviteId);
    if (!item) continue;

    const createdAt = row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt || ""));
    if (!item.lastRegisteredAt) item.lastRegisteredAt = toIso(createdAt);

    const ip = String(row.ipAddress || "").trim();
    if (ip) ipSets.get(inviteId)?.add(ip);

    if (!Number.isNaN(createdAt.getTime()) && createdAt >= dayStart) {
      item.todayUses += 1;
      if (ip) {
        const ipCounts = todayIpCounts.get(inviteId);
        const nextCount = (ipCounts?.get(ip) || 0) + 1;
        ipCounts?.set(ip, nextCount);
        item.todayMaxIpUses = Math.max(item.todayMaxIpUses, nextCount);
      }
    }
  }

  for (const [inviteId, item] of stats.entries()) {
    item.uniqueIpCount = ipSets.get(inviteId)?.size || 0;
  }

  return stats;
}

function getInviteRisk(item: ReturnType<typeof normalizeInviteRow> & {
  lastRegisteredAt: null | string;
  remainingUses: number;
  todayMaxIpUses: number;
  todayUses: number;
  uniqueIpCount: number;
}) {
  const active = item.status === "approved" && !item.disabled && Boolean(item.code);
  if (!active) return { riskLevel: "normal" as const, riskReasons: [] as string[] };

  const dangerReasons: string[] = [];
  const warningReasons: string[] = [];

  if (item.remainingUses <= 0) {
    dangerReasons.push("总注册上限已用尽");
  } else if (item.remainingUses <= Math.max(1, Math.ceil(item.maxUses * 0.1))) {
    warningReasons.push("总注册余量偏低");
  }

  if (item.dailyLimit > 0 && item.todayUses >= item.dailyLimit) {
    dangerReasons.push("今日注册已达上限");
  } else if (item.dailyLimit > 0 && item.todayUses >= Math.max(1, Math.ceil(item.dailyLimit * 0.8))) {
    warningReasons.push("今日注册接近上限");
  }

  if (item.ipDailyLimit > 0 && item.todayMaxIpUses >= item.ipDailyLimit) {
    dangerReasons.push("单 IP 注册已达上限");
  } else if (item.ipDailyLimit > 0 && item.todayMaxIpUses >= Math.max(1, Math.ceil(item.ipDailyLimit * 0.8))) {
    warningReasons.push("单 IP 注册接近上限");
  }

  if (item.useCount >= 3 && item.uniqueIpCount <= 1) {
    warningReasons.push("注册来源 IP 过于集中");
  }

  if (dangerReasons.length > 0) return { riskLevel: "danger" as const, riskReasons: [...dangerReasons, ...warningReasons] };
  if (warningReasons.length > 0) return { riskLevel: "warning" as const, riskReasons: warningReasons };
  return { riskLevel: "normal" as const, riskReasons: [] as string[] };
}

export async function getMyInviteProfile(userId: string) {
  const user = await findUser(userId);
  if (!user) throw new Error("用户不存在");

  const invite = await db("invite_codes").where("userId", userId).first();
  return {
    canRequest: isInviteOwnerAllowed(user),
    invite: invite ? normalizeInviteRow(invite) : null,
    invitedUsers: await invitedUsers(userId),
    isAdmin: isAdminUser(user),
    rules: {
      ...DEFAULT_INVITE_RULES,
      globalIpDailyLimit: GLOBAL_INVITE_IP_DAILY_LIMIT,
    },
  };
}

export async function requestInviteCode(userId: string, reason = "") {
  const user = await findUser(userId);
  if (!user) throw new Error("用户不存在");
  if (!isInviteOwnerAllowed(user)) throw new Error("admin 账号不支持申请邀请码");

  const existing = await db("invite_codes").where("userId", userId).first();
  if (existing && ["approved", "disabled", "pending"].includes(String(existing.status))) {
    return normalizeInviteRow(existing);
  }

  if (existing) {
    await db("invite_codes").where("id", existing.id).update({
      requestReason: sanitizeText(reason),
      reviewNote: "",
      reviewedAt: null,
      reviewerId: null,
      status: "pending",
      updatedAt: now(),
    });
    return normalizeInviteRow(await db("invite_codes").where("id", existing.id).first());
  }

  const id = uuid();
  await db("invite_codes").insert({
    id,
    userId,
    code: null,
    status: "pending",
    disabled: false,
    useCount: 0,
    ...DEFAULT_INVITE_RULES,
    requestReason: sanitizeText(reason),
    reviewNote: "",
    reviewerId: null,
    createdAt: now(),
    updatedAt: now(),
  });
  return normalizeInviteRow(await db("invite_codes").where("id", id).first());
}

export async function generateMyInviteCode(userId: string) {
  const user = await findUser(userId);
  if (!user) throw new Error("用户不存在");
  if (!isInviteOwnerAllowed(user)) throw new Error("admin 账号不支持生成邀请码");

  return await knexDb.transaction(async (trx) => {
    const invite = await trx("invite_codes").where("userId", userId).forUpdate().first();
    if (!invite) throw new Error("请先申请邀请码");
    if (invite.status !== "approved" || invite.disabled) throw new Error("邀请码申请尚未通过");
    if (invite.code) return normalizeInviteRow(invite);

    const code = await createUniqueInviteCode(trx);
    await trx("invite_codes").where("id", invite.id).update({
      code,
      generatedAt: now(),
      updatedAt: now(),
    });
    return normalizeInviteRow(await trx("invite_codes").where("id", invite.id).first());
  });
}

export async function listAdminInvites(params: { keyword?: string; page?: number; pageSize?: number; status?: string }) {
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize || 20)));
  const keyword = String(params.keyword || "").trim().toLowerCase();
  const status = String(params.status || "").trim();

  const rows = await db("invite_codes as invite")
    .leftJoin("o_user as owner", "owner.id", "invite.userId")
    .leftJoin("o_user as reviewer", "reviewer.id", "invite.reviewerId")
    .select(
      "invite.*",
      "owner.name as ownerName",
      "owner.realName as ownerRealName",
      "owner.role as ownerRole",
      "reviewer.name as reviewerName",
    )
    .orderBy("invite.createdAt", "desc");

  const normalized = rows.map((row: any) =>
    normalizeInviteRow(
      row,
      { id: row.userId, name: row.ownerName, realName: row.ownerRealName, role: row.ownerRole },
      row.reviewerId ? { id: row.reviewerId, name: row.reviewerName } : undefined,
    ),
  );
  const usageStats = await getInviteUsageStats(normalized.map((item) => item.id));
  const withUsageStats = normalized.map((item) => {
    const stats = usageStats.get(item.id) || {
      lastRegisteredAt: null,
      todayMaxIpUses: 0,
      todayUses: 0,
      uniqueIpCount: 0,
    };
    const inviteWithUsage = {
      ...item,
      lastRegisteredAt: stats.lastRegisteredAt,
      remainingUses: Math.max(0, item.maxUses - item.useCount),
      todayMaxIpUses: stats.todayMaxIpUses,
      todayUses: stats.todayUses,
      uniqueIpCount: stats.uniqueIpCount,
    };
    return {
      ...inviteWithUsage,
      ...getInviteRisk(inviteWithUsage),
    };
  });
  const filtered = withUsageStats.filter((item) => {
    const statusMatched = !status || item.status === status;
    const keywordMatched =
      !keyword ||
      [item.code, item.userId, item.owner?.name, item.owner?.realName, item.requestReason]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    return statusMatched && keywordMatched;
  });
  const offset = (page - 1) * pageSize;

  return {
    list: filtered.slice(offset, offset + pageSize),
    metrics: {
      approved: withUsageStats.filter((item) => item.status === "approved" && !item.disabled).length,
      disabled: withUsageStats.filter((item) => item.status === "disabled" || item.disabled).length,
      pending: withUsageStats.filter((item) => item.status === "pending").length,
      rejected: withUsageStats.filter((item) => item.status === "rejected").length,
      riskWarnings: withUsageStats.filter((item) => item.riskLevel !== "normal").length,
      todayUses: withUsageStats.reduce((sum, item) => sum + item.todayUses, 0),
      totalUses: withUsageStats.reduce((sum, item) => sum + item.useCount, 0),
    },
    page,
    pageSize,
    total: filtered.length,
  };
}

export async function updateInviteByAdmin(params: {
  action: "approve" | "disable" | "enable" | "reject" | "updateLimits";
  adminId: string;
  dailyLimit?: number;
  id: string;
  ipDailyLimit?: number;
  maxUses?: number;
  reviewNote?: string;
}) {
  const invite = await db("invite_codes").where("id", params.id).first();
  if (!invite) throw new Error("邀请码申请不存在");

  const payload: Record<string, any> = {
    updatedAt: now(),
  };
  const nextMaxUses =
    params.maxUses === undefined
      ? toNumber(invite.maxUses, DEFAULT_INVITE_RULES.maxUses)
      : clampRule(params.maxUses, DEFAULT_INVITE_RULES.maxUses, INVITE_RULE_LIMITS.maxUses);
  const nextDailyLimit =
    params.dailyLimit === undefined
      ? toNumber(invite.dailyLimit, DEFAULT_INVITE_RULES.dailyLimit)
      : clampRule(params.dailyLimit, DEFAULT_INVITE_RULES.dailyLimit, INVITE_RULE_LIMITS.dailyLimit);
  const nextIpDailyLimit =
    params.ipDailyLimit === undefined
      ? Math.min(toNumber(invite.ipDailyLimit, DEFAULT_INVITE_RULES.ipDailyLimit), nextDailyLimit)
      : Math.min(clampRule(params.ipDailyLimit, DEFAULT_INVITE_RULES.ipDailyLimit, INVITE_RULE_LIMITS.ipDailyLimit), nextDailyLimit);

  if (params.maxUses !== undefined) payload.maxUses = nextMaxUses;
  if (params.dailyLimit !== undefined) payload.dailyLimit = nextDailyLimit;
  if (params.ipDailyLimit !== undefined || params.dailyLimit !== undefined) payload.ipDailyLimit = nextIpDailyLimit;

  if (params.action === "approve") {
    const owner = await findUser(String(invite.userId));
    if (!isInviteOwnerAllowed(owner)) throw new Error("admin 账号不能拥有邀请码");
    payload.status = "approved";
    payload.disabled = false;
    payload.reviewNote = sanitizeText(params.reviewNote);
    payload.reviewedAt = now();
    payload.reviewerId = params.adminId;
  } else if (params.action === "reject") {
    payload.status = "rejected";
    payload.disabled = false;
    payload.reviewNote = sanitizeText(params.reviewNote);
    payload.reviewedAt = now();
    payload.reviewerId = params.adminId;
  } else if (params.action === "disable") {
    payload.status = "disabled";
    payload.disabled = true;
    payload.reviewNote = sanitizeText(params.reviewNote || invite.reviewNote);
    payload.reviewedAt = now();
    payload.reviewerId = params.adminId;
  } else if (params.action === "enable") {
    payload.status = "approved";
    payload.disabled = false;
    payload.reviewedAt = now();
    payload.reviewerId = params.adminId;
  }

  await db("invite_codes").where("id", params.id).update(payload);
  return normalizeInviteRow(await db("invite_codes").where("id", params.id).first());
}

export async function listInviteRegistrationsForAdmin(inviteId: string) {
  const invite = await db("invite_codes").where("id", inviteId).first();
  if (!invite) throw new Error("邀请码申请不存在");

  const rows = await db("invite_registrations as registration")
    .leftJoin("o_user as invitee", "invitee.id", "registration.inviteeUserId")
    .select(
      "registration.id",
      "registration.inviteCode",
      "registration.inviteeUserId",
      "registration.ipAddress",
      "registration.userAgent",
      "registration.createdAt",
      "invitee.name as inviteeName",
      "invitee.realName as inviteeRealName",
      "invitee.avatar as inviteeAvatar",
    )
    .where("registration.inviteCodeId", inviteId)
    .orderBy("registration.createdAt", "desc");

  return rows.map((row: any) => ({
    avatar: String(row.inviteeAvatar || ""),
    createdAt: toIso(row.createdAt),
    id: String(row.id || ""),
    inviteCode: normalizeInviteCode(row.inviteCode),
    inviteeName: String(row.inviteeName || ""),
    inviteeRealName: String(row.inviteeRealName || row.inviteeName || ""),
    inviteeUserId: String(row.inviteeUserId || ""),
    ipAddress: String(row.ipAddress || ""),
    userAgent: String(row.userAgent || ""),
  }));
}

async function assertInviteLimits(trx: Knex.Transaction, invite: any, req: Request) {
  if (!invite?.code || invite.status !== "approved" || invite.disabled) throw new Error("邀请码无效或已停用");

  const owner = await trx("o_user").where("id", invite.userId).first();
  if (!isInviteOwnerAllowed(owner)) throw new Error("邀请码无效");

  const maxUses = toNumber(invite.maxUses, DEFAULT_INVITE_RULES.maxUses);
  const dailyLimit = toNumber(invite.dailyLimit, DEFAULT_INVITE_RULES.dailyLimit);
  const ipLimit = toNumber(invite.ipDailyLimit, DEFAULT_INVITE_RULES.ipDailyLimit);
  const used = toNumber(invite.useCount);
  if (maxUses > 0 && used >= maxUses) throw new Error("邀请码使用次数已达上限");

  const dayStart = startOfToday();
  const dailyUsed = await trx("invite_registrations").where("inviteCodeId", invite.id).where("createdAt", ">=", dayStart).count<{ count: number | string }>({ count: "*" }).first();
  if (dailyLimit > 0 && toNumber(dailyUsed?.count) >= dailyLimit) throw new Error("邀请码今日注册次数已达上限");

  const ip = clientIp(req);
  if (ip) {
    const ipUsed = await trx("invite_registrations")
      .where("inviteCodeId", invite.id)
      .where("ipAddress", ip)
      .where("createdAt", ">=", dayStart)
      .count<{ count: number | string }>({ count: "*" })
      .first();
    if (ipLimit > 0 && toNumber(ipUsed?.count) >= ipLimit) throw new Error("当前网络环境注册次数过多，请稍后再试");

    const globalIpUsed = await trx("invite_registrations")
      .where("ipAddress", ip)
      .where("createdAt", ">=", dayStart)
      .count<{ count: number | string }>({ count: "*" })
      .first();
    if (toNumber(globalIpUsed?.count) >= GLOBAL_INVITE_IP_DAILY_LIMIT) throw new Error("当前网络环境今日注册次数已达上限，请稍后再试");
  }
}

export async function getUsableInviteForRegistration(trx: Knex.Transaction, inviteCode: string, req: Request) {
  const code = normalizeInviteCode(inviteCode);
  const invite = await trx("invite_codes").where("code", code).forUpdate().first();
  await assertInviteLimits(trx, invite, req);
  return invite;
}

export async function recordInviteRegistration(trx: Knex.Transaction, invite: any, inviteeUserId: string, req: Request) {
  await trx("invite_registrations").insert({
    id: uuid(),
    inviteCodeId: invite.id,
    inviteCode: normalizeInviteCode(invite.code),
    inviterUserId: String(invite.userId),
    inviteeUserId,
    ipAddress: clientIp(req) || null,
    userAgent: userAgent(req) || null,
    createdAt: now(),
  });
  await trx("invite_codes")
    .where("id", invite.id)
    .update({
      useCount: toNumber(invite.useCount) + 1,
      updatedAt: now(),
    });
}
