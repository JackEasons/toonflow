import { v4 as uuid } from "uuid";
import db from "@/utils/db";
import { USER_ROLE_MEMBER } from "@/utils/admin";

export type PointCategory = "all" | "consume" | "earn" | "purchase";
export type PointBucket = "bonus" | "membership" | "recharge";

type MembershipPlanSeed = {
  key: string;
  name: string;
  levelKey: string;
  levelName: string;
  billingPeriod: "free" | "monthly" | "yearly" | "enterprise";
  priceCny: number;
  originalPriceCny?: number;
  yearlyDiscountLabel?: string;
  points: number;
  pointValidityDays: number;
  maxShots?: number;
  maxSeries?: number;
  popular?: boolean;
  sortOrder: number;
  features: string[];
};

type PointsPackageSeed = {
  key: string;
  points: number;
  priceCny: number;
  description: string;
  validityDays: number;
  sortOrder: number;
};

export type MembershipPlanInput = {
  billingPeriod: string;
  enabled?: boolean;
  features?: string[];
  key: string;
  levelKey: string;
  levelName: string;
  maxSeries?: null | number;
  maxShots?: null | number;
  name: string;
  originalPriceCny?: null | number;
  pointValidityDays?: number;
  points?: number;
  popular?: boolean;
  priceCny?: number;
  sortOrder?: number;
  yearlyDiscountLabel?: null | string;
};

export type PointsPackageInput = {
  description?: string;
  enabled?: boolean;
  key: string;
  points?: number;
  priceCny?: number;
  sortOrder?: number;
  validityDays?: number;
};

const FREE_LEVEL = {
  levelKey: "free",
  levelName: "免费会员",
};

const DEFAULT_MEMBERSHIP_PLANS: MembershipPlanSeed[] = [
  {
    key: "free",
    name: "免费会员",
    levelKey: "free",
    levelName: "免费会员",
    billingPeriod: "free",
    priceCny: 0,
    points: 0,
    pointValidityDays: 365,
    maxShots: 30,
    maxSeries: 1,
    sortOrder: 0,
    features: ["每日登录赠送积分", "支持基础短剧项目创作", "保留基础项目资产"],
  },
  {
    key: "standard_monthly",
    name: "标准会员",
    levelKey: "standard",
    levelName: "标准会员",
    billingPeriod: "monthly",
    priceCny: 60,
    points: 500,
    pointValidityDays: 31,
    maxShots: 50,
    maxSeries: 10,
    sortOrder: 10,
    features: ["每月 500 积分", "支持高清视频生成", "下载去水印", "基础队列优先级"],
  },
  {
    key: "advanced_monthly",
    name: "高级会员",
    levelKey: "advanced",
    levelName: "高级会员",
    billingPeriod: "monthly",
    priceCny: 300,
    points: 3000,
    pointValidityDays: 31,
    maxShots: 80,
    maxSeries: 50,
    popular: true,
    sortOrder: 20,
    features: ["每月 3000 积分", "高峰队列优先级", "批量任务额度提升", "下载去水印"],
  },
  {
    key: "standard_yearly",
    name: "标准年卡",
    levelKey: "standard",
    levelName: "标准会员",
    billingPeriod: "yearly",
    priceCny: 576,
    originalPriceCny: 720,
    yearlyDiscountLabel: "8折",
    points: 6000,
    pointValidityDays: 365,
    maxShots: 50,
    maxSeries: 10,
    sortOrder: 10,
    features: ["每年 6000 积分", "含 2 个月折扣", "支持高清视频生成", "下载去水印"],
  },
  {
    key: "advanced_yearly",
    name: "高级年卡",
    levelKey: "advanced",
    levelName: "高级会员",
    billingPeriod: "yearly",
    priceCny: 2880,
    originalPriceCny: 3600,
    yearlyDiscountLabel: "8折",
    points: 36000,
    pointValidityDays: 365,
    maxShots: 80,
    maxSeries: 50,
    popular: true,
    sortOrder: 20,
    features: ["每年 36000 积分", "高峰队列优先级", "批量任务额度提升", "下载去水印"],
  },
];

