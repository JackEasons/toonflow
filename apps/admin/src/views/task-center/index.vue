<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Page } from '@super/common-ui';

import { MessagePlugin } from 'tdesign-vue-next';

import {
  fetchAdminTaskDetail,
  fetchAdminTaskOptions,
  fetchAdminTasks,
  formatDateTime,
  formatInt,
  type AdminTaskItem,
  type AdminTaskOptions,
  type TaskBucket,
} from './api';

const loading = ref(false);
const detailLoading = ref(false);
const detailVisible = ref(false);
const keyword = ref('');
const taskClass = ref('');
const taskState = ref('');
const projectId = ref('');
const userId = ref('');
const dateRange = ref<string[]>([]);
const rows = ref<AdminTaskItem[]>([]);
const selectedTask = ref<AdminTaskItem | null>(null);
const options = ref<AdminTaskOptions>({
  projects: [],
  states: [],
  taskClasses: [],
  users: [],
});
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
});
const statistics = ref({
  completed: 0,
  failed: 0,
  running: 0,
  successRate: 0,
  total: 0,
  withNegativePrompt: 0,
  withPrompt: 0,
});
const taskClassBuckets = ref<TaskBucket[]>([]);
const modelBuckets = ref<TaskBucket[]>([]);
const stateBuckets = ref<TaskBucket[]>([]);

const columns = [
  { colKey: 'id', fixed: 'left', title: 'ID', width: 90 },
  { colKey: 'task', fixed: 'left', title: '任务', width: 250 },
  { colKey: 'state', title: '状态', width: 110 },
  { colKey: 'project', title: '项目 / 用户', width: 240 },
  { colKey: 'model', ellipsis: true, title: '模型', width: 260 },
  { colKey: 'billing', title: '积分扣除', width: 160 },
  { colKey: 'relatedObjects', title: '关联对象', width: 180 },
  { colKey: 'promptMeta', title: '提示词记录', width: 180 },
  { colKey: 'reason', ellipsis: true, title: '失败原因', width: 220 },
  { colKey: 'startTime', title: '开始时间', width: 190 },
  { align: 'center', colKey: 'operation', fixed: 'right', title: '操作', width: 100 },
];

const stateOptions = computed(() => [
  { label: '全部状态', value: '' },
  ...options.value.states,
]);
const taskClassOptions = computed(() => [
  { label: '全部任务', value: '' },
  ...options.value.taskClasses,
]);
const projectOptions = computed(() => [
  { label: '全部项目', value: '' },
  ...options.value.projects,
]);
const userOptions = computed(() => [
  { label: '全部用户', value: '' },
  ...options.value.users,
]);

const pageSettledPoints = computed(() =>
  rows.value.reduce((sum, item) => sum + Number(item.billing?.settledPoints || 0), 0),
);

const metricCards = computed(() => [
  {
    desc: `成功率 ${statistics.value.successRate}%`,
    icon: 'chart',
    label: '筛选任务',
    theme: 'primary',
    value: formatInt(statistics.value.total),
  },
  {
    desc: `完成 ${formatInt(statistics.value.completed)}`,
    icon: 'check-circle',
    label: '进行中',
    theme: 'warning',
    value: formatInt(statistics.value.running),
  },
  {
    desc: '需要排查供应商、提示词或资产',
    icon: 'error-circle',
    label: '生成失败',
    theme: 'danger',
    value: formatInt(statistics.value.failed),
  },
  {
    desc: `负面提示词 ${formatInt(statistics.value.withNegativePrompt)}`,
    icon: 'file-copy',
    label: '可审计提示词',
    theme: 'success',
    value: formatInt(statistics.value.withPrompt),
  },
  {
    desc: '当前页已匹配模型扣费',
    icon: 'money',
    label: '本页扣除积分',
    theme: 'primary',
    value: formatPoints(pageSettledPoints.value),
  },
]);

function stateTheme(state: string) {
  if (state === '已完成') return 'success';
  if (state === '进行中') return 'warning';
  if (state === '生成失败') return 'danger';
  return 'default';
}

