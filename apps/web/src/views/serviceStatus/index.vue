<template>
  <div class="service-status-page">
    <div class="page-header">
      <div class="title-block">
        <span class="eyebrow">Web Workspace</span>
        <h1>服务运行情况</h1>
        <p>Web 端接口、数据库、任务队列和存储服务的实时运行状态。</p>
        <span class="refresh-time">最近刷新：{{ serviceStatus ? formatDate(serviceStatus.checkedAt) : "-" }}</span>
      </div>
      <t-button theme="primary" :loading="loading" @click="loadStatus">
        <template #icon>
          <i-redo />
        </template>
        刷新
      </t-button>
    </div>

    <t-alert v-if="errorText" class="status-alert" theme="error" :message="errorText" />

    <t-loading :loading="loading && !serviceStatus" size="large">
      <template v-if="serviceStatus">
        <div class="summary-grid">
          <div v-for="card in summaryCards" :key="card.label" class="metric-card">
            <div class="metric-head">
              <span>{{ card.label }}</span>
              <t-tag :theme="getStatusTheme(card.status)" variant="light">
                {{ getStatusLabel(card.status) }}
              </t-tag>
            </div>
            <strong>{{ card.value }}</strong>
            <p>{{ card.meta }}</p>
          </div>
        </div>

        <div class="content-grid">
          <section class="section-panel endpoint-panel">
            <div class="section-head">
              <h2>接口运行状态</h2>
              <span>{{ serviceStatus.endpoints.length }} 个入口</span>
            </div>
            <div class="endpoint-list">
              <div v-for="item in serviceStatus.endpoints" :key="item.path" class="endpoint-row">
                <div class="endpoint-main">
                  <strong>{{ item.name }}</strong>
                  <code>{{ item.path }}</code>
                </div>
                <span class="endpoint-access">{{ item.access }}</span>
                <t-tag :theme="getStatusTheme(item.status)" variant="light">
                  {{ getStatusLabel(item.status) }}
                </t-tag>
              </div>
            </div>
          </section>

          <section class="section-panel dependency-panel wide-panel">
            <div class="section-head">
              <h2>依赖服务</h2>
              <span>{{ dependencyRows.length }} 项检查</span>
            </div>
            <div class="dependency-list">
              <div v-for="item in dependencyRows" :key="item.key" class="dependency-row">
                <div class="dependency-main">
                  <strong>{{ item.label }}</strong>
                  <span>{{ item.summary }}</span>
                </div>
                <p>{{ item.detail }}</p>
                <t-tag :theme="getStatusTheme(item.status)" variant="light">
                  {{ getStatusLabel(item.status) }}
                </t-tag>
              </div>
            </div>
          </section>

          <section class="section-panel">
            <div class="section-head">
              <h2>数据规模</h2>
              <span>{{ availableCountTotal }} 条记录</span>
            </div>
            <div class="count-grid">
              <div v-for="item in serviceStatus.counts" :key="item.key" class="count-item" :class="{ warning: item.error }">
                <span>{{ item.label }}</span>
                <strong>{{ item.value ?? "-" }}</strong>
                <small>{{ item.error || item.table }}</small>
              </div>
            </div>
          </section>

          <section class="section-panel wide-panel">
            <div class="section-head">
              <h2>任务队列</h2>
              <span>总计 {{ serviceStatus.tasks.total }} · 进行中 {{ serviceStatus.tasks.running }}</span>
            </div>
            <div class="task-state-grid">
              <div v-for="item in taskStates" :key="item.state" class="task-state-item">
                <span>{{ item.state }}</span>
                <strong>{{ item.count }}</strong>
              </div>
            </div>
            <t-alert v-if="serviceStatus.tasks.error" class="status-alert" theme="error" :message="serviceStatus.tasks.error" />
            <div class="recent-task-list">
              <div v-for="task in serviceStatus.tasks.recent" :key="task.id" class="task-row">
                <div>
                  <strong>{{ task.taskClass || "未知任务" }}</strong>
                  <span>{{ task.model || "-" }}</span>
                </div>
                <t-tag :theme="getTaskStateTheme(task.state)" variant="light">
                  {{ task.state || "未知" }}
                </t-tag>
                <time>{{ formatDate(task.startTime) }}</time>
              </div>
              <t-empty v-if="serviceStatus.tasks.recent.length === 0" description="暂无任务记录" />
            </div>
          </section>

          <section class="section-panel">
            <div class="section-head">
              <h2>运行环境</h2>
              <span>{{ serviceStatus.runtime.env }}</span>
            </div>
            <dl class="detail-list">
              <template v-for="row in runtimeRows" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </template>
            </dl>
          </section>

          <section class="section-panel">
            <div class="section-head">
              <h2>存储服务</h2>
              <span>{{ serviceStatus.storage.remoteEnabled ? "远程 OSS" : "本地存储" }}</span>
            </div>
            <dl class="detail-list">
              <template v-for="row in storageRows" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </template>
            </dl>
          </section>
        </div>
      </template>

      <t-empty v-else description="暂无服务运行数据" />
    </t-loading>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import axios from "#/utils/axios";