const DEFAULT_POINTS_PACKAGES: PointsPackageSeed[] = [
  { key: "points_500", points: 500, priceCny: 60, description: "约生成 50 个视频片段或 500 张图片", validityDays: 730, sortOrder: 10 },
  { key: "points_1000", points: 1000, priceCny: 120, description: "约生成 100 个视频片段或 1000 张图片", validityDays: 730, sortOrder: 20 },
  { key: "points_1500", points: 1500, priceCny: 180, description: "约生成 150 个视频片段或 1500 张图片", validityDays: 730, sortOrder: 30 },
  { key: "points_3000", points: 3000, priceCny: 360, description: "约生成 300 个视频片段或 3000 张图片", validityDays: 730, sortOrder: 40 },
  { key: "points_5000", points: 5000, priceCny: 600, description: "约生成 500 个视频片段或 5000 张图片", validityDays: 730, sortOrder: 50 },
];

function now() {
  return new Date();
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseFeatures(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function normalizeFeatures(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function createOrderNo(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getPointTransactionCategory(type: string, amount: number): PointCategory {
  if (type === "consume" || type === "shadow_consume" || amount < 0) return "consume";
  if (type === "recharge" || type === "points_purchase" || type === "plan_purchase" || type === "membership_grant") return "purchase";
  return "earn";
}

function normalizePlan(plan: any) {
  return {
    key: String(plan.key || ""),
    name: String(plan.name || ""),
    levelKey: String(plan.levelKey || "free"),
    levelName: String(plan.levelName || "免费会员"),
    billingPeriod: String(plan.billingPeriod || "free"),
    priceCny: toNumber(plan.priceCny),
    originalPriceCny: plan.originalPriceCny === null || plan.originalPriceCny === undefined ? null : toNumber(plan.originalPriceCny),
    yearlyDiscountLabel: plan.yearlyDiscountLabel ? String(plan.yearlyDiscountLabel) : null,
    points: toNumber(plan.points),
    pointValidityDays: toNumber(plan.pointValidityDays || 365),
    maxShots: plan.maxShots === null || plan.maxShots === undefined ? null : toNumber(plan.maxShots),
    maxSeries: plan.maxSeries === null || plan.maxSeries === undefined ? null : toNumber(plan.maxSeries),
    features: parseFeatures(plan.features),
    enabled: Boolean(plan.enabled),
    popular: Boolean(plan.popular),
    sortOrder: toNumber(plan.sortOrder),
  };
}

function normalizePackage(pkg: any) {
  return {
    key: String(pkg.key || ""),
    points: toNumber(pkg.points),
    priceCny: toNumber(pkg.priceCny),
    description: pkg.description ? String(pkg.description) : "",
    validityDays: toNumber(pkg.validityDays || 730),
    enabled: Boolean(pkg.enabled),
    sortOrder: toNumber(pkg.sortOrder),
  };
}

async function insertTransaction(params: {
  userId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  relatedId?: null | string;
  operatorId?: null | string;
  externalOrderId?: null | string;
  idempotencyKey?: null | string;
}) {
  if (params.idempotencyKey) {
    const existing = await db("balance_transactions").where("idempotencyKey", params.idempotencyKey).first();
    if (existing) return;
  }

  await db("balance_transactions").insert({
    id: uuid(),
    userId: params.userId,
    type: params.type,
    amount: params.amount,
    balanceAfter: params.balanceAfter,
    description: params.description,
    relatedId: params.relatedId || null,
    operatorId: params.operatorId || null,
    externalOrderId: params.externalOrderId || null,
    idempotencyKey: params.idempotencyKey || null,
    createdAt: now(),
  });
}

export async function ensureMembershipCatalog() {
  for (const plan of DEFAULT_MEMBERSHIP_PLANS) {
    const exists = await db("membership_plans").where("key", plan.key).first();
    if (exists) continue;
    await db("membership_plans").insert({
      id: uuid(),
      ...plan,
      originalPriceCny: plan.originalPriceCny ?? null,
      yearlyDiscountLabel: plan.yearlyDiscountLabel ?? null,
      maxShots: plan.maxShots ?? null,
      maxSeries: plan.maxSeries ?? null,
      features: JSON.stringify(plan.features),
      enabled: true,
      popular: Boolean(plan.popular),
      createdAt: now(),
      updatedAt: now(),
    });
  }

  for (const pkg of DEFAULT_POINTS_PACKAGES) {
    const exists = await db("points_packages").where("key", pkg.key).first();
    if (exists) continue;
    await db("points_packages").insert({
      id: uuid(),
      ...pkg,
      enabled: true,
      createdAt: now(),
      updatedAt: now(),
    });
  }
}

export async function ensureUserMembership(userId: string, grantWelcome = true) {
  await ensureMembershipCatalog();

  const balance = await db("user_balances").where("userId", userId).first();
  if (!balance) {
    await db("user_balances").insert({
      id: uuid(),
      userId,
      balance: 0,
      frozenAmount: 0,
      totalSpent: 0,
      membershipPoints: 0,
      rechargePoints: 0,
      bonusPoints: 0,
      createdAt: now(),
      updatedAt: now(),
    });
  }

  const membership = await db("user_memberships").where("userId", userId).first();
  if (!membership) {
    await db("user_memberships").insert({
      id: uuid(),
      userId,
      ...FREE_LEVEL,
      planKey: "free",
      status: "active",
      autoRenew: false,
      startedAt: now(),
      createdAt: now(),
      updatedAt: now(),
    });
  }

  if (grantWelcome) await grantWelcomePoints(userId);
}

export async function grantWelcomePoints(userId: string, amount = 50) {
  if (!Number.isFinite(amount) || amount <= 0) return;

  const idempotencyKey = `welcome:${userId}`;
  const existing = await db("balance_transactions").where("idempotencyKey", idempotencyKey).first();
  if (existing) return;

  const current = await db("user_balances").where("userId", userId).first();
  if (!current) {
    await ensureUserMembership(userId, false);
  }

  const balance = await db("user_balances").where("userId", userId).first();
  const nextBalance = toNumber(balance?.balance) + amount;
  await db("user_balances").where("userId", userId).update({
    balance: nextBalance,
    bonusPoints: toNumber(balance?.bonusPoints) + amount,
    updatedAt: now(),
  });

  await insertTransaction({
    userId,
    type: "bonus",
    amount,
    balanceAfter: nextBalance,
    description: `新人赠送积分 +${amount}`,
    idempotencyKey,
  });
}

export async function getMembershipProfile(userId: string) {
  await ensureUserMembership(userId);

  const [user, balance, membership, plansRaw, packagesRaw, transactionsRaw, ordersRaw] = await Promise.all([
    db("o_user").where("id", userId).first(),
    db("user_balances").where("userId", userId).first(),
    db("user_memberships").where("userId", userId).first(),
    db("membership_plans").where("enabled", true).orderBy("sortOrder", "asc").orderBy("priceCny", "asc"),
    db("points_packages").where("enabled", true).orderBy("sortOrder", "asc").orderBy("points", "asc"),
    db("balance_transactions").where("userId", userId).orderBy("createdAt", "desc").limit(50),
    db("subscription_orders").where("userId", userId).orderBy("createdAt", "desc").limit(30),
  ]);

  const plans = plansRaw.map(normalizePlan);
  const pointPackages = packagesRaw.map(normalizePackage);
  const pointSummary = {
    remaining: toNumber(balance?.balance),
    frozen: toNumber(balance?.frozenAmount),
    spent: toNumber(balance?.totalSpent),
    membership: toNumber(balance?.membershipPoints),
    recharge: toNumber(balance?.rechargePoints),
    bonus: toNumber(balance?.bonusPoints),
    pointsExpireAt: toIso(balance?.pointsExpireAt),
  };

  return {
    user: user
      ? {
          id: String(user.id),
          name: user.name || "",
          realName: user.realName || user.name || "",
          avatar: user.avatar || "",
        }
      : null,
    membership: membership
      ? {
          levelKey: membership.levelKey || FREE_LEVEL.levelKey,
          levelName: membership.levelName || FREE_LEVEL.levelName,
          planKey: membership.planKey || "free",
          status: membership.status || "active",
          autoRenew: Boolean(membership.autoRenew),
          startedAt: toIso(membership.startedAt),
          expiresAt: toIso(membership.expiresAt),
        }
      : {
          ...FREE_LEVEL,
          planKey: "free",
          status: "active",
          autoRenew: false,
          startedAt: now().toISOString(),
          expiresAt: null,
        },
    pointSummary,
    plans: {
      all: plans,
      monthly: plans.filter((plan) => ["free", "monthly", "enterprise"].includes(plan.billingPeriod)),
      yearly: plans.filter((plan) => ["free", "yearly", "enterprise"].includes(plan.billingPeriod)),
    },
    pointPackages,
    transactions: transactionsRaw.map((item: any) => {
      const amount = toNumber(item.amount);
      return {
        id: item.id,
        type: item.type,
        category: getPointTransactionCategory(item.type, amount),
        amount,
        balanceAfter: toNumber(item.balanceAfter),
        description: item.description || item.type,
        createdAt: toIso(item.createdAt) || now().toISOString(),
      };
    }),
    orders: ordersRaw.map((order: any) => ({
      id: order.id,
      orderNo: order.orderNo,
      kind: order.kind,
      planKey: order.planKey,
      pointsPackageKey: order.pointsPackageKey,
      amountCny: toNumber(order.amountCny),
      points: toNumber(order.points),
      status: order.status,
      paymentMethod: order.paymentMethod,
      createdAt: toIso(order.createdAt) || now().toISOString(),
      paidAt: toIso(order.paidAt),
    })),
  };
}

async function addPoints(params: {
  userId: string;
  amount: number;
  bucket: PointBucket;
  type: string;
  description: string;
  relatedId?: null | string;
  operatorId?: null | string;
  externalOrderId?: null | string;
  expireAt?: Date | null;
}) {
  await ensureUserMembership(params.userId, false);
  const current = await db("user_balances").where("userId", params.userId).first();
  const nextBalance = toNumber(current?.balance) + params.amount;
  const bucketColumn = params.bucket === "membership" ? "membershipPoints" : params.bucket === "recharge" ? "rechargePoints" : "bonusPoints";

  await db("user_balances")
    .where("userId", params.userId)
    .update({
      balance: nextBalance,
      [bucketColumn]: toNumber(current?.[bucketColumn]) + params.amount,
      pointsExpireAt: params.expireAt || current?.pointsExpireAt || null,
      updatedAt: now(),
    });

  await insertTransaction({
    userId: params.userId,
    type: params.type,
    amount: params.amount,
    balanceAfter: nextBalance,
    description: params.description,
    relatedId: params.relatedId,
    operatorId: params.operatorId,
    externalOrderId: params.externalOrderId,
  });
}

async function settleOrder(order: any, operatorId?: string | null) {
  const userId = String(order.userId);
  const paidAt = now();

  if (order.kind === "plan" && order.planKey) {
    const plan = await db("membership_plans").where("key", order.planKey).first();
    if (!plan) throw new Error("会员套餐不存在");

    const normalized = normalizePlan(plan);
    const expiresAt =
      normalized.billingPeriod === "monthly" ? addDays(paidAt, 31) : normalized.billingPeriod === "yearly" ? addDays(paidAt, 365) : null;

    await db("user_memberships")
      .where("userId", userId)
      .update({
        levelKey: normalized.levelKey,
        levelName: normalized.levelName,
        planKey: normalized.key,
        status: "active",
        startedAt: paidAt,
        expiresAt,
        sourceOrderId: order.id,
        updatedAt: paidAt,
      });

    if (normalized.points > 0) {
      await addPoints({
        userId,
        amount: normalized.points,
        bucket: "membership",
        type: "membership_grant",
        description: `${normalized.name}赠送积分 +${normalized.points}`,
        relatedId: order.id,
        operatorId,
        externalOrderId: order.orderNo,
        expireAt: addDays(paidAt, normalized.pointValidityDays),
      });
    }
    return;
  }

  if (order.kind === "points" && order.pointsPackageKey) {
    const pkg = await db("points_packages").where("key", order.pointsPackageKey).first();
    if (!pkg) throw new Error("积分包不存在");
    const normalized = normalizePackage(pkg);
    await addPoints({
      userId,
      amount: normalized.points,
      bucket: "recharge",
      type: "points_purchase",
      description: `购买积分 +${normalized.points}`,
      relatedId: order.id,
      operatorId,
      externalOrderId: order.orderNo,
      expireAt: addDays(paidAt, normalized.validityDays),
    });
  }
}

function parseOrderMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function createMembershipOrder(
  userId: string,
  input: { kind: "plan"; planKey: string } | { kind: "points"; pointsPackageKey: string },
  paymentMethod = "manual_checkout",
) {
  await ensureUserMembership(userId);
  const orderNo = createOrderNo(input.kind === "plan" ? "sub" : "pts");
  const timestamp = now();

  if (input.kind === "plan") {
    const plan = await db("membership_plans").where("key", input.planKey).first();
    if (!plan || !plan.enabled) throw new Error("会员套餐不存在或已停用");
    const normalized = normalizePlan(plan);
    if (normalized.billingPeriod === "enterprise") throw new Error("企业会员请联系管理员开通");

    const order = {
      id: uuid(),
      orderNo,
      userId,
      kind: "plan",
      planKey: normalized.key,
      pointsPackageKey: null,
      amountCny: normalized.priceCny,
      points: normalized.points,
      status: normalized.priceCny > 0 ? "pending" : "paid",
      paymentMethod,
      paidAt: normalized.priceCny > 0 ? null : timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db("subscription_orders").insert(order);
    if (order.status === "paid") await settleOrder(order);
    return order;
  }

  const pkg = await db("points_packages").where("key", input.pointsPackageKey).first();
  if (!pkg || !pkg.enabled) throw new Error("积分包不存在或已停用");
  const normalized = normalizePackage(pkg);
  const order = {
    id: uuid(),
    orderNo,
    userId,
    kind: "points",
    planKey: null,
    pointsPackageKey: normalized.key,
    amountCny: normalized.priceCny,
    points: normalized.points,
    status: normalized.priceCny > 0 ? "pending" : "paid",
    paymentMethod,
    paidAt: normalized.priceCny > 0 ? null : timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db("subscription_orders").insert(order);
  if (order.status === "paid") await settleOrder(order);
  return order;
}

export async function markMembershipOrderPaidByOrderNo(params: {
  amountCny?: number;
  externalTradeNo?: null | string;
  metadata?: Record<string, unknown>;
  orderNo: string;
  paymentMethod: string;
}) {
  const order = await db("subscription_orders").where("orderNo", params.orderNo).first();
  if (!order) throw new Error("订单不存在");

  const orderAmount = toNumber(order.amountCny);
  if (params.amountCny !== undefined && Math.round(orderAmount * 100) !== Math.round(params.amountCny * 100)) {
    throw new Error("支付金额与订单金额不一致");
  }

  const mergedMetadata = {
    ...parseOrderMetadata(order.metadata),
    ...(params.metadata || {}),
    externalTradeNo: params.externalTradeNo || undefined,
    paidBy: params.paymentMethod,
  };

  if (order.status === "paid") {
    await db("subscription_orders")
      .where("id", order.id)
      .update({
        metadata: JSON.stringify(mergedMetadata),
        paymentMethod: params.paymentMethod,
        updatedAt: now(),
      });
    return order;
  }

  await db("subscription_orders")
    .where("id", order.id)
    .update({
      status: "paid",
      paidAt: now(),
      paymentMethod: params.paymentMethod,
      metadata: JSON.stringify(mergedMetadata),
      updatedAt: now(),
    });
  await settleOrder(order);
  return {
    ...order,
    status: "paid",
    paymentMethod: params.paymentMethod,
  };
}

function deductBuckets(current: any, amount: number, preferredBucket: PointBucket) {
  const values = {
    membershipPoints: toNumber(current.membershipPoints),
    rechargePoints: toNumber(current.rechargePoints),
    bonusPoints: toNumber(current.bonusPoints),
  };
  const orderedColumns = [
    preferredBucket === "membership" ? "membershipPoints" : preferredBucket === "recharge" ? "rechargePoints" : "bonusPoints",
    "bonusPoints",
    "rechargePoints",
    "membershipPoints",
  ].filter((item, index, list) => list.indexOf(item) === index) as Array<keyof typeof values>;

  let remaining = amount;
  for (const column of orderedColumns) {
    const used = Math.min(values[column], remaining);
    values[column] -= used;
    remaining -= used;
    if (remaining <= 0) break;
  }
  return values;
}

export async function adjustUserPoints(params: {
  amount: number;
  bucket?: PointBucket;
  description?: string;
  operatorId?: null | string;
  userId: string;
}) {
  const amount = Number(params.amount);
  if (!Number.isFinite(amount) || amount === 0) throw new Error("积分调整数量无效");

  await ensureUserMembership(params.userId, false);
  const current = await db("user_balances").where("userId", params.userId).first();
  if (!current) throw new Error("用户积分账户不存在");

  const bucket = params.bucket || "bonus";
  const currentBalance = toNumber(current.balance);
  if (amount < 0 && currentBalance < Math.abs(amount)) throw new Error("用户积分不足");

  const nextBreakdown =
    amount < 0
      ? deductBuckets(current, Math.abs(amount), bucket)
      : {
          membershipPoints: toNumber(current.membershipPoints) + (bucket === "membership" ? amount : 0),
          rechargePoints: toNumber(current.rechargePoints) + (bucket === "recharge" ? amount : 0),
          bonusPoints: toNumber(current.bonusPoints) + (bucket === "bonus" ? amount : 0),
        };
  const nextBalance = nextBreakdown.membershipPoints + nextBreakdown.rechargePoints + nextBreakdown.bonusPoints;

  await db("user_balances").where("userId", params.userId).update({
    balance: nextBalance,
    membershipPoints: nextBreakdown.membershipPoints,
    rechargePoints: nextBreakdown.rechargePoints,
    bonusPoints: nextBreakdown.bonusPoints,
    totalSpent: toNumber(current.totalSpent) + (amount < 0 ? Math.abs(amount) : 0),
    updatedAt: now(),
  });

  await insertTransaction({
    userId: params.userId,
    type: "admin_adjust",
    amount,
    balanceAfter: nextBalance,
    description: params.description || `后台调整积分 ${amount > 0 ? "+" : ""}${amount}`,
    operatorId: params.operatorId,
  });
}

export async function updateUserMembership(params: {
  autoRenew?: boolean;
  expiresAt?: null | string;
  levelKey: string;
  levelName: string;
  operatorId?: null | string;
  planKey?: null | string;
  status: string;
  userId: string;
}) {
  await ensureUserMembership(params.userId, false);
  const startedAt = now();
  await db("user_memberships").where("userId", params.userId).update({
    levelKey: params.levelKey,
    levelName: params.levelName,
    planKey: params.planKey || null,
    status: params.status,
    autoRenew: Boolean(params.autoRenew),
    startedAt,
    expiresAt: params.expiresAt ? new Date(params.expiresAt) : null,
    updatedAt: startedAt,
  });

  await insertTransaction({
    userId: params.userId,
    type: "membership_admin_update",
    amount: 0,
    balanceAfter: toNumber((await db("user_balances").where("userId", params.userId).first())?.balance),
    description: `后台调整会员：${params.levelName}`,
    operatorId: params.operatorId,
  });
}

export async function getAdminMembershipOverview() {
  await ensureMembershipCatalog();
  const [userCount, memberCountRow, balanceRow, paidOrdersRow, plans, pointPackages] = await Promise.all([
    db("o_user").count<{ count: number }[]>({ count: "*" }),
    db("user_memberships").whereNot("levelKey", "free").where("status", "active").count<{ count: number }[]>({ count: "*" }),
    db("user_balances").sum<{ balance: string | number; frozen: string | number; spent: string | number }[]>({
      balance: "balance",
      frozen: "frozenAmount",
      spent: "totalSpent",
    }),
    db("subscription_orders").where("status", "paid").count<{ count: number }[]>({ count: "*" }),
    db("membership_plans").orderBy("sortOrder", "asc").orderBy("priceCny", "asc"),
    db("points_packages").orderBy("sortOrder", "asc").orderBy("points", "asc"),
  ]);

  return {
    totals: {
      users: toNumber(userCount[0]?.count),
      activeMembers: toNumber(memberCountRow[0]?.count),
      balance: toNumber(balanceRow[0]?.balance),
      frozenBalance: toNumber(balanceRow[0]?.frozen),
      totalSpent: toNumber(balanceRow[0]?.spent),
      paidOrders: toNumber(paidOrdersRow[0]?.count),
    },
    plans: plans.map(normalizePlan),
    pointPackages: pointPackages.map(normalizePackage),
  };
}

export async function getAdminMembershipCatalog() {
  await ensureMembershipCatalog();
  const [plans, pointPackages] = await Promise.all([
    db("membership_plans").orderBy("sortOrder", "asc").orderBy("priceCny", "asc"),
    db("points_packages").orderBy("sortOrder", "asc").orderBy("points", "asc"),
  ]);

  return {
    plans: plans.map(normalizePlan),
    pointPackages: pointPackages.map(normalizePackage),
  };
}

export async function saveMembershipPlan(input: MembershipPlanInput) {
  await ensureMembershipCatalog();
  const key = String(input.key || "").trim();
  if (!key) throw new Error("套餐标识不能为空");

  const timestamp = now();
  const payload = {
    key,
    name: String(input.name || "").trim() || key,
    levelKey: String(input.levelKey || "free").trim(),
    levelName: String(input.levelName || input.name || "免费会员").trim(),
    billingPeriod: String(input.billingPeriod || "monthly").trim(),
    priceCny: toNumber(input.priceCny),
    originalPriceCny: input.originalPriceCny === null || input.originalPriceCny === undefined ? null : toNumber(input.originalPriceCny),
    yearlyDiscountLabel: input.yearlyDiscountLabel ? String(input.yearlyDiscountLabel).trim() : null,
    points: Math.max(0, Math.round(toNumber(input.points))),
    pointValidityDays: Math.max(1, Math.round(toNumber(input.pointValidityDays || 365))),
    maxShots: input.maxShots === null || input.maxShots === undefined ? null : Math.max(0, Math.round(toNumber(input.maxShots))),
    maxSeries: input.maxSeries === null || input.maxSeries === undefined ? null : Math.max(0, Math.round(toNumber(input.maxSeries))),
    features: JSON.stringify(normalizeFeatures(input.features)),
    enabled: input.enabled !== false,
    popular: Boolean(input.popular),
    sortOrder: Math.round(toNumber(input.sortOrder)),
    updatedAt: timestamp,
  };

  const existing = await db("membership_plans").where("key", key).first();
  if (existing) {
    await db("membership_plans").where("key", key).update(payload);
  } else {
    await db("membership_plans").insert({
      id: uuid(),
      ...payload,
      createdAt: timestamp,
    });
  }

  return getAdminMembershipCatalog();
}

export async function savePointsPackage(input: PointsPackageInput) {
  await ensureMembershipCatalog();
  const key = String(input.key || "").trim();
  if (!key) throw new Error("积分包标识不能为空");

  const timestamp = now();
  const payload = {
    key,
    points: Math.max(1, Math.round(toNumber(input.points))),
    priceCny: toNumber(input.priceCny),
    description: String(input.description || "").trim(),
    validityDays: Math.max(1, Math.round(toNumber(input.validityDays || 730))),
    enabled: input.enabled !== false,
    sortOrder: Math.round(toNumber(input.sortOrder)),
    updatedAt: timestamp,
  };

  const existing = await db("points_packages").where("key", key).first();
  if (existing) {
    await db("points_packages").where("key", key).update(payload);
  } else {
    await db("points_packages").insert({
      id: uuid(),
      ...payload,
      createdAt: timestamp,
    });
  }

  return getAdminMembershipCatalog();
}

export async function getAdminMembershipUsers(params: { keyword?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize || 20)));
  const keyword = String(params.keyword || "").trim();

  const base = db("o_user")
    .leftJoin("user_balances", "user_balances.userId", "o_user.id")
    .leftJoin("user_memberships", "user_memberships.userId", "o_user.id")
    .where((builder) => builder.where("o_user.role", USER_ROLE_MEMBER).orWhereNull("o_user.role").orWhere("o_user.role", ""))
    .whereNot("o_user.id", 1)
    .where((builder) => builder.whereNull("o_user.name").orWhereNot("o_user.name", "admin"));

  if (keyword) {
    base.where((builder) => {
      builder.where("o_user.name", "like", `%${keyword}%`).orWhere("o_user.id", keyword);
    });
  }

  const countQuery = base.clone().clearSelect().clearOrder().count<{ count: number }[]>({ count: "o_user.id" });
  const rowsQuery = base
    .clone()
    .select(
      "o_user.id",
      "o_user.name",
      "o_user.realName",
      "o_user.avatar",
      "user_balances.balance",
      "user_balances.frozenAmount",
      "user_balances.totalSpent",
      "user_balances.membershipPoints",
      "user_balances.rechargePoints",
      "user_balances.bonusPoints",
      "user_memberships.levelKey",
      "user_memberships.levelName",
      "user_memberships.planKey",
      "user_memberships.status",
      "user_memberships.autoRenew",
      "user_memberships.expiresAt",
    )
    .orderBy("o_user.id", "desc")
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [countRows, rows] = await Promise.all([countQuery, rowsQuery]);

  return {
    list: rows.map((row: any) => ({
      userId: String(row.id),
      name: row.realName || row.name || `用户 ${row.id}`,
      username: row.name || "",
      avatar: row.avatar || "",
      membership: {
        levelKey: row.levelKey || "free",
        levelName: row.levelName || "免费会员",
        planKey: row.planKey || "free",
        status: row.status || "active",
        autoRenew: Boolean(row.autoRenew),
        expiresAt: toIso(row.expiresAt),
      },
      points: {
        remaining: toNumber(row.balance),
        frozen: toNumber(row.frozenAmount),
        spent: toNumber(row.totalSpent),
        membership: toNumber(row.membershipPoints),
        recharge: toNumber(row.rechargePoints),
        bonus: toNumber(row.bonusPoints),
      },
    })),
    page,
    pageSize,
    total: toNumber(countRows[0]?.count),
  };
}

export async function getAdminMembershipTransactions(params: { userId?: string; page?: number; pageSize?: number; type?: string }) {
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize || 20)));
  const query = db("balance_transactions").leftJoin("o_user", "o_user.id", "balance_transactions.userId");
  if (params.userId) query.where("balance_transactions.userId", String(params.userId));
  if (params.type && params.type !== "all") query.where("balance_transactions.type", params.type);

  const [countRows, rows] = await Promise.all([
    query.clone().clearSelect().clearOrder().count<{ count: number }[]>({ count: "balance_transactions.id" }),
    query
      .clone()
      .select("balance_transactions.*", "o_user.name as userName")
      .orderBy("balance_transactions.createdAt", "desc")
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return {
    list: rows.map((row: any) => ({
      id: row.id,
      userId: String(row.userId),
      userName: row.userName || "",
      type: row.type,
      category: getPointTransactionCategory(row.type, toNumber(row.amount)),
      amount: toNumber(row.amount),
      balanceAfter: toNumber(row.balanceAfter),
      description: row.description || "",
      operatorId: row.operatorId || "",
      createdAt: toIso(row.createdAt),
    })),
    page,
    pageSize,
    total: toNumber(countRows[0]?.count),
  };
}

export async function getAdminMembershipOrders(params: { userId?: string; page?: number; pageSize?: number; status?: string }) {
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize || 20)));
  const query = db("subscription_orders").leftJoin("o_user", "o_user.id", "subscription_orders.userId");
  if (params.userId) query.where("subscription_orders.userId", String(params.userId));
  if (params.status && params.status !== "all") query.where("subscription_orders.status", params.status);

  const [countRows, rows] = await Promise.all([
    query.clone().clearSelect().clearOrder().count<{ count: number }[]>({ count: "subscription_orders.id" }),
    query
      .clone()
      .select("subscription_orders.*", "o_user.name as userName")
      .orderBy("subscription_orders.createdAt", "desc")
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return {
    list: rows.map((row: any) => ({
      id: row.id,
      orderNo: row.orderNo,
      userId: String(row.userId),
      userName: row.userName || "",
      kind: row.kind,
      planKey: row.planKey || "",
      pointsPackageKey: row.pointsPackageKey || "",
      amountCny: toNumber(row.amountCny),
      points: toNumber(row.points),
      status: row.status,
      paymentMethod: row.paymentMethod || "",
      createdAt: toIso(row.createdAt),
      paidAt: toIso(row.paidAt),
    })),
    page,
    pageSize,
    total: toNumber(countRows[0]?.count),
  };
}

export async function updateOrderStatus(params: { id: string; operatorId?: null | string; status: "canceled" | "paid" | "pending" | "refunded" }) {
  const order = await db("subscription_orders").where("id", params.id).first();
  if (!order) throw new Error("订单不存在");
  if (params.status === "paid" && order.status !== "paid") {
    await db("subscription_orders").where("id", params.id).update({
      status: "paid",
      paidAt: now(),
      updatedAt: now(),
    });
    await settleOrder(order, params.operatorId);
  } else {
    await db("subscription_orders").where("id", params.id).update({
      status: params.status,
      updatedAt: now(),
    });
  }
}
