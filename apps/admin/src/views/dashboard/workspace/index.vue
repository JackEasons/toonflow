<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@super/common-ui';
import { useUserStore } from '@super/stores';

import axios from '#/utils/axios';

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
    surface: 'admin' | 'web';
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

const userStore = useUserStore();
const router = useRouter();

const serviceStatus = ref<null | ServiceStatus>(null);
const loading = ref(false);
const errorText = ref('');

const endpointColumns = [
  { colKey: 'name', title: '接口', width: 160 },
  { colKey: 'path', title: '路径' },
  { colKey: 'access', title: '访问范围', width: 120 },
  { colKey: 'status', title: '状态', width: 110 },
];

const dependencyColumns = [
  { colKey: 'label', title: '依赖服务', width: 140 },
  { colKey: 'summary', title: '摘要', width: 170 },
  { colKey: 'detail', title: '说明' },
  { colKey: 'status', title: '状态', width: 110 },
];

const taskColumns = [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'taskClass', title: '任务类型', width: 160 },
  { colKey: 'model', title: '模型' },
  { colKey: 'state', title: '状态', width: 110 },
  { colKey: 'startTime', title: '开始时间', width: 180 },
];

const quickLinks = [
  { path: '/settings/vendor-config', title: '模型服务' },
  { path: '/settings/model-map', title: '模型映射' },
  { path: '/settings/oss-config', title: 'OSS 配置' },
  { path: '/settings/db-config', title: '数据库' },
];

const summaryCards = computed(() => {
  const data = serviceStatus.value;
  if (!data) return [];

  return [
    {
      label: '服务状态',
      meta: `${data.overall.summary} · ${data.overall.detail}`,
      status: data.overall.status,
      value: getStatusLabel(data.overall.status),
    },
    {
      label: '运行时长',
      meta: `启动于 ${formatDate(data.runtime.startedAt)}`,
      status: 'online',
      value: formatUptime(data.runtime.uptimeSeconds),
    },
    {
      label: '数据库',
      meta: data.database.connected ? 'MySQL 已连接' : data.database.error,
      status: data.database.connected ? 'online' : 'offline',
      value: data.database.connected ? `${data.database.responseMs} ms` : '异常',
    },
    {
      label: '任务队列',
      meta: `失败 ${data.tasks.failed} / 总计 ${data.tasks.total}`,
      status: data.tasks.error ? 'offline' : data.tasks.failed > 0 ? 'degraded' : 'online',
      value: `${data.tasks.running} 进行中`,
    },
  ];
});

const countRows = computed(() => serviceStatus.value?.counts ?? []);
const dependencyRows = computed(() => serviceStatus.value?.dependencies ?? []);
const endpointRows = computed(() => serviceStatus.value?.endpoints ?? []);
const recentTasks = computed(() => serviceStatus.value?.tasks.recent ?? []);

const runtimeRows = computed(() => {
  const runtime = serviceStatus.value?.runtime;
  if (!runtime) return [];

  return [
    { label: '服务地址', value: `http://localhost:${runtime.port}` },
    { label: '运行环境', value: runtime.env },
    { label: 'Node.js', value: runtime.nodeVersion },
    { label: '进程', value: `PID ${runtime.pid}` },
    { label: '主机', value: runtime.hostname },
    { label: '平台', value: runtime.platform },
    { label: 'CPU 负载', value: runtime.loadAverage.slice(0, 3).map((item) => item.toFixed(2)).join(' / ') },
    { label: '进程内存', value: `${formatBytes(runtime.memory.process.rss)} RSS / ${formatBytes(runtime.memory.process.heapUsed)} Heap` },
    { label: '系统内存', value: `${formatBytes(runtime.memory.free)} 可用 / ${formatBytes(runtime.memory.total)} 总计` },
    { label: 'Web 静态站点', value: runtime.webDirExists ? '已挂载' : '未构建' },
  ];
});