type CountItem = {
  error: string;
  key: string;
  label: string;
  table: string;
  value: null | number;
};

type EndpointStatus = {
  access: string;
  name: string;
  path: string;
  status: string;
};

type RecentTask = {
  id: number | string;
  model?: null | string;
  reason?: null | string;
  startTime?: number | string;
  state?: null | string;
  taskClass?: null | string;
};

type ServiceDependency = {
  action?: string;
  detail: string;
  key: string;
  label: string;
  status: string;
  summary: string;
};

type ServiceStatus = {
  checkedAt: string;
  counts: CountItem[];
  database: {
    connected: boolean;
    error: string;
    responseMs: number;
  };
  dependencies: ServiceDependency[];
  endpoints: EndpointStatus[];
  overall: {
    detail: string;
    status: string;
    summary: string;
  };
  runtime: {
    arch: string;
    checkedAt: string;
    env: string;
    hostname: string;
    loadAverage: number[];
    memory: {
      free: number;
      process: {
        arrayBuffers: number;
        external: number;
        heapTotal: number;
        heapUsed: number;
        rss: number;
      };
      total: number;
    };
    nodeVersion: string;
    pid: number;
    platform: string;
    port: string;
    startedAt: string;
    status: string;
    surface: "admin" | "web";
    uptimeSeconds: number;
    webDirExists: boolean;
  };
  storage: {
    description: string;
    remoteEnabled: boolean;
    status: string;
  };
  tasks: {
    byState: Array<{ count: number; state: string }>;
    completed: number;
    error: string;
    failed: number;
    recent: RecentTask[];
    running: number;
    total: number;
  };
};

const serviceStatus = ref<null | ServiceStatus>(null);
const loading = ref(false);
const errorText = ref("");

const summaryCards = computed(() => {
  const data = serviceStatus.value;
  if (!data) return [];

  return [
    {
      label: "Web 服务",
      meta: `${data.overall.summary} · ${data.overall.detail}`,
      status: data.overall.status,
      value: getStatusLabel(data.overall.status),
    },
    {
      label: "数据库",
      meta: data.database.connected ? "MySQL 已连接" : data.database.error || "连接失败",
      status: data.database.connected ? "online" : "offline",
      value: data.database.connected ? `${data.database.responseMs} ms` : "异常",
    },
    {
      label: "任务队列",
      meta: `失败 ${data.tasks.failed} / 总计 ${data.tasks.total}`,
      status: data.tasks.error ? "offline" : data.tasks.failed > 0 ? "degraded" : "online",
      value: `${data.tasks.running} 进行中`,
    },
    {
      label: "存储服务",
      meta: data.storage.description,
      status: data.storage.status,
      value: data.storage.remoteEnabled ? "远程 OSS" : "本地存储",
    },
  ];
});

