import type { DB } from "@/types/database";

import { existsSync } from "node:fs";
import os from "node:os";

import getPath from "@/utils/getPath";
import oss from "@/utils/oss";
import { db } from "@/utils/db";
import { getEnabledPaymentOptions, getPaymentConfig } from "@/utils/payment";

type TableName = keyof DB & string;

type ServiceStatusSurface = "admin" | "web";
type HealthStatus = "degraded" | "missing" | "offline" | "online";

type ServiceDependency = {
  action?: string;
  detail: string;
  key: string;
  label: string;
  status: HealthStatus;
  summary: string;
};

const DATA_COUNTS: Array<{ key: string; label: string; table: TableName }> = [
  { key: "users", label: "用户", table: "o_user" },
  { key: "projects", label: "项目", table: "o_project" },
  { key: "scripts", label: "剧本", table: "o_script" },
  { key: "assets", label: "资产", table: "o_assets" },
  { key: "storyboards", label: "分镜", table: "o_storyboard" },
  { key: "images", label: "图片", table: "o_image" },
  { key: "videos", label: "视频", table: "o_video" },
  { key: "vendors", label: "模型服务商", table: "o_vendorConfig" },
];

function numberFromCount(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function hasMeaningfulValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (value && typeof value === "object") return Object.values(value).some(hasMeaningfulValue);
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined && value !== false;
}

async function countTable(table: TableName): Promise<number> {
  const row = await db(table).count<{ count: number | string }>({ count: "*" }).first();
  return numberFromCount(row?.count);
}

async function getDatabaseStatus() {
  const startedAt = Date.now();
  try {
    await db.raw("SELECT 1 AS ok");
    return {
      connected: true,
      error: "",
      responseMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      connected: false,
      error: formatError(error),
      responseMs: Date.now() - startedAt,
    };
  }
}

async function getCounts() {
  return await Promise.all(
    DATA_COUNTS.map(async (item) => {
      try {
        return {
          ...item,
          error: "",
          value: await countTable(item.table),
        };
      } catch (error) {
        return {
          ...item,
          error: formatError(error),
          value: null,
        };
      }
    }),
  );
}

async function getTaskSummary() {
  try {
    const stateRows = (await db("o_tasks")
      .select("state")
      .count<{ count: number | string }>({ count: "*" })
      .groupBy("state")) as Array<{ count: number | string; state: null | string }>;
    const total = stateRows.reduce((sum, row) => sum + numberFromCount(row.count), 0);
    const byState = stateRows.map((row) => ({
      count: numberFromCount(row.count),
      state: row.state || "未知",
    }));
    const countFor = (state: string) => byState.find((item) => item.state === state)?.count ?? 0;
    const recent = await db("o_tasks")
      .select("id", "taskClass", "model", "state", "startTime", "reason")
      .orderBy("id", "desc")
      .limit(8);

    return {
      byState,
      completed: countFor("已完成"),
      error: "",
      failed: countFor("生成失败"),
      recent,
      running: countFor("进行中"),
      total,
    };
  } catch (error) {
    return {
      byState: [],
      completed: 0,
      error: formatError(error),
      failed: 0,
      recent: [],
      running: 0,
      total: 0,
    };
  }
}

function getRuntimeStatus(surface: ServiceStatusSurface) {
  const uptimeSeconds = Math.floor(process.uptime());
  const webDir = getPath("web");

  return {
    arch: process.arch,
    checkedAt: new Date().toISOString(),
    env: process.env.NODE_ENV || "dev",
    hostname: os.hostname(),
    loadAverage: os.loadavg(),
    memory: {
      free: os.freemem(),
      process: process.memoryUsage(),
      total: os.totalmem(),
    },
    nodeVersion: process.version,
    pid: process.pid,
    platform: `${process.platform}/${process.arch}`,
    port: process.env.PORT || "10588",
    startedAt: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
    status: "online",
    surface,
    uptimeSeconds,
    webDirExists: existsSync(webDir),
  };
}

