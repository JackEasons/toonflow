import db from "@/utils/db";

type CountRow = Record<string, string | number | null | undefined>;

type TrendBucket = {
  activeUserIds: Set<string>;
  date: string;
  label: string;
  modelCalls: number;
  pointsConsumed: number;
  rechargeAmount: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TREND_DAYS = 30;

type AnalyticsParams = {
  days?: number;
};

function normalizeTrendDays(days: unknown): number {
  const parsed = Number(days);
  if (!Number.isFinite(parsed)) return DEFAULT_TREND_DAYS;
  const rounded = Math.round(parsed);
  if ([7, 30, 90].includes(rounded)) return rounded;
  return Math.min(Math.max(rounded, 7), 180);
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toTime(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  const parsed = new Date(String(value)).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function dateKey(value: Date | number): string {
  const date = typeof value === "number" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(value: Date | number): string {
  const date = typeof value === "number" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function dayLabel(key: string): string {
  return key.slice(5).replace("-", "/");
}

function firstValue(rows: CountRow[], key: string): number {
  return toNumber(rows[0]?.[key]);
}

function percent(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function getTrendBuckets(startDate: Date, days: number): Map<string, TrendBucket> {
  const buckets = new Map<string, TrendBucket>();
  for (let index = 0; index < days; index += 1) {
    const time = startDate.getTime() + index * DAY_MS;
    const key = dateKey(time);
    buckets.set(key, {
      activeUserIds: new Set<string>(),
      date: key,
      label: dayLabel(key),
      modelCalls: 0,
      pointsConsumed: 0,
      rechargeAmount: 0,
    });
  }
  return buckets;
}

function resolveBucket(buckets: Map<string, TrendBucket>, value: unknown): TrendBucket | null {
  const time = toTime(value);
  if (!time) return null;
  return buckets.get(dateKey(time)) || null;
}

function isConsumeTransaction(type: string, amount: number): boolean {
  return amount < 0 || ["consume", "shadow_consume", "model_consume", "generation_consume"].includes(type);
}

function pointFlowName(type: string, amount: number): string {
  if (isConsumeTransaction(type, amount)) return "积分消耗";
  if (["points_purchase", "plan_purchase", "membership_grant", "recharge"].includes(type)) return "充值/会员赠送";
  if (type === "admin_adjust") return "后台调整";
  return "活动赠送";
}

function normalizeChartRows(rows: any[], nameKey: string, valueKey = "value") {
  return rows
    .map((row) => ({
      name: String(row[nameKey] || "未配置"),
      value: toNumber(row[valueKey]),
    }))
    .filter((item) => item.value > 0);
}

function membershipLevelName(levelKey: string, levelName: string): string {
  if (levelName) return levelName;
  if (levelKey === "standard") return "标准会员";
  if (levelKey === "advanced") return "高级会员";
  if (levelKey === "free") return "免费会员";
  return levelKey || "未配置";
}

function orderStatusName(status: string): string {
  if (status === "paid") return "已支付";
  if (status === "pending") return "待支付";
  if (status === "cancelled") return "已取消";
  if (status === "refunded") return "已退款";
  return status || "未知";
}

function pointTransactionName(type: string, amount: number): string {
  if (isConsumeTransaction(type, amount)) return "积分消耗";
  if (type === "membership_grant") return "会员赠送";
  if (type === "points_purchase") return "积分充值";
  if (type === "plan_purchase") return "会员购买";
  if (type === "admin_adjust") return "后台调整";
  if (type === "bonus") return "活动赠送";
  return type || "未知";
}

function productKindName(kind: string): string {
  if (kind === "plan") return "会员订阅";
  if (kind === "points") return "积分包";
  return kind || "其他";
}

function maxTime(current: null | number, nextValue: unknown): null | number {
  const next = toTime(nextValue);
  if (!next) return current;
  return current && current > next ? current : next;
}

function pushInsight(
  insights: Array<{
    action: string;
    description: string;
    level: "info" | "success" | "warning";
    metric: string;
    title: string;
  }>,
  insight: {
    action: string;
    description: string;
    level: "info" | "success" | "warning";
    metric: string;
    title: string;
  },
) {
  if (insights.length < 6) insights.push(insight);
}

export async function getAdminAnalyticsOverview(params: AnalyticsParams = {}) {
  const trendDays = normalizeTrendDays(params.days);
  const now = new Date();
  const startDate = startOfDay(new Date(now.getTime() - (trendDays - 1) * DAY_MS));
  const startTime = startDate.getTime();
  const trendBuckets = getTrendBuckets(startDate, trendDays);

  const [
    userCountRows,
    activeMemberRows,
    expiringMemberRows,
    membershipLevelRows,
    projectCountRows,
    balanceRows,
    paidOrderRows,
    paidOrderKindRows,
    orderStatusRows,
    pointFlowRows,
    taskCountRows,
    taskSuccessRows,
    modelUsageRows,
    modelStateRows,
    taskUsageRows,
    stateUsageRows,
    recentTasks,
    projectActivityRows,
    taskActivityRows,
    transactionTrendRows,
    orderTrendRows,
    taskTrendRows,
    monthlyOrderRows,
    userRows,
    userMembershipRows,
    projectRows,
    rangedTaskRows,
    rangedTransactionRows,
    rangedOrderRows,
    planRows,
    packageRows,
  ] = await Promise.all([
    db("o_user").count<CountRow[]>({ value: "*" }),
    db("user_memberships")
      .where("status", "active")
      .whereNot("levelKey", "free")
      .where((builder) => {
        builder.whereNull("expiresAt").orWhere("expiresAt", ">", now);
      })
      .count<CountRow[]>({ value: "*" }),
    db("user_memberships")
      .where("status", "active")
      .whereNot("levelKey", "free")
      .whereNotNull("expiresAt")
      .where("expiresAt", ">", now)
      .where("expiresAt", "<=", new Date(now.getTime() + 7 * DAY_MS))
      .count<CountRow[]>({ value: "*" }),
    db("user_memberships").select("levelKey", "levelName", "status").count<CountRow[]>({ value: "id" }).groupBy("levelKey", "levelName", "status"),
    db("o_project").count<CountRow[]>({ value: "*" }),
    db("user_balances").sum<CountRow[]>({
      balance: "balance",
      bonus: "bonusPoints",
      frozen: "frozenAmount",
      membership: "membershipPoints",
      recharge: "rechargePoints",
      spent: "totalSpent",
    }),
    db("subscription_orders").where("status", "paid").sum<CountRow[]>({ amount: "amountCny" }).count<CountRow[]>({ value: "id" }),
    db("subscription_orders")
      .where("status", "paid")
      .select("kind")
      .sum<CountRow[]>({ amount: "amountCny" })
      .count<CountRow[]>({ value: "id" })
      .groupBy("kind"),
    db("subscription_orders").select("status").sum<CountRow[]>({ amount: "amountCny" }).count<CountRow[]>({ value: "id" }).groupBy("status"),
    db("balance_transactions").select("type").sum<CountRow[]>({ amount: "amount" }).groupBy("type"),
    db("o_tasks").count<CountRow[]>({ value: "*" }),
    db("o_tasks").where("state", "已完成").count<CountRow[]>({ value: "*" }),
    db("o_tasks").select("model").count<CountRow[]>({ value: "*" }).whereNotNull("model").whereNot("model", "").groupBy("model").orderBy("value", "desc").limit(10),
    db("o_tasks")
      .select("model", "state")
      .count<CountRow[]>({ value: "*" })
      .max<CountRow[]>({ latestAt: "startTime" })
      .whereNotNull("model")
      .whereNot("model", "")
      .groupBy("model", "state"),
    db("o_tasks")
      .select("taskClass")
      .count<CountRow[]>({ value: "*" })
      .whereNotNull("taskClass")
      .whereNot("taskClass", "")
      .groupBy("taskClass")
      .orderBy("value", "desc")
      .limit(10),
    db("o_tasks").select("state").count<CountRow[]>({ value: "*" }).whereNotNull("state").groupBy("state").orderBy("value", "desc"),
    db("o_tasks")
      .leftJoin("o_project", "o_project.id", "o_tasks.projectId")
      .select("o_tasks.id", "o_tasks.projectId", "o_project.name as projectName", "o_tasks.taskClass", "o_tasks.model", "o_tasks.state", "o_tasks.startTime")
      .orderBy("o_tasks.id", "desc")
      .limit(8),
    db("o_project").select("userId", "createTime").where("createTime", ">=", startTime).whereNotNull("userId"),
    db("o_tasks")
      .leftJoin("o_project", "o_project.id", "o_tasks.projectId")
      .select("o_project.userId", "o_tasks.startTime")
      .where("o_tasks.startTime", ">=", startTime)
      .whereNotNull("o_project.userId"),
    db("balance_transactions").select("userId", "type", "amount", "createdAt").where("createdAt", ">=", startDate),
    db("subscription_orders")
      .select("userId", "kind", "amountCny", "createdAt", "paidAt")
      .where("status", "paid")
      .where((builder) => {
        builder.where("createdAt", ">=", startDate).orWhere("paidAt", ">=", startDate);
      }),
    db("o_tasks").select("startTime").where("startTime", ">=", startTime),
    db("subscription_orders")
      .select("amountCny", "createdAt", "paidAt")
      .where("status", "paid")
      .where((builder) => {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        builder.where("createdAt", ">=", monthStart).orWhere("paidAt", ">=", monthStart);
      }),
    db("o_user").select("id", "name", "realName"),
    db("user_memberships").select("userId", "levelKey", "levelName", "status"),
    db("o_project").select("id", "name", "userId", "createTime"),
    db("o_tasks")
      .leftJoin("o_project", "o_project.id", "o_tasks.projectId")
      .select(
        "o_tasks.id",
        "o_tasks.projectId",
        "o_project.name as projectName",
        "o_project.userId",
        "o_tasks.taskClass",
        "o_tasks.model",
        "o_tasks.state",
        "o_tasks.startTime",
      )
      .where("o_tasks.startTime", ">=", startTime),
    db("balance_transactions")
      .leftJoin("o_user", "o_user.id", "balance_transactions.userId")
      .select(
        "balance_transactions.id",
        "balance_transactions.userId",
        "o_user.name as userName",
        "balance_transactions.type",
        "balance_transactions.amount",
        "balance_transactions.balanceAfter",
        "balance_transactions.description",
        "balance_transactions.projectId",
        "balance_transactions.taskType",
        "balance_transactions.createdAt",
      )
      .where("balance_transactions.createdAt", ">=", startDate)
      .orderBy("balance_transactions.createdAt", "desc")
      .limit(50),
    db("subscription_orders")
      .select("id", "userId", "kind", "planKey", "pointsPackageKey", "amountCny", "points", "status", "createdAt", "paidAt")
      .where((builder) => {
        builder.where("createdAt", ">=", startDate).orWhere("paidAt", ">=", startDate);
      }),
    db("membership_plans").select("key", "name"),
    db("points_packages").select("key", "points", "priceCny", "description"),
  ]);

  const activeUsers = new Set<string>();
  const markActive = (userId: unknown, dateValue: unknown) => {
    if (userId === null || userId === undefined || userId === "") return;
    const bucket = resolveBucket(trendBuckets, dateValue);
    if (!bucket) return;
    const normalizedId = String(userId);
    activeUsers.add(normalizedId);
    bucket.activeUserIds.add(normalizedId);
  };

  for (const row of projectActivityRows as any[]) {
    markActive(row.userId, row.createTime);
  }

  for (const row of taskActivityRows as any[]) {
    markActive(row.userId, row.startTime);
  }

  for (const row of transactionTrendRows as any[]) {
    markActive(row.userId, row.createdAt);
    const amount = toNumber(row.amount);
    if (isConsumeTransaction(String(row.type || ""), amount)) {
      const bucket = resolveBucket(trendBuckets, row.createdAt);
      if (bucket) bucket.pointsConsumed += Math.abs(amount);
    }
  }

  for (const row of orderTrendRows as any[]) {
    const timeValue = row.paidAt || row.createdAt;
    markActive(row.userId, timeValue);
    const bucket = resolveBucket(trendBuckets, timeValue);
    if (bucket) bucket.rechargeAmount += toNumber(row.amountCny);
  }

  for (const row of taskTrendRows as any[]) {
    const bucket = resolveBucket(trendBuckets, row.startTime);
    if (bucket) bucket.modelCalls += 1;
  }

  const monthBuckets = new Map<string, { amount: number; month: string; orders: number }>();
  for (let index = 11; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const key = monthKey(date);
    monthBuckets.set(key, {
      amount: 0,
      month: key,
      orders: 0,
    });
  }
  for (const row of monthlyOrderRows as any[]) {
    const time = toTime(row.paidAt || row.createdAt);
    if (!time) continue;
    const bucket = monthBuckets.get(monthKey(time));
    if (!bucket) continue;
    bucket.amount += toNumber(row.amountCny);
    bucket.orders += 1;
  }

  const pointFlowMap = new Map<string, number>();
  for (const row of pointFlowRows as any[]) {
    const amount = toNumber(row.amount);
    const name = pointFlowName(String(row.type || ""), amount);
    pointFlowMap.set(name, (pointFlowMap.get(name) || 0) + Math.abs(amount));
  }

  const membershipLevelMap = new Map<string, { activeUsers: number; expiredUsers: number; key: string; name: string; totalUsers: number }>();
  for (const row of membershipLevelRows as any[]) {
    const key = String(row.levelKey || "free");
    const name = membershipLevelName(key, String(row.levelName || ""));
    const existing = membershipLevelMap.get(key) || {
      activeUsers: 0,
      expiredUsers: 0,
      key,
      name,
      totalUsers: 0,
    };
    const value = toNumber(row.value);
    existing.totalUsers += value;
    if (row.status === "active") existing.activeUsers += value;
    if (row.status === "expired") existing.expiredUsers += value;
    membershipLevelMap.set(key, existing);
  }

  const modelStatsMap = new Map<
    string,
    {
      failed: number;
      latestAt: null | number;
      model: string;
      running: number;
      success: number;
      total: number;
    }
  >();
  for (const row of modelStateRows as any[]) {
    const model = String(row.model || "未配置");
    const existing = modelStatsMap.get(model) || {
      failed: 0,
      latestAt: null,
      model,
      running: 0,
      success: 0,
      total: 0,
    };
    const value = toNumber(row.value);
    const state = String(row.state || "");
    existing.total += value;
    if (state.includes("完成") || state.includes("成功")) existing.success += value;
    else if (state.includes("失败")) existing.failed += value;
    else existing.running += value;
    const latestAt = toTime(row.latestAt);
    if (latestAt && (!existing.latestAt || latestAt > existing.latestAt)) existing.latestAt = latestAt;
    modelStatsMap.set(model, existing);
  }

  const userMap = new Map<string, { id: string; membershipName: string; name: string }>();
  for (const row of userRows as any[]) {
    const id = String(row.id);
    userMap.set(id, {
      id,
      membershipName: "免费会员",
      name: String(row.realName || row.name || `用户 ${id}`),
    });
  }

  for (const row of userMembershipRows as any[]) {
    const userId = String(row.userId);
    const existing = userMap.get(userId) || {
      id: userId,
      membershipName: "免费会员",
      name: `用户 ${userId}`,
    };
    existing.membershipName = row.status === "active" ? membershipLevelName(String(row.levelKey || "free"), String(row.levelName || "")) : "已过期";
    userMap.set(userId, existing);
  }

  const activeUserMap = new Map<
    string,
    {
      lastActiveAt: null | number;
      membershipName: string;
      modelCalls: number;
      pointsConsumed: number;
      projects: number;
      rechargeAmount: number;
      userId: string;
      userName: string;
    }
  >();
  const ensureActiveUser = (userIdValue: unknown) => {
    const userId = String(userIdValue || "");
    if (!userId) return null;
    const profile = userMap.get(userId);
    const existing =
      activeUserMap.get(userId) ||
      ({
        lastActiveAt: null,
        membershipName: profile?.membershipName || "免费会员",
        modelCalls: 0,
        pointsConsumed: 0,
        projects: 0,
        rechargeAmount: 0,
        userId,
        userName: profile?.name || `用户 ${userId}`,
      });
    activeUserMap.set(userId, existing);
    return existing;
  };

  const projectMap = new Map<string, { id: string; name: string; userId: string; userName: string }>();
  for (const row of projectRows as any[]) {
    const id = String(row.id);
    const userId = row.userId === null || row.userId === undefined ? "" : String(row.userId);
    const profile = userMap.get(userId);
    projectMap.set(id, {
      id,
      name: String(row.name || `项目 ${id}`),
      userId,
      userName: profile?.name || (userId ? `用户 ${userId}` : "-"),
    });
    const createTime = toTime(row.createTime);
    if (userId && createTime && createTime >= startTime) {
      const user = ensureActiveUser(userId);
      if (user) {
        user.projects += 1;
        user.lastActiveAt = maxTime(user.lastActiveAt, row.createTime);
      }
    }
  }

  const activeProjectMap = new Map<
    string,
    {
      failed: number;
      lastTaskAt: null | number;
      modelCalls: number;
      pointsConsumed: number;
      projectId: string;
      projectName: string;
      running: number;
      success: number;
      userName: string;
    }
  >();
  const ensureActiveProject = (projectIdValue: unknown, projectNameValue?: unknown, userIdValue?: unknown) => {
    const projectId = String(projectIdValue || "");
    if (!projectId) return null;
    const project = projectMap.get(projectId);
    const userId = userIdValue === null || userIdValue === undefined ? project?.userId || "" : String(userIdValue);
    const profile = userMap.get(userId);
    const existing =
      activeProjectMap.get(projectId) ||
      ({
        failed: 0,
        lastTaskAt: null,
        modelCalls: 0,
        pointsConsumed: 0,
        projectId,
        projectName: String(projectNameValue || project?.name || `项目 ${projectId}`),
        running: 0,
        success: 0,
        userName: profile?.name || project?.userName || (userId ? `用户 ${userId}` : "-"),
      });
    activeProjectMap.set(projectId, existing);
    return existing;
  };

  for (const row of rangedTaskRows as any[]) {
    const user = ensureActiveUser(row.userId);
    if (user) {
      user.modelCalls += 1;
      user.lastActiveAt = maxTime(user.lastActiveAt, row.startTime);
    }

    const project = ensureActiveProject(row.projectId, row.projectName, row.userId);
    if (!project) continue;
    project.modelCalls += 1;
    project.lastTaskAt = maxTime(project.lastTaskAt, row.startTime);
    const state = String(row.state || "");
    if (state.includes("完成") || state.includes("成功")) project.success += 1;
    else if (state.includes("失败")) project.failed += 1;
    else project.running += 1;
  }

  for (const row of rangedTransactionRows as any[]) {
    const amount = toNumber(row.amount);
    const consumed = isConsumeTransaction(String(row.type || ""), amount) ? Math.abs(amount) : 0;
    const user = ensureActiveUser(row.userId);
    if (user) {
      user.pointsConsumed += consumed;
      user.lastActiveAt = maxTime(user.lastActiveAt, row.createdAt);
    }
    if (row.projectId && consumed > 0) {
      const project = ensureActiveProject(row.projectId);
      if (project) project.pointsConsumed += consumed;
    }
  }

  const planNameMap = new Map<string, string>();
  for (const row of planRows as any[]) {
    planNameMap.set(String(row.key || ""), String(row.name || row.key || "会员套餐"));
  }
  const packageNameMap = new Map<string, string>();
  for (const row of packageRows as any[]) {
    const key = String(row.key || "");
    packageNameMap.set(key, `${toNumber(row.points)} 积分包`);
  }

  const revenueProductMap = new Map<string, { amount: number; kind: string; name: string; orders: number; points: number }>();
  for (const row of rangedOrderRows as any[]) {
    const timeValue = row.paidAt || row.createdAt;
    const user = ensureActiveUser(row.userId);
    if (user) {
      user.lastActiveAt = maxTime(user.lastActiveAt, timeValue);
      if (row.status === "paid") user.rechargeAmount += toNumber(row.amountCny);
    }

    if (row.status !== "paid") continue;
    const kind = String(row.kind || "");
    const productKey = kind === "plan" ? String(row.planKey || "") : String(row.pointsPackageKey || "");
    const mapKey = `${kind}:${productKey || "unknown"}`;
    const existing =
      revenueProductMap.get(mapKey) ||
      ({
        amount: 0,
        kind: productKindName(kind),
        name:
          kind === "plan"
            ? planNameMap.get(productKey) || productKey || "未配置会员套餐"
            : packageNameMap.get(productKey) || productKey || "未配置积分包",
        orders: 0,
        points: 0,
      });
    existing.amount += toNumber(row.amountCny);
    existing.orders += 1;
    existing.points += toNumber(row.points);
    revenueProductMap.set(mapKey, existing);
  }

  const taskCount = firstValue(taskCountRows, "value");
  const successCount = firstValue(taskSuccessRows, "value");
  const paidOrderAmount = firstValue(paidOrderRows, "amount");
  const pointsConsumed = pointFlowMap.get("积分消耗") || firstValue(balanceRows, "spent");
  const totalUsers = firstValue(userCountRows, "value");
  const activeMembers = firstValue(activeMemberRows, "value");
  const paidOrders = firstValue(paidOrderRows, "value");
  const pointsBalance = firstValue(balanceRows, "balance");
  const successRate = percent(successCount, taskCount);
  const pendingOrders = (orderStatusRows as any[]).reduce((sum, row) => (row.status === "pending" ? sum + toNumber(row.value) : sum), 0);
  const modelStats = Array.from(modelStatsMap.values())
    .map((item) => ({
      ...item,
      successRate: percent(item.success, item.total),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  const activeProjectsList = Array.from(activeProjectMap.values())
    .map((item) => ({
      ...item,
      pointsConsumed: roundAmount(item.pointsConsumed),
      successRate: percent(item.success, item.modelCalls),
    }))
    .sort((a, b) => b.modelCalls - a.modelCalls || b.pointsConsumed - a.pointsConsumed)
    .slice(0, 10);
  const activeUsersList = Array.from(activeUserMap.values())
    .map((item) => ({
      ...item,
      pointsConsumed: roundAmount(item.pointsConsumed),
      rechargeAmount: roundAmount(item.rechargeAmount),
    }))
    .sort((a, b) => b.modelCalls - a.modelCalls || b.pointsConsumed - a.pointsConsumed || b.rechargeAmount - a.rechargeAmount)
    .slice(0, 10);
  const revenueProducts = Array.from(revenueProductMap.values())
    .map((item) => ({
      ...item,
      amount: roundAmount(item.amount),
    }))
    .sort((a, b) => b.amount - a.amount || b.orders - a.orders)
    .slice(0, 10);
  const recentPointTransactions = (rangedTransactionRows as any[]).slice(0, 10).map((row) => {
    const amount = toNumber(row.amount);
    return {
      amount,
      balanceAfter: toNumber(row.balanceAfter),
      createdAt: toTime(row.createdAt),
      description: String(row.description || ""),
      id: String(row.id),
      projectId: row.projectId === null || row.projectId === undefined ? null : String(row.projectId),
      taskType: row.taskType || "",
      type: pointTransactionName(String(row.type || ""), amount),
      userId: String(row.userId || ""),
      userName: row.userName || userMap.get(String(row.userId || ""))?.name || "未知用户",
    };
  });
  const pointBuckets = [
    { name: "会员赠送", value: firstValue(balanceRows, "membership") },
    { name: "充值积分", value: firstValue(balanceRows, "recharge") },
    { name: "活动赠送", value: firstValue(balanceRows, "bonus") },
    { name: "冻结积分", value: firstValue(balanceRows, "frozen") },
  ].filter((item) => item.value > 0);
  const orderStatus = (orderStatusRows as any[]).map((row) => ({
    amount: toNumber(row.amount),
    name: orderStatusName(String(row.status || "")),
    orders: toNumber(row.value),
    value: toNumber(row.value),
  }));
  const insights: Array<{
    action: string;
    description: string;
    level: "info" | "success" | "warning";
    metric: string;
    title: string;
  }> = [];
  const lowestModel = modelStats.filter((item) => item.total >= 3).sort((a, b) => a.successRate - b.successRate)[0];
  const topUser = activeUsersList[0];
  const topProject = activeProjectsList[0];

  if (successRate >= 95 && taskCount > 0) {
    pushInsight(insights, {
      action: "继续观察失败任务和模型版本变化。",
      description: `当前累计 ${taskCount} 次模型任务，成功率保持在 ${successRate}%。`,
      level: "success",
      metric: `${successRate}%`,
      title: "模型任务运行稳定",
    });
  } else if (taskCount > 0) {
    pushInsight(insights, {
      action: "优先排查失败任务、模型供应商配置和超时错误。",
      description: `当前累计 ${taskCount} 次模型任务，成功率为 ${successRate}%。`,
      level: "warning",
      metric: `${successRate}%`,
      title: "模型任务成功率偏低",
    });
  }

  if (activeUsers.size > 0 && paidOrders === 0) {
    pushInsight(insights, {
      action: "检查会员权益、支付配置和创作后的付费转化入口。",
      description: `近 ${trendDays} 天有 ${activeUsers.size} 个活跃用户和 ${taskCount} 次模型调用，但暂无已支付订单。`,
      level: "warning",
      metric: "0 单",
      title: "活跃使用未转化为充值",
    });
  }

  if (pendingOrders > 0) {
    pushInsight(insights, {
      action: "进入订单列表跟进待支付订单，确认支付回调是否正常。",
      description: `当前存在 ${pendingOrders} 笔待支付订单。`,
      level: "warning",
      metric: `${pendingOrders} 单`,
      title: "待支付订单需要跟进",
    });
  }

  if (firstValue(expiringMemberRows, "value") > 0) {
    const expiringMembers = firstValue(expiringMemberRows, "value");
    pushInsight(insights, {
      action: "对即将到期会员做续费提醒或权益召回。",
      description: `未来 7 天有 ${expiringMembers} 个有效会员即将到期。`,
      level: "info",
      metric: `${expiringMembers} 人`,
      title: "会员续费窗口已出现",
    });
  }

  if (lowestModel && lowestModel.successRate < 90) {
    pushInsight(insights, {
      action: "对比该模型最近失败任务，必要时切换默认模型或供应商。",
      description: `${lowestModel.model} 调用 ${lowestModel.total} 次，成功率 ${lowestModel.successRate}%。`,
      level: "warning",
      metric: `${lowestModel.successRate}%`,
      title: "存在低成功率模型",
    });
  }

  if (topUser) {
    pushInsight(insights, {
      action: "结合积分流水和项目排行确认是否为正常高频创作。",
      description: `${topUser.userName} 贡献了 ${topUser.modelCalls} 次模型调用。`,
      level: "info",
      metric: `${topUser.modelCalls} 次`,
      title: "调用量集中用户",
    });
  }

  if (topProject) {
    pushInsight(insights, {
      action: "关注该项目的后续生成成功率和积分消耗变化。",
      description: `${topProject.projectName} 是当前调用最高项目，成功率 ${topProject.successRate}%。`,
      level: topProject.successRate >= 95 ? "success" : "info",
      metric: `${topProject.modelCalls} 次`,
      title: "高频项目已识别",
    });
  }

  if (revenueProducts.length === 0 && paidOrders === 0) {
    pushInsight(insights, {
      action: "在会员中心确认套餐可见、支付方式可用，并检查用户转化路径。",
      description: "当前统计范围内暂无付费产品收入。",
      level: "info",
      metric: "¥0",
      title: "暂无付费产品收入",
    });
  }

  return {
    generatedAt: now.toISOString(),
    range: {
      days: trendDays,
      endDate: dateKey(now),
      startDate: dateKey(startDate),
    },
    overview: {
      activeMembers,
      activeRate: percent(activeUsers.size, totalUsers),
      activeUsers30d: activeUsers.size,
      averageOrderAmount: paidOrders > 0 ? roundAmount(paidOrderAmount / paidOrders) : 0,
      expiringMembers7d: firstValue(expiringMemberRows, "value"),
      memberConversionRate: percent(activeMembers, totalUsers),
      modelCalls: taskCount,
      paidOrders,
      pendingOrders,
      pointsBalance,
      pointsBonus: firstValue(balanceRows, "bonus"),
      pointsBurnRate: percent(pointsConsumed, pointsConsumed + pointsBalance),
      pointsConsumed,
      pointsFrozen: firstValue(balanceRows, "frozen"),
      pointsMembership: firstValue(balanceRows, "membership"),
      pointsRecharge: firstValue(balanceRows, "recharge"),
      projects: firstValue(projectCountRows, "value"),
      rechargeAmount: paidOrderAmount,
      successRate,
      totalUsers,
    },
    insights,
    membershipLevels: Array.from(membershipLevelMap.values()).sort((a, b) => b.activeUsers - a.activeUsers),
    activeProjects: activeProjectsList,
    activeUsers: activeUsersList,
    modelUsage: normalizeChartRows(modelUsageRows as any[], "model"),
    modelStats,
    monthlyRecharge: Array.from(monthBuckets.values()),
    orderStatus,
    pointBuckets,
    pointFlow: Array.from(pointFlowMap.entries()).map(([name, value]) => ({ name, value })),
    rechargeBreakdown: (paidOrderKindRows as any[]).map((row) => ({
      amount: toNumber(row.amount),
      name: row.kind === "plan" ? "会员订阅" : row.kind === "points" ? "积分包充值" : String(row.kind || "其他"),
      orders: toNumber(row.value),
      value: toNumber(row.amount),
    })),
    recentPointTransactions,
    recentTasks: (recentTasks as any[]).map((row) => ({
      id: String(row.id),
      model: row.model || "未配置",
      projectId: row.projectId === null || row.projectId === undefined ? null : String(row.projectId),
      projectName: row.projectName || "",
      startTime: toTime(row.startTime),
      state: row.state || "未知",
      taskClass: row.taskClass || "未分类",
    })),
    stateUsage: normalizeChartRows(stateUsageRows as any[], "state"),
    revenueProducts,
    taskUsage: normalizeChartRows(taskUsageRows as any[], "taskClass"),
    trend: Array.from(trendBuckets.values()).map((bucket) => ({
      activeUsers: bucket.activeUserIds.size,
      date: bucket.date,
      label: bucket.label,
      modelCalls: bucket.modelCalls,
      pointsConsumed: roundAmount(bucket.pointsConsumed),
      rechargeAmount: roundAmount(bucket.rechargeAmount),
    })),
  };
}