const availableCountTotal = computed(() =>
  (serviceStatus.value?.counts ?? []).reduce((sum, item) => sum + (typeof item.value === "number" ? item.value : 0), 0),
);

const dependencyRows = computed(() => serviceStatus.value?.dependencies ?? []);

const taskStates = computed(() => {
  const states = serviceStatus.value?.tasks.byState ?? [];
  return states.length > 0 ? states : [{ count: 0, state: "暂无任务" }];
});

const runtimeRows = computed(() => {
  const runtime = serviceStatus.value?.runtime;
  if (!runtime) return [];

  return [
    { label: "服务地址", value: `http://localhost:${runtime.port}` },
    { label: "运行面", value: runtime.surface === "web" ? "Web 端" : "Admin 端" },
    { label: "运行时长", value: formatUptime(runtime.uptimeSeconds) },
    { label: "启动时间", value: formatDate(runtime.startedAt) },
    { label: "Node.js", value: runtime.nodeVersion },
    { label: "主机", value: runtime.hostname },
    { label: "平台", value: runtime.platform },
    { label: "CPU 负载", value: runtime.loadAverage.slice(0, 3).map((item) => item.toFixed(2)).join(" / ") },
    { label: "进程内存", value: `${formatBytes(runtime.memory.process.rss)} RSS / ${formatBytes(runtime.memory.process.heapUsed)} Heap` },
    { label: "系统内存", value: `${formatBytes(runtime.memory.free)} 可用 / ${formatBytes(runtime.memory.total)} 总计` },
    { label: "Web 静态站点", value: runtime.webDirExists ? "已挂载" : "未构建" },
  ];
});

const storageRows = computed(() => {
  const storage = serviceStatus.value?.storage;
  if (!storage) return [];
  return [
    { label: "存储模式", value: storage.remoteEnabled ? "远程 OSS" : "本地存储" },
    { label: "运行描述", value: storage.description },
  ];
});

async function loadStatus() {
  loading.value = true;
  errorText.value = "";
  try {
    const res: any = await axios.get("/service/status");
    serviceStatus.value = res.data;
  } catch (error: any) {
    errorText.value = error?.message || "服务运行状态读取失败";
  } finally {
    loading.value = false;
  }
}

function getStatusTheme(status?: string) {
  if (status === "online") return "success";
  if (status === "degraded" || status === "missing") return "warning";
  if (status === "offline") return "danger";
  return "default";
}

function getStatusLabel(status?: string) {
  if (status === "online") return "运行中";
  if (status === "degraded") return "需关注";
  if (status === "missing") return "未就绪";
  if (status === "offline") return "异常";
  return "未知";
}

function getTaskStateTheme(state?: null | string) {
  if (state === "已完成") return "success";
  if (state === "进行中") return "primary";
  if (state === "生成失败") return "danger";
  return "default";
}