function getEndpointStatus(webDirExists: boolean) {
  return [
    {
      access: "管理员",
      name: "Admin 运行状态",
      path: "/api/admin/service/status",
      status: "online",
    },
    {
      access: "登录用户",
      name: "Web 运行状态",
      path: "/api/service/status",
      status: "online",
    },
    {
      access: "静态资源",
      name: "Web 静态站点",
      path: "/",
      status: webDirExists ? "online" : "missing",
    },
  ];
}

async function getVendorDependency(): Promise<ServiceDependency> {
  try {
    const rows = await db("o_vendorConfig").select("id", "enable", "inputValues", "models");
    const enabledRows = rows.filter((row) => Number(row.enable ?? 0) === 1);
    const configuredRows = enabledRows.filter((row) => hasMeaningfulValue(parseJsonObject(row.inputValues)));
    const modelCount = enabledRows.reduce((sum, row) => sum + parseJsonArray(row.models).length, 0);
    const status: HealthStatus = enabledRows.length > 0 && modelCount > 0 ? "online" : rows.length > 0 ? "degraded" : "missing";

    return {
      action: "/settings/vendor-config",
      detail:
        enabledRows.length > 0
          ? `${configuredRows.length} 个启用服务商已填写接入参数`
          : "未启用模型服务商，生成链路无法选择可用模型",
      key: "vendor",
      label: "模型服务商",
      status,
      summary: `${enabledRows.length}/${rows.length} 已启用 · ${modelCount} 个模型`,
    };
  } catch (error) {
    return {
      action: "/settings/vendor-config",
      detail: formatError(error),
      key: "vendor",
      label: "模型服务商",
      status: "offline",
      summary: "读取失败",
    };
  }
}

async function getModelMapDependency(): Promise<ServiceDependency> {
  try {
    const row = await db("o_modelPrompt").count<{ count: number | string }>({ count: "*" }).first();
    const total = numberFromCount(row?.count);
    return {
      action: "/settings/model-map",
      detail: total > 0 ? "模型映射可用于图像/视频生成提示词选择" : "尚未配置模型映射，生成入口只能依赖默认模型配置",
      key: "modelMap",
      label: "模型映射",
      status: total > 0 ? "online" : "missing",
      summary: `${total} 条映射`,
    };
  } catch (error) {
    return {
      action: "/settings/model-map",
      detail: formatError(error),
      key: "modelMap",
      label: "模型映射",
      status: "offline",
      summary: "读取失败",
    };
  }
}

async function getMembershipDependency(): Promise<ServiceDependency> {
  try {
    const [enabledPlanRow, paidPlanRow, activeMembershipRow, pointsPackageRow] = await Promise.all([
      db("membership_plans").where("enabled", true).count<{ count: number | string }>({ count: "*" }).first(),
      db("membership_plans").where("enabled", true).where("priceCny", ">", 0).count<{ count: number | string }>({ count: "*" }).first(),
      db("user_memberships").whereNot("levelKey", "free").where("status", "active").count<{ count: number | string }>({ count: "*" }).first(),
      db("points_packages").where("enabled", true).count<{ count: number | string }>({ count: "*" }).first(),
    ]);
    const enabledPlans = numberFromCount(enabledPlanRow?.count);
    const paidPlans = numberFromCount(paidPlanRow?.count);
    const activePaidUsers = numberFromCount(activeMembershipRow?.count);
    const pointsPackages = numberFromCount(pointsPackageRow?.count);

    return {
      action: "/membership/plans",
      detail: `${paidPlans} 个付费方案 · ${pointsPackages} 个积分包 · ${activePaidUsers} 个有效付费会员`,
      key: "membership",
      label: "会员体系",
      status: enabledPlans > 0 ? "online" : "missing",
      summary: `${enabledPlans} 个启用方案`,
    };
  } catch (error) {
    return {
      action: "/membership/plans",
      detail: formatError(error),
      key: "membership",
      label: "会员体系",
      status: "offline",
      summary: "读取失败",
    };
  }
}