function bucketTheme(index: number) {
  return ['primary', 'success', 'warning', 'danger'][index % 4];
}

function textOrDash(value: null | number | string | undefined) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function formatPoints(value: null | number | string | undefined) {
  const points = Number(value || 0);
  if (!Number.isFinite(points)) return '0';
  return points.toLocaleString('zh-CN', {
    maximumFractionDigits: 6,
    minimumFractionDigits: Number.isInteger(points) ? 0 : 0,
  });
}

function billingStatusLabel(status: null | string | undefined) {
  const value = status || 'unmatched';
  return (
    {
      frozen: '已冻结',
      released: '已释放',
      settled: '已扣除',
      unmatched: '未匹配',
    } as Record<string, string>
  )[value] || value;
}

function billingStatusTheme(status: null | string | undefined) {
  const value = status || 'unmatched';
  if (value === 'settled') return 'success';
  if (value === 'frozen') return 'warning';
  if (value === 'released') return 'default';
  return 'default';
}

function billingAmountText(row: AdminTaskItem) {
  const billing = row.billing;
  if (!billing) return '未匹配';
  if (billing.settledPoints > 0) return `-${formatPoints(billing.settledPoints)} 积分`;
  if (billing.frozenPoints > 0) return `冻结 ${formatPoints(billing.frozenPoints)}`;
  if (billing.releasedPoints > 0) return `已释放 ${formatPoints(billing.releasedPoints)}`;
  return '未匹配扣费';
}

function hasTokenUsage(usage: AdminTaskItem['billing']['tokenUsage'] | undefined) {
  return !!usage && [usage.promptTokens, usage.completionTokens, usage.reasoningTokens, usage.totalTokens].some((value) => value !== null && value !== undefined);
}

function formatToken(value: null | number | undefined) {
  return value === null || value === undefined ? '-' : Math.round(Number(value || 0)).toLocaleString('zh-CN');
}

function previewText(value: string, maxLength = 80) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '-';
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function formatRelatedObjects(value: string) {
  const text = String(value || '').trim();
  if (!text) return '暂无关联对象';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function relatedSummary(value: string) {
  const text = String(value || '').trim();
  if (!text) return '无';
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return `${parsed.length} 个对象`;
    if (parsed && typeof parsed === 'object') return `${Object.keys(parsed).length} 个字段`;
  } catch {
    return previewText(text, 24);
  }
  return previewText(text, 24);
}