function formatBytes(value?: number) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value?: number | string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatUptime(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟`;
  if (minutes > 0) return `${minutes} 分钟 ${seconds} 秒`;
  return `${seconds} 秒`;
}

onMounted(() => {
  void loadStatus();
});
</script>

<style lang="scss" scoped>
.service-status-page {
  min-height: 100%;
  padding: 30px 0 36px;
  color: var(--td-text-color-primary);
}

.page-header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.title-block {
  min-width: 0;
}

.eyebrow {
  display: block;
  margin-bottom: 7px;
  color: var(--tf-accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
}

.title-block h1 {
  margin: 0;
  color: var(--td-text-color-primary);
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.25;
}

.title-block p,
.refresh-time {
  display: block;
  margin-top: 8px;
  color: var(--td-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.status-alert {
  margin-bottom: 14px;
}

.summary-grid,
.content-grid,
.count-grid,
.task-state-grid {
  display: grid;
  gap: 14px;
}

.summary-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.content-grid {
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.88fr);
  margin-top: 14px;
}

.wide-panel {
  grid-column: 1 / -1;
}

.metric-card,
.section-panel {
  min-width: 0;
  border: 1px solid rgba(118, 218, 204, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.025);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
}

.metric-card {
  padding: 16px;
}

.metric-head,
.section-head {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.metric-head {
  margin-bottom: 13px;
  color: var(--td-text-color-secondary);
  font-size: 13px;
}

.metric-card strong {
  display: block;
  overflow-wrap: anywhere;
  color: var(--td-text-color-primary);
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.25;
}

.metric-card p {
  min-height: 22px;
  margin: 8px 0 0;
  overflow-wrap: anywhere;
  color: var(--td-text-color-placeholder);
  font-size: 12px;
  line-height: 1.5;
}

.section-panel {
  padding: 16px;
}

.section-head {
  margin-bottom: 14px;
}

.section-head h2 {
  margin: 0;
  color: var(--td-text-color-primary);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0;
}

.section-head span {
  color: var(--td-text-color-placeholder);
  font-size: 12px;
  white-space: nowrap;
}

.endpoint-list,
.dependency-list,
.recent-task-list {
  display: grid;
  gap: 10px;
}

.endpoint-row,
.dependency-row,
.task-row {
  display: grid;
  gap: 12px;
  align-items: center;
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.075);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.025);
}

.endpoint-row {
  grid-template-columns: minmax(0, 1fr) 112px 86px;
}

.dependency-row {
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.4fr) 92px;
}

.endpoint-main {
  min-width: 0;
}

.endpoint-main strong,
.dependency-main strong,
.task-row strong {
  display: block;
  overflow-wrap: anywhere;
  color: var(--td-text-color-primary);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
}

.dependency-main,
.dependency-row p {
  min-width: 0;
}

.dependency-main span,
.dependency-row p {
  display: block;
  margin: 5px 0 0;
  overflow-wrap: anywhere;
  color: var(--td-text-color-secondary);
  font-size: 12px;
  line-height: 1.45;
}

code {
  display: block;
  margin-top: 5px;
  overflow-wrap: anywhere;
  color: var(--tf-accent);
  font-family: var(--td-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace);
  font-size: 12px;
  line-height: 1.45;
}

.endpoint-access,
.task-row span,
.task-row time {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--td-text-color-secondary);
  font-size: 12px;
}

.count-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.count-item,
.task-state-item {
  min-width: 0;
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.028);
}

.count-item {
  border: 1px solid rgba(255, 255, 255, 0.075);
}

.count-item.warning {
  border-color: var(--td-warning-color);
}

.count-item span,
.task-state-item span {
  display: block;
  color: var(--td-text-color-secondary);
  font-size: 12px;
}

.count-item strong,
.task-state-item strong {
  display: block;
  margin-top: 6px;
  overflow-wrap: anywhere;
  color: var(--td-text-color-primary);
  font-size: 22px;
  font-weight: 800;
  line-height: 1.25;
}

.count-item small {
  display: block;
  min-height: 18px;
  margin-top: 4px;
  overflow-wrap: anywhere;
  color: var(--td-text-color-placeholder);
  font-size: 12px;
  line-height: 1.45;
}

.task-state-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 14px;
}

.task-row {
  grid-template-columns: minmax(0, 1fr) 92px 180px;
}

.detail-list {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 10px 14px;
  margin: 0;
}

.detail-list dt {
  color: var(--td-text-color-secondary);
  font-size: 13px;
}

.detail-list dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--td-text-color-primary);
  font-size: 13px;
  line-height: 1.5;
}

@media (max-width: 1180px) {
  .summary-grid,
  .content-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .service-status-page {
    padding: 20px 0 28px;
  }

  .page-header {
    flex-direction: column;
  }

  .summary-grid,
  .content-grid,
  .count-grid,
  .task-state-grid {
    grid-template-columns: 1fr;
  }

  .wide-panel {
    grid-column: auto;
  }

  .endpoint-row,
  .dependency-row,
  .task-row,
  .detail-list {
    grid-template-columns: 1fr;
  }
}
</style>