async function getPaymentDependency(): Promise<ServiceDependency> {
  try {
    const [config, paidPlanRow] = await Promise.all([
      getPaymentConfig(),
      db("membership_plans").where("enabled", true).where("priceCny", ">", 0).count<{ count: number | string }>({ count: "*" }).first(),
    ]);
    const options = getEnabledPaymentOptions(config);
    const paidPlans = numberFromCount(paidPlanRow?.count);
    const providers = options.providers.map((item) => item.label);
    const hasProvider = providers.length > 0;

    return {
      action: "/settings/payment-config",
      detail: hasProvider
        ? `默认通道：${options.defaultProvider} · 公网地址${config.publicBaseUrl ? "已配置" : "未配置"}`
        : paidPlans > 0
          ? "存在付费会员方案，但还没有启用支付通道"
          : "当前未启用支付通道",
      key: "payment",
      label: "支付服务",
      status: hasProvider ? "online" : paidPlans > 0 ? "missing" : "degraded",
      summary: hasProvider ? providers.join(" / ") : "未启用",
    };
  } catch (error) {
    return {
      action: "/settings/payment-config",
      detail: formatError(error),
      key: "payment",
      label: "支付服务",
      status: "offline",
      summary: "读取失败",
    };
  }
}

function getStaticSiteDependency(webDirExists: boolean): ServiceDependency {
  return {
    detail: webDirExists ? "data/web 静态目录已挂载到服务根路径" : "data/web 静态目录不存在，生产静态站点尚未构建或未部署",
    key: "staticSite",
    label: "Web 静态站点",
    status: webDirExists ? "online" : "missing",
    summary: webDirExists ? "已挂载" : "未构建",
  };
}

function getStorageDependency(storage: { description: string; remoteEnabled: boolean; status: HealthStatus }): ServiceDependency {
  return {
    action: "/settings/oss-config",
    detail: storage.description,
    key: "storage",
    label: "存储服务",
    status: storage.status,
    summary: storage.remoteEnabled ? "远程 OSS" : "本地存储",
  };
}

async function getServiceDependencies(
  runtime: ReturnType<typeof getRuntimeStatus>,
  storage: { description: string; remoteEnabled: boolean; status: HealthStatus },
) {
  const [vendor, modelMap, membership, payment] = await Promise.all([
    getVendorDependency(),
    getModelMapDependency(),
    getMembershipDependency(),
    getPaymentDependency(),
  ]);

  return [vendor, modelMap, membership, payment, getStorageDependency(storage), getStaticSiteDependency(runtime.webDirExists)];
}

function buildOverallStatus(database: Awaited<ReturnType<typeof getDatabaseStatus>>, tasks: Awaited<ReturnType<typeof getTaskSummary>>, dependencies: ServiceDependency[]) {
  if (!database.connected) {
    return {
      detail: database.error,
      status: "offline" as HealthStatus,
      summary: "数据库不可用",
    };
  }

  const offlineCount = dependencies.filter((item) => item.status === "offline").length;
  const attentionCount = dependencies.filter((item) => item.status !== "online").length + (tasks.failed > 0 ? 1 : 0) + (tasks.error ? 1 : 0);
  if (offlineCount > 0) {
    return {
      detail: `${offlineCount} 个依赖读取失败`,
      status: "offline" as HealthStatus,
      summary: "依赖异常",
    };
  }
  if (attentionCount > 0) {
    return {
      detail: `${attentionCount} 项需要配置或关注`,
      status: "degraded" as HealthStatus,
      summary: "部分服务待完善",
    };
  }
  return {
    detail: "核心依赖均可用",
    status: "online" as HealthStatus,
    summary: "全部正常",
  };
}

export async function getServiceStatus(surface: ServiceStatusSurface = "web") {
  const [database, counts, tasks] = await Promise.all([getDatabaseStatus(), getCounts(), getTaskSummary()]);
  const runtime = getRuntimeStatus(surface);
  const storage = {
    description: oss.getStorageDescription(),
    remoteEnabled: oss.isRemoteEnabled(),
    status: "online" as HealthStatus,
  };
  const dependencies = await getServiceDependencies(runtime, storage);
  const overall = buildOverallStatus(database, tasks, dependencies);

  return {
    checkedAt: runtime.checkedAt,
    counts,
    database,
    dependencies,
    endpoints: getEndpointStatus(runtime.webDirExists),
    overall,
    runtime,
    storage,
    tasks,
  };
}