function formatJson(value: unknown) {
  if (!value) return '{}';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseDateRange() {
  const [start, end] = dateRange.value || [];
  const startFrom = start ? new Date(`${start} 00:00:00`).getTime() : undefined;
  const startTo = end ? new Date(`${end} 23:59:59`).getTime() : undefined;
  return {
    startFrom: Number.isFinite(startFrom) ? startFrom : undefined,
    startTo: Number.isFinite(startTo) ? startTo : undefined,
  };
}

function currentParams() {
  const range = parseDateRange();
  return {
    keyword: keyword.value.trim() || undefined,
    page: pagination.value.page,
    pageSize: pagination.value.pageSize,
    projectId: projectId.value || undefined,
    startFrom: range.startFrom,
    startTo: range.startTo,
    state: taskState.value || undefined,
    taskClass: taskClass.value || undefined,
    userId: userId.value || undefined,
  };
}

async function loadOptions() {
  options.value = await fetchAdminTaskOptions();
}

async function loadTasks() {
  loading.value = true;
  try {
    const data = await fetchAdminTasks(currentParams());
    rows.value = data.list;
    pagination.value.total = data.total;
    statistics.value = data.statistics;
    stateBuckets.value = data.stateBuckets;
    taskClassBuckets.value = data.taskClassBuckets;
    modelBuckets.value = data.modelBuckets;
  } catch (err: any) {
    MessagePlugin.error(err?.message || '获取任务列表失败');
  } finally {
    loading.value = false;
  }
}

function submitFilters() {
  pagination.value.page = 1;
  loadTasks();
}

function resetFilters() {
  keyword.value = '';
  taskClass.value = '';
  taskState.value = '';
  projectId.value = '';
  userId.value = '';
  dateRange.value = [];
  submitFilters();
}

function onPageSizeChange() {
  pagination.value.page = 1;
  loadTasks();
}

async function openDetail(row: AdminTaskItem) {
  detailVisible.value = true;
  detailLoading.value = true;
  selectedTask.value = row;
  try {
    selectedTask.value = await fetchAdminTaskDetail(row.id);
  } catch (err: any) {
    MessagePlugin.error(err?.message || '获取任务详情失败');
  } finally {
    detailLoading.value = false;
  }
}

async function copyText(text: string, label: string) {
  if (!text.trim()) {
    MessagePlugin.warning(`${label}为空`);
    return;
  }
  if (!navigator.clipboard?.writeText) {
    MessagePlugin.warning('当前浏览器不支持复制');
    return;
  }
  await navigator.clipboard.writeText(text);
  MessagePlugin.success(`${label}已复制`);
}

onMounted(async () => {
  await Promise.all([loadOptions(), loadTasks()]);
});
</script>

<template>
  <Page auto-content-height content-class="taskCenterPageContent" title="任务中心">
    <template #description>
      <div class="mt-2 text-foreground/70">
        管理员视角查看模型任务、项目归属、提示词审计、负面提示词和失败原因。
      </div>
    </template>
    <template #extra>
      <t-button variant="outline" :loading="loading" @click="loadTasks">
        <template #icon><t-icon name="refresh" /></template>
        刷新
      </t-button>
    </template>

    <div class="taskCenter">
      <section class="metricGrid">
        <div v-for="item in metricCards" :key="item.label" class="metricItem">
          <div class="metricHeader">
            <t-tag :theme="item.theme" variant="light">
              <template #icon><t-icon :name="item.icon" /></template>
              {{ item.label }}
            </t-tag>
          </div>
          <strong>{{ item.value }}</strong>
          <span>{{ item.desc }}</span>
        </div>
      </section>

      <section class="filterBar">
        <t-input class="keywordInput" v-model="keyword" clearable placeholder="搜索任务 ID、模型、提示词、失败原因、项目或用户" @enter="submitFilters" />
        <t-select class="filterSelect" v-model="taskClass" :options="taskClassOptions" filterable placeholder="任务大类" @change="submitFilters" />
        <t-select class="filterSelect" v-model="taskState" :options="stateOptions" placeholder="任务状态" @change="submitFilters" />
        <t-select class="filterSelect" v-model="projectId" :options="projectOptions" filterable placeholder="项目" @change="submitFilters" />
        <t-select class="filterSelect" v-model="userId" :options="userOptions" filterable placeholder="用户" @change="submitFilters" />
        <t-date-range-picker class="dateFilter" v-model="dateRange" clearable @change="submitFilters" />
        <t-space class="filterActions">
          <t-button theme="primary" @click="submitFilters">
            <template #icon><t-icon name="search" /></template>
            查询
          </t-button>
          <t-button variant="outline" @click="resetFilters">重置</t-button>
        </t-space>
      </section>

      <section class="bucketPanel">
        <div class="bucketGroup">
          <span class="bucketTitle">状态分布</span>
          <t-space break-line :size="6">
            <t-tag v-for="item in stateBuckets" :key="item.name" :theme="stateTheme(item.name)" variant="light">
              {{ item.name }} {{ formatInt(item.count) }}
            </t-tag>
            <t-tag v-if="stateBuckets.length === 0" variant="light">暂无数据</t-tag>
          </t-space>
        </div>
        <div class="bucketGroup">
          <span class="bucketTitle">高频任务</span>
          <t-space break-line :size="6">
            <t-tag v-for="(item, index) in taskClassBuckets" :key="item.name" :theme="bucketTheme(index)" variant="light">
              {{ item.name }} {{ formatInt(item.count) }}
            </t-tag>
            <t-tag v-if="taskClassBuckets.length === 0" variant="light">暂无数据</t-tag>
          </t-space>
        </div>
        <div class="bucketGroup">
          <span class="bucketTitle">高频模型</span>
          <t-space break-line :size="6">
            <t-tag v-for="(item, index) in modelBuckets" :key="item.name" :theme="bucketTheme(index)" variant="light">
              {{ item.name }} {{ formatInt(item.count) }}
            </t-tag>
            <t-tag v-if="modelBuckets.length === 0" variant="light">暂无数据</t-tag>
          </t-space>
        </div>
      </section>

      <section class="tableRegion">
        <t-table
          row-key="id"
          :data="rows"
          :columns="columns"
          :loading="loading"
          bordered
          hover
          table-layout="fixed"
          max-height="100%"
          class="taskTable">
          <template #task="{ row }">
            <div class="taskCell">
              <strong>{{ textOrDash(row.taskClass) }}</strong>
              <span>{{ previewText(row.describe, 48) }}</span>
            </div>
          </template>

          <template #state="{ row }">
            <t-tooltip v-if="row.state === '生成失败' && row.reason" :content="row.reason">
              <t-tag :theme="stateTheme(row.state)" variant="light">{{ row.state }}</t-tag>
            </t-tooltip>
            <t-tag v-else :theme="stateTheme(row.state)" variant="light">
              {{ textOrDash(row.state) }}
            </t-tag>
          </template>

          <template #project="{ row }">
            <div class="stackCell">
              <strong>{{ textOrDash(row.projectName) }}</strong>
              <span>{{ row.userName || row.username ? `${row.userName || row.username} · ID ${row.userId}` : '未绑定用户' }}</span>
            </div>
          </template>

          <template #model="{ row }">
            <span class="lineClamp">{{ textOrDash(row.model) }}</span>
          </template>

          <template #billing="{ row }">
            <div class="billingCell">
              <t-tag :theme="billingStatusTheme(row.billing?.status)" variant="light">
                {{ billingStatusLabel(row.billing?.status || 'unmatched') }}
              </t-tag>
              <span>{{ billingAmountText(row) }}</span>
            </div>
          </template>

          <template #relatedObjects="{ row }">
            <span>{{ relatedSummary(row.relatedObjects) }}</span>
          </template>

          <template #promptMeta="{ row }">
            <t-space :size="6">
              <t-tag :theme="row.hasPrompt ? 'success' : 'default'" variant="light">
                {{ row.hasPrompt ? '提示词' : '无提示词' }}
              </t-tag>
              <t-tag :theme="row.hasNegativePrompt ? 'warning' : 'default'" variant="light">
                {{ row.hasNegativePrompt ? '负面' : '无负面' }}
              </t-tag>
            </t-space>
          </template>

          <template #reason="{ row }">
            <span class="lineClamp">{{ previewText(row.reason, 70) }}</span>
          </template>

          <template #startTime="{ row }">
            {{ formatDateTime(row.startTime) }}
          </template>

          <template #operation="{ row }">
            <t-button variant="text" theme="primary" @click="openDetail(row)">
              详情
            </t-button>
          </template>
        </t-table>
      </section>

      <t-pagination
        v-model:current="pagination.page"
        v-model:pageSize="pagination.pageSize"
        show-sizer
        :total="pagination.total"
        @current-change="loadTasks"
        @page-size-change="onPageSizeChange" />
    </div>

    <t-drawer v-model:visible="detailVisible" :close-btn="true" close-on-esc-keydown :footer="false" size="760px">
      <template #header>
        <div class="drawerHeader">
          <span>任务详情 #{{ selectedTask?.id }}</span>
          <t-tag v-if="selectedTask" :theme="stateTheme(selectedTask.state)" variant="light">
            {{ selectedTask.state || '未知状态' }}
          </t-tag>
        </div>
      </template>

      <t-loading :loading="detailLoading" class="drawerLoading">
        <div v-if="selectedTask" class="detailBody">
          <section class="detailGrid">
            <div>
              <span>任务大类</span>
              <strong>{{ textOrDash(selectedTask.taskClass) }}</strong>
            </div>
            <div>
              <span>项目</span>
              <strong>{{ textOrDash(selectedTask.projectName) }}</strong>
            </div>
            <div>
              <span>用户</span>
              <strong>{{ selectedTask.userName || selectedTask.username || '-' }}</strong>
            </div>
            <div>
              <span>开始时间</span>
              <strong>{{ formatDateTime(selectedTask.startTime) }}</strong>
            </div>
            <div>
              <span>积分扣除</span>
              <strong>{{ billingAmountText(selectedTask) }}</strong>
            </div>
            <div>
              <span>Token 记录</span>
              <strong>{{ hasTokenUsage(selectedTask.billing?.tokenUsage) ? formatToken(selectedTask.billing.tokenUsage.totalTokens) : '未记录' }}</strong>
            </div>
          </section>

          <section class="detailSection">
            <div class="sectionHeader">
              <h3>模型与描述</h3>
              <t-button size="small" variant="text" @click="copyText(selectedTask.model, '模型')">
                复制模型
              </t-button>
            </div>
            <div class="modelBox">{{ textOrDash(selectedTask.model) }}</div>
            <div class="descriptionBox">{{ textOrDash(selectedTask.describe) }}</div>
          </section>

          <t-tabs default-value="related">
            <t-tab-panel value="related" label="关联对象">
              <div class="tabToolbar">
                <t-button size="small" variant="outline" @click="copyText(selectedTask.relatedObjects, '关联对象')">
                  复制
                </t-button>
              </div>
              <pre class="codeBlock">{{ formatRelatedObjects(selectedTask.relatedObjects) }}</pre>
            </t-tab-panel>

            <t-tab-panel value="prompt" label="提示词">
              <div class="tabToolbar">
                <t-button size="small" variant="outline" @click="copyText(selectedTask.prompt, '提示词')">
                  复制
                </t-button>
              </div>
              <pre class="codeBlock">{{ selectedTask.prompt || '暂无提示词记录' }}</pre>
            </t-tab-panel>

            <t-tab-panel value="negativePrompt" label="负面提示词">
              <div class="tabToolbar">
                <t-button size="small" variant="outline" @click="copyText(selectedTask.negativePrompt, '负面提示词')">
                  复制
                </t-button>
              </div>
              <pre class="codeBlock">{{ selectedTask.negativePrompt || '暂无负面提示词记录' }}</pre>
            </t-tab-panel>

            <t-tab-panel value="reason" label="失败原因">
              <pre class="codeBlock">{{ selectedTask.reason || '暂无失败原因' }}</pre>
            </t-tab-panel>

            <t-tab-panel value="billing" label="扣费 / Token">
              <section class="billingCards">
                <div>
                  <span>计费状态</span>
                  <strong>{{ billingStatusLabel(selectedTask.billing.status) }}</strong>
                </div>
                <div>
                  <span>已扣除积分</span>
                  <strong>{{ formatPoints(selectedTask.billing.settledPoints) }}</strong>
                </div>
                <div>
                  <span>冻结积分</span>
                  <strong>{{ formatPoints(selectedTask.billing.frozenPoints) }}</strong>
                </div>
                <div>
                  <span>预估积分</span>
                  <strong>{{ formatPoints(selectedTask.billing.requiredPoints) }}</strong>
                </div>
                <div>
                  <span>单次积分</span>
                  <strong>{{ formatPoints(selectedTask.billing.pointsPerCall) }}</strong>
                </div>
                <div>
                  <span>计费模型</span>
                  <strong>{{ selectedTask.billing.modelLabel || '-' }}</strong>
                </div>
                <div>
                  <span>赠送积分扣除</span>
                  <strong>{{ formatPoints(selectedTask.billing.bucketDeductions.bonus) }}</strong>
                </div>
                <div>
                  <span>充值积分扣除</span>
                  <strong>{{ formatPoints(selectedTask.billing.bucketDeductions.recharge) }}</strong>
                </div>
                <div>
                  <span>会员积分扣除</span>
                  <strong>{{ formatPoints(selectedTask.billing.bucketDeductions.membership) }}</strong>
                </div>
              </section>

              <section class="tokenGrid">
                <div>
                  <span>Prompt Token</span>
                  <strong>{{ formatToken(selectedTask.billing.tokenUsage.promptTokens) }}</strong>
                </div>
                <div>
                  <span>Completion Token</span>
                  <strong>{{ formatToken(selectedTask.billing.tokenUsage.completionTokens) }}</strong>
                </div>
                <div>
                  <span>Reasoning Token</span>
                  <strong>{{ formatToken(selectedTask.billing.tokenUsage.reasoningTokens) }}</strong>
                </div>
                <div>
                  <span>Total Token</span>
                  <strong>{{ formatToken(selectedTask.billing.tokenUsage.totalTokens) }}</strong>
                </div>
              </section>
              <div v-if="!hasTokenUsage(selectedTask.billing.tokenUsage)" class="emptyHint">
                当前模型调用没有保存 token usage，历史记录无法反推。
              </div>

              <section class="detailSection">
                <div class="sectionHeader">
                  <h3>积分流水</h3>
                  <t-tag variant="light">{{ selectedTask.billing.transactions.length }} 条</t-tag>
                </div>
                <div v-if="selectedTask.billing.transactions.length === 0" class="emptyHint">未匹配到积分扣除流水</div>
                <div v-else class="billingRecordList">
                  <div v-for="item in selectedTask.billing.transactions" :key="item.id" class="billingRecord">
                    <div>
                      <strong>{{ item.description || item.type }}</strong>
                      <span>{{ item.taskType || '-' }} · relatedId {{ item.relatedId || '-' }}</span>
                    </div>
                    <div class="billingRecordMeta">
                      <b>{{ item.amount > 0 ? '+' : '' }}{{ formatPoints(item.amount) }}</b>
                      <span>{{ formatDateTime(item.createdAt) }}</span>
                    </div>
                    <pre v-if="item.billingMeta && Object.keys(item.billingMeta).length" class="miniCode">{{ formatJson(item.billingMeta) }}</pre>
                  </div>
                </div>
              </section>

              <section class="detailSection">
                <div class="sectionHeader">
                  <h3>冻结记录</h3>
                  <t-tag variant="light">{{ selectedTask.billing.holds.length }} 条</t-tag>
                </div>
                <div v-if="selectedTask.billing.holds.length === 0" class="emptyHint">未匹配到积分冻结记录</div>
                <div v-else class="billingRecordList">
                  <div v-for="item in selectedTask.billing.holds" :key="item.id" class="billingRecord">
                    <div>
                      <strong>{{ item.description || item.status }}</strong>
                      <span>{{ item.taskType || '-' }} · relatedId {{ item.relatedId || '-' }}</span>
                    </div>
                    <div class="billingRecordMeta">
                      <b>{{ formatPoints(item.amount) }}</b>
                      <span>{{ item.status }} · {{ formatDateTime(item.createdAt) }}</span>
                    </div>
                  </div>
                </div>
              </section>
            </t-tab-panel>
          </t-tabs>
        </div>
      </t-loading>
    </t-drawer>
  </Page>
</template>

<style scoped lang="scss">
:deep(.taskCenterPageContent) {
  overflow: hidden !important;
}

.taskCenter {
  display: grid;
  height: 100%;
  min-height: 0;
  gap: 14px;
  grid-template-rows: auto auto auto minmax(0, 1fr) auto;
  overflow: hidden;
}

.metricGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.metricItem {
  min-width: 0;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  padding: 16px;
  background: var(--td-bg-color-container);

  strong {
    display: block;
    margin-top: 10px;
    color: var(--td-text-color-primary);
    font-size: 26px;
    line-height: 1.1;
  }

  span {
    display: block;
    margin-top: 6px;
    overflow: hidden;
    color: var(--td-text-color-secondary);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.metricHeader {
  display: flex;
  min-width: 0;
}

.filterBar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.keywordInput {
  flex: 1 1 320px;
  min-width: 260px;
  max-width: 520px;
}

.filterSelect {
  flex: 1 1 150px;
  min-width: 140px;
  max-width: 210px;
}

.dateFilter {
  flex: 1 1 250px;
  min-width: 230px;
  max-width: 320px;
}

.filterActions {
  flex: 0 0 auto;
}

.bucketPanel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.bucketGroup {
  min-width: 0;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  padding: 12px;
  background: var(--td-bg-color-container);
}

.bucketTitle {
  display: block;
  margin-bottom: 8px;
  color: var(--td-text-color-secondary);
  font-size: 12px;
}

.tableRegion {
  min-height: 0;
  overflow: hidden;
}

.taskTable {
  height: 100%;
}

:deep(.taskTable .t-table),
:deep(.taskTable .t-table__content) {
  height: 100%;
}

.taskCell,
.stackCell,
.billingCell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    color: var(--td-text-color-secondary);
    font-size: 12px;
  }
}

.billingCell {
  align-items: flex-start;

  span {
    max-width: 100%;
  }
}

.lineClamp {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawerHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.drawerLoading {
  min-height: 420px;
}

.detailBody {
  display: grid;
  gap: 18px;
}

.detailGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  div {
    min-width: 0;
    border: 1px solid var(--td-border-level-1-color);
    border-radius: 8px;
    padding: 12px;
    background: var(--td-bg-color-container);
  }

  span {
    display: block;
    color: var(--td-text-color-secondary);
    font-size: 12px;
  }

  strong {
    display: block;
    margin-top: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.detailSection {
  display: grid;
  gap: 10px;
}

.billingCards,
.tokenGrid {
  display: grid;
  gap: 10px;
  margin-top: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.tokenGrid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.billingCards div,
.tokenGrid div {
  min-width: 0;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  padding: 12px;
  background: var(--td-bg-color-container);

  span {
    display: block;
    color: var(--td-text-color-secondary);
    font-size: 12px;
  }

  strong {
    display: block;
    margin-top: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.emptyHint {
  margin-top: 10px;
  border: 1px dashed var(--td-border-level-2-color);
  border-radius: 8px;
  padding: 14px;
  color: var(--td-text-color-secondary);
  background: var(--td-bg-color-container);
  font-size: 13px;
}

.billingRecordList {
  display: grid;
  gap: 10px;
}

.billingRecord {
  display: grid;
  min-width: 0;
  gap: 8px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  padding: 12px;
  background: var(--td-bg-color-container);

  > div {
    display: flex;
    min-width: 0;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  strong,
  span {
    display: block;
    min-width: 0;
  }

  span {
    margin-top: 4px;
    color: var(--td-text-color-secondary);
    font-size: 12px;
  }
}

.billingRecordMeta {
  flex: 0 0 auto;
  text-align: right;

  b {
    color: var(--td-brand-color);
  }
}

.sectionHeader,
.tabToolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sectionHeader h3 {
  margin: 0;
  font-size: 15px;
}

.modelBox,
.descriptionBox,
.codeBlock {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  background: var(--td-bg-color-container);
}

.modelBox,
.descriptionBox {
  padding: 12px;
  word-break: break-word;
}

.descriptionBox {
  color: var(--td-text-color-secondary);
}

.codeBlock,
.miniCode {
  min-height: 220px;
  max-height: 420px;
  margin: 10px 0 0;
  padding: 14px;
  overflow: auto;
  color: var(--td-text-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.miniCode {
  min-height: auto;
  max-height: 220px;
  margin: 0;
  font-size: 11px;
}

@media (max-width: 1180px) {
  .metricGrid,
  .bucketPanel,
  .billingCards,
  .tokenGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filterBar {
    align-items: stretch;
  }
}

@media (max-width: 760px) {
  .metricGrid,
  .bucketPanel,
  .detailGrid,
  .billingCards,
  .tokenGrid {
    grid-template-columns: 1fr;
  }

  .keywordInput,
  .filterSelect,
  .dateFilter,
  .filterActions {
    flex-basis: 100%;
    max-width: none;
  }
}
</style>