const storageRows = computed(() => {
  const storage = serviceStatus.value?.storage;
  if (!storage) return [];
  return [
    { label: '存储模式', value: storage.remoteEnabled ? '远程 OSS' : '本地存储' },
    { label: '运行描述', value: storage.description },
  ];
});

async function loadStatus() {
  loading.value = true;
  errorText.value = '';
  try {
    const res: any = await axios.get('/admin/service/status');
    serviceStatus.value = res.data;
  } catch (error: any) {
    errorText.value = error?.message || '服务运行状态读取失败';
  } finally {
    loading.value = false;
  }
}

function navTo(path: string) {
  router.push(path);
}

function getStatusTheme(status?: string) {
  if (status === 'online') return 'success';
  if (status === 'degraded' || status === 'missing') return 'warning';
  if (status === 'offline') return 'danger';
  return 'default';
}

function getStatusLabel(status?: string) {
  if (status === 'online') return '运行中';
  if (status === 'degraded') return '需关注';
  if (status === 'missing') return '未就绪';
  if (status === 'offline') return '异常';
  return '未知';
}

function getTaskStateTheme(state?: null | string) {
  if (state === '已完成') return 'success';
  if (state === '进行中') return 'primary';
  if (state === '生成失败') return 'danger';
  return 'default';
}

function formatBytes(value?: number) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value?: number | string) {
  if (!value) return '-';
  const date = new Date(typeof value === 'number' ? value : value);
  if (Number.isNaN(date.getTime())) return '-';
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

<template>
  <Page title="服务运行情况" header-class="service-page-header">
    <template #description>
      <div class="mt-2 text-foreground/70">
        {{ userStore.userInfo?.realName || userStore.userInfo?.username || '管理员' }}
        · 最近刷新 {{ serviceStatus ? formatDate(serviceStatus.checkedAt) : '-' }}
      </div>
    </template>
    <template #extra>
      <div class="workspace-actions">
        <t-button v-for="item in quickLinks" :key="item.path" variant="outline" @click="navTo(item.path)">
          {{ item.title }}
        </t-button>
        <t-button theme="primary" :loading="loading" @click="loadStatus">
          <template #icon><t-icon name="refresh" /></template>
          刷新
        </t-button>
      </div>
    </template>

    <t-alert v-if="errorText" class="mb-4" theme="error" :message="errorText" />

    <t-loading :loading="loading && !serviceStatus" size="large">
      <template v-if="serviceStatus">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <t-card v-for="card in summaryCards" :key="card.label" :bordered="false">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-xl font-semibold">{{ card.label }}</div>
                <div class="mt-5 break-words text-3xl font-semibold">{{ card.value }}</div>
              </div>
              <t-tag class="shrink-0" :theme="getStatusTheme(card.status)" variant="light">
                {{ getStatusLabel(card.status) }}
              </t-tag>
            </div>
            <div class="mt-5 break-words text-sm text-foreground/70">{{ card.meta }}</div>
          </t-card>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <t-card title="接口运行状态" :bordered="false" class="xl:col-span-2">
            <div class="admin-table">
              <t-table row-key="path" hover :columns="endpointColumns" :data="endpointRows" :pagination="null">
                <template #path="{ row }">
                  <code>{{ row.path }}</code>
                </template>
                <template #status="{ row }">
                  <t-tag :theme="getStatusTheme(row.status)" variant="light">
                    {{ getStatusLabel(row.status) }}
                  </t-tag>
                </template>
              </t-table>
            </div>
          </t-card>

          <t-card title="数据规模" :bordered="false">
            <div class="count-grid">
              <div v-for="item in countRows" :key="item.key" class="count-item" :class="{ warning: item.error }">
                <span>{{ item.label }}</span>
                <strong>{{ item.value ?? '-' }}</strong>
                <small>{{ item.error || item.table }}</small>
              </div>
            </div>
          </t-card>
        </div>

        <t-card class="mt-5" title="依赖服务" :bordered="false">
          <div class="admin-table">
            <t-table row-key="key" hover :columns="dependencyColumns" :data="dependencyRows" :pagination="null">
              <template #label="{ row }">
                <button v-if="row.action" class="link-button" type="button" @click="navTo(row.action)">
                  {{ row.label }}
                </button>
                <span v-else>{{ row.label }}</span>
              </template>
              <template #detail="{ row }">
                <span class="detail-cell">{{ row.detail }}</span>
              </template>
              <template #status="{ row }">
                <t-tag :theme="getStatusTheme(row.status)" variant="light">
                  {{ getStatusLabel(row.status) }}
                </t-tag>
              </template>
            </t-table>
          </div>
        </t-card>

        <t-card class="mt-5" title="任务队列" :bordered="false">
          <div class="task-state-row">
            <div v-for="item in serviceStatus.tasks.byState" :key="item.state" class="task-state-item">
              <span>{{ item.state }}</span>
              <strong>{{ item.count }}</strong>
            </div>
            <div v-if="serviceStatus.tasks.byState.length === 0" class="task-state-item">
              <span>暂无任务</span>
              <strong>0</strong>
            </div>
          </div>
          <t-alert v-if="serviceStatus.tasks.error" class="mt-3" theme="error" :message="serviceStatus.tasks.error" />
          <div class="admin-table mt-4">
            <t-table row-key="id" hover :columns="taskColumns" :data="recentTasks" max-height="320" :pagination="null">
              <template #state="{ row }">
                <t-tag :theme="getTaskStateTheme(row.state)" variant="light">
                  {{ row.state || '未知' }}
                </t-tag>
              </template>
              <template #startTime="{ row }">
                {{ formatDate(row.startTime) }}
              </template>
              <template #empty>
                <t-empty description="暂无任务记录" />
              </template>
            </t-table>
          </div>
        </t-card>

        <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <t-card title="运行环境" :bordered="false">
            <dl class="detail-list">
              <template v-for="row in runtimeRows" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </template>
            </dl>
          </t-card>

          <t-card title="存储服务" :bordered="false">
            <dl class="detail-list">
              <template v-for="row in storageRows" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </template>
            </dl>
          </t-card>
        </div>
      </template>

      <t-empty v-else description="暂无服务运行数据" />
    </t-loading>
  </Page>
</template>

<style scoped>
:deep(.service-page-header) {
  gap: 16px;
}

:deep(.service-page-header > div:first-child) {
  min-width: 0;
}

.admin-table {
  min-width: 0;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
}

.admin-table :deep(.t-table) {
  min-width: 0;
}

.workspace-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.link-button {
  padding: 0;
  color: var(--td-brand-color);
  font: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.detail-cell {
  display: inline-block;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.count-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.count-item {
  min-width: 0;
  padding: 12px;
  background: var(--td-bg-color-container-hover);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
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
  line-height: 1.25;
}

.count-item small {
  display: block;
  min-height: 18px;
  margin-top: 4px;
  overflow-wrap: anywhere;
  color: var(--td-text-color-placeholder);
  font-size: 12px;
}

.task-state-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.task-state-item {
  min-width: 0;
  padding: 12px;
  background: var(--td-bg-color-container-hover);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
}

.detail-list {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
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
}

code {
  color: var(--td-brand-color);
  font-family: var(--td-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace);
  font-size: 12px;
}

@media (max-width: 760px) {
  :deep(.service-page-header) {
    align-items: flex-start;
    flex-direction: column;
  }

  :deep(.service-page-header > div:last-child),
  .workspace-actions {
    width: 100%;
  }

  .workspace-actions {
    justify-content: flex-start;
  }

  .workspace-actions .t-button {
    flex: 1 1 calc(50% - 4px);
    min-width: 0;
  }

  .count-grid,
  .task-state-row {
    grid-template-columns: 1fr;
  }

  .detail-list {
    grid-template-columns: 1fr;
  }
}
</style>
