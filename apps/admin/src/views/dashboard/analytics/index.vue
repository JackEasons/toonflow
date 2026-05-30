<script lang="ts" setup>
import type { EchartsUIType } from '@super/plugins/echarts';

import { computed, nextTick, onMounted, ref } from 'vue';

import { Page } from '@super/common-ui';
import { EchartsUI, useEcharts } from '@super/plugins/echarts';
import { MessagePlugin } from 'tdesign-vue-next';

import {
  fetchAdminAnalytics,
  formatDateTime,
  formatInt,
  formatMoney,
  formatPercent,
  type AdminAnalyticsData,
  type AnalyticsChartItem,
} from './api';

function createEmptyAnalytics(): AdminAnalyticsData {
  return {
    activeProjects: [],
    activeUsers: [],
    generatedAt: '',
    insights: [],
    membershipLevels: [],
    modelStats: [],
    modelUsage: [],
    monthlyRecharge: [],
    overview: {
      activeMembers: 0,
      activeRate: 0,
      activeUsers30d: 0,
      averageOrderAmount: 0,
      expiringMembers7d: 0,
      memberConversionRate: 0,
      modelCalls: 0,
      paidOrders: 0,
      pendingOrders: 0,
      pointsBalance: 0,
      pointsBonus: 0,
      pointsBurnRate: 0,
      pointsConsumed: 0,
      pointsFrozen: 0,
      pointsMembership: 0,
      pointsRecharge: 0,
      projects: 0,
      rechargeAmount: 0,
      successRate: 0,
      totalUsers: 0,
    },
    orderStatus: [],
    pointBuckets: [],
    pointFlow: [],
    range: {
      days: 30,
      endDate: '',
      startDate: '',
    },
    recentPointTransactions: [],
    recentTasks: [],
    rechargeBreakdown: [],
    revenueProducts: [],
    stateUsage: [],
    taskUsage: [],
    trend: [],
  };
}

const loading = ref(false);
const rangeDays = ref(30);
const analytics = ref<AdminAnalyticsData>(createEmptyAnalytics());
const trendRef = ref<EchartsUIType>();
const rechargeRef = ref<EchartsUIType>();
const pointFlowRef = ref<EchartsUIType>();
const modelUsageRef = ref<EchartsUIType>();
const taskUsageRef = ref<EchartsUIType>();
const stateUsageRef = ref<EchartsUIType>();
const membershipLevelRef = ref<EchartsUIType>();
const pointBucketRef = ref<EchartsUIType>();
const orderStatusRef = ref<EchartsUIType>();
const trendChart = useEcharts(trendRef);
const rechargeChart = useEcharts(rechargeRef);
const pointFlowChart = useEcharts(pointFlowRef);
const modelUsageChart = useEcharts(modelUsageRef);
const taskUsageChart = useEcharts(taskUsageRef);
const stateUsageChart = useEcharts(stateUsageRef);
const membershipLevelChart = useEcharts(membershipLevelRef);
const pointBucketChart = useEcharts(pointBucketRef);
const orderStatusChart = useEcharts(orderStatusRef);

const rangeOptions = [
  { label: '7 天', value: 7 },
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
];

const primaryMetrics = computed(() => {
  const data = analytics.value.overview;
  return [
    {
      icon: 'lucide:users-round',
      label: '会员活跃度',
      subLabel: `总用户 ${formatInt(data.totalUsers)}`,
      subValue: `活跃率 ${formatPercent(data.activeRate)}`,
      value: formatInt(data.activeUsers30d),
    },
    {
      icon: 'lucide:crown',
      label: '有效会员',
      subLabel: `会员转化 ${formatPercent(data.memberConversionRate)}`,
      subValue: `项目数 ${formatInt(data.projects)}`,
      value: formatInt(data.activeMembers),
    },
    {
      icon: 'lucide:coins',
      label: '积分消耗',
      subLabel: `剩余积分 ${formatInt(data.pointsBalance)}`,
      subValue: `消耗率 ${formatPercent(data.pointsBurnRate)}`,
      value: formatInt(data.pointsConsumed),
    },
    {
      icon: 'lucide:receipt-text',
      label: '充值金额',
      subLabel: `已支付订单 ${formatInt(data.paidOrders)}`,
      subValue: `客单价 ${formatMoney(data.averageOrderAmount)}`,
      value: formatMoney(data.rechargeAmount),
    },
  ];
});

const healthMetrics = computed(() => [
  {
    icon: 'activity',
    label: '模型调用',
    value: formatInt(analytics.value.overview.modelCalls),
  },
  {
    icon: 'check-circle',
    label: '任务成功率',
    value: `${analytics.value.overview.successRate}%`,
  },
  {
    icon: 'wallet',
    label: '待支付订单',
    value: formatInt(analytics.value.overview.pendingOrders),
  },
  {
    icon: 'time',
    label: '7 日到期会员',
    value: formatInt(analytics.value.overview.expiringMembers7d),
  },
]);

const taskColumns = [
  { colKey: 'taskClass', title: '任务', width: 160 },
  { colKey: 'model', title: '模型', ellipsis: true },
  { colKey: 'projectName', title: '项目', ellipsis: true, width: 180 },
  { colKey: 'state', title: '状态', width: 120 },
  { colKey: 'startTime', title: '开始时间', width: 180 },
];

const modelColumns = [
  { colKey: 'model', ellipsis: true, title: '模型' },
  { colKey: 'total', title: '调用', width: 90 },
  { colKey: 'success', title: '成功', width: 90 },
  { colKey: 'failed', title: '失败', width: 90 },
  { colKey: 'running', title: '进行中', width: 100 },
  { colKey: 'successRate', title: '成功率', width: 110 },
  { colKey: 'latestAt', title: '最近调用', width: 180 },
];

const activeUserColumns = [
  { colKey: 'userName', ellipsis: true, title: '用户' },
  { colKey: 'membershipName', title: '会员', width: 110 },
  { colKey: 'modelCalls', title: '调用', width: 90 },
  { colKey: 'pointsConsumed', title: '积分消耗', width: 110 },
  { colKey: 'rechargeAmount', title: '充值', width: 110 },
  { colKey: 'lastActiveAt', title: '最近活跃', width: 170 },
];

const activeProjectColumns = [
  { colKey: 'projectName', ellipsis: true, title: '项目' },
  { colKey: 'userName', ellipsis: true, title: '用户', width: 140 },
  { colKey: 'modelCalls', title: '调用', width: 90 },
  { colKey: 'successRate', title: '成功率', width: 110 },
  { colKey: 'pointsConsumed', title: '积分消耗', width: 110 },
  { colKey: 'lastTaskAt', title: '最近调用', width: 170 },
];

const revenueProductColumns = [
  { colKey: 'name', ellipsis: true, title: '产品' },
  { colKey: 'kind', title: '类型', width: 110 },
  { colKey: 'orders', title: '订单', width: 90 },
  { colKey: 'points', title: '积分', width: 100 },
  { colKey: 'amount', title: '金额', width: 120 },
];

const pointTransactionColumns = [
  { colKey: 'userName', ellipsis: true, title: '用户' },
  { colKey: 'type', title: '类型', width: 110 },
  { colKey: 'amount', title: '变动', width: 110 },
  { colKey: 'balanceAfter', title: '余额', width: 100 },
  { colKey: 'createdAt', title: '时间', width: 170 },
];

function stateTheme(state: string) {
  if (state.includes('完成')) return 'success';
  if (state.includes('失败')) return 'danger';
  if (state.includes('进行')) return 'warning';
  return 'default';
}

function rateTheme(rate: number) {
  if (rate >= 95) return 'success';
  if (rate >= 80) return 'warning';
  return 'danger';
}

function amountTheme(amount: number) {
  if (amount < 0) return 'danger';
  if (amount > 0) return 'success';
  return 'default';
}

function insightTheme(level: string) {
  if (level === 'success') return 'success';
  if (level === 'warning') return 'warning';
  return 'primary';
}

function insightIcon(level: string) {
  if (level === 'success') return 'check-circle';
  if (level === 'warning') return 'error-circle';
  return 'info-circle';
}

function pieData(items: AnalyticsChartItem[]) {
  return items.length > 0 ? items : [{ name: '暂无数据', value: 0 }];
}

function renderTrendChart() {
  const trend = analytics.value.trend;
  trendChart.renderEcharts({
    grid: {
      bottom: 12,
      containLabel: true,
      left: 8,
      right: 16,
      top: 42,
    },
    legend: {
      top: 0,
    },
    series: [
      {
        data: trend.map((item) => item.activeUsers),
        name: '活跃会员',
        smooth: true,
        type: 'line',
        yAxisIndex: 0,
      },
      {
        data: trend.map((item) => item.modelCalls),
        name: '模型调用',
        smooth: true,
        type: 'line',
        yAxisIndex: 0,
      },
      {
        data: trend.map((item) => item.pointsConsumed),
        name: '积分消耗',
        type: 'bar',
        yAxisIndex: 1,
      },
      {
        data: trend.map((item) => item.rechargeAmount),
        name: '充值金额',
        smooth: true,
        type: 'line',
        yAxisIndex: 1,
      },
    ],
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      axisTick: { show: false },
      data: trend.map((item) => item.label),
      type: 'category',
    },
    yAxis: [
      {
        name: '人数/次数',
        splitLine: { lineStyle: { type: 'dashed' } },
        type: 'value',
      },
      {
        name: '金额/积分',
        splitLine: { show: false },
        type: 'value',
      },
    ],
  });
}

function renderRechargeChart() {
  const monthly = analytics.value.monthlyRecharge;
  rechargeChart.renderEcharts({
    grid: {
      bottom: 12,
      containLabel: true,
      left: 8,
      right: 16,
      top: 42,
    },
    legend: { top: 0 },
    series: [
      {
        data: monthly.map((item) => item.amount),
        name: '充值金额',
        type: 'bar',
        yAxisIndex: 0,
      },
      {
        data: monthly.map((item) => item.orders),
        name: '订单数',
        smooth: true,
        type: 'line',
        yAxisIndex: 1,
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: {
      data: monthly.map((item) => item.month.slice(5)),
      type: 'category',
    },
    yAxis: [
      { name: '金额', type: 'value' },
      { name: '订单', splitLine: { show: false }, type: 'value' },
    ],
  });
}

function renderPointFlowChart() {
  pointFlowChart.renderEcharts({
    legend: { bottom: 0 },
    series: [
      {
        data: pieData(analytics.value.pointFlow),
        name: '积分流向',
        radius: ['42%', '68%'],
        type: 'pie',
      },
    ],
    tooltip: { trigger: 'item' },
  });
}

function renderModelUsageChart() {
  const rows = [...analytics.value.modelUsage].reverse();
  modelUsageChart.renderEcharts({
    grid: {
      bottom: 8,
      containLabel: true,
      left: 8,
      right: 16,
      top: 16,
    },
    series: [
      {
        data: rows.map((item) => item.value),
        name: '调用量',
        type: 'bar',
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'value' },
    yAxis: {
      axisTick: { show: false },
      data: rows.map((item) => item.name),
      type: 'category',
    },
  });
}

function renderTaskUsageChart() {
  taskUsageChart.renderEcharts({
    grid: {
      bottom: 8,
      containLabel: true,
      left: 8,
      right: 16,
      top: 16,
    },
    series: [
      {
        data: analytics.value.taskUsage.map((item) => item.value),
        name: '任务数',
        type: 'bar',
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisLabel: { interval: 0, rotate: 24 },
      data: analytics.value.taskUsage.map((item) => item.name),
      type: 'category',
    },
    yAxis: { type: 'value' },
  });
}

function renderStateUsageChart() {
  stateUsageChart.renderEcharts({
    legend: { bottom: 0 },
    series: [
      {
        data: pieData(analytics.value.stateUsage),
        name: '任务状态',
        radius: ['36%', '68%'],
        roseType: 'radius',
        type: 'pie',
      },
    ],
    tooltip: { trigger: 'item' },
  });
}

function renderMembershipLevelChart() {
  const rows = analytics.value.membershipLevels;
  membershipLevelChart.renderEcharts({
    grid: {
      bottom: 8,
      containLabel: true,
      left: 8,
      right: 16,
      top: 16,
    },
    series: [
      {
        data: rows.map((item) => item.activeUsers),
        name: '有效用户',
        type: 'bar',
      },
      {
        data: rows.map((item) => item.totalUsers),
        name: '全部用户',
        type: 'bar',
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisLabel: { interval: 0, rotate: 20 },
      data: rows.map((item) => item.name),
      type: 'category',
    },
    yAxis: { type: 'value' },
  });
}

function renderPointBucketChart() {
  pointBucketChart.renderEcharts({
    legend: { bottom: 0 },
    series: [
      {
        data: pieData(analytics.value.pointBuckets),
        name: '积分余额构成',
        radius: ['40%', '68%'],
        type: 'pie',
      },
    ],
    tooltip: { trigger: 'item' },
  });
}

function renderOrderStatusChart() {
  orderStatusChart.renderEcharts({
    legend: { bottom: 0 },
    series: [
      {
        data: pieData(analytics.value.orderStatus),
        name: '订单状态',
        radius: ['40%', '68%'],
        type: 'pie',
      },
    ],
    tooltip: { trigger: 'item' },
  });
}

function renderCharts() {
  renderTrendChart();
  renderRechargeChart();
  renderPointFlowChart();
  renderModelUsageChart();
  renderTaskUsageChart();
  renderStateUsageChart();
  renderMembershipLevelChart();
  renderPointBucketChart();
  renderOrderStatusChart();
}

async function loadAnalytics() {
  loading.value = true;
  try {
    analytics.value = await fetchAdminAnalytics({ days: rangeDays.value });
    await nextTick();
    renderCharts();
  } catch (err: any) {
    MessagePlugin.error(err?.message || '分析数据加载失败');
  } finally {
    loading.value = false;
  }
}

function changeRange() {
  void loadAnalytics();
}

onMounted(() => {
  void loadAnalytics();
});
</script>

<template>
  <Page title="数据分析">
    <template #description>
      <div class="mt-2 text-foreground/70">
        汇总会员活跃、积分消耗、充值订单和模型调用等真实运营数据。
      </div>
    </template>
    <template #extra>
      <t-space>
        <t-radio-group
          v-model="rangeDays"
          size="small"
          variant="default-filled"
          @change="changeRange">
          <t-radio-button
            v-for="item in rangeOptions"
            :key="item.value"
            :value="item.value">
            {{ item.label }}
          </t-radio-button>
        </t-radio-group>
        <span class="text-xs text-foreground/60">
          更新于 {{ formatDateTime(analytics.generatedAt) }}
        </span>
        <t-button theme="primary" :loading="loading" @click="loadAnalytics">
          <template #icon><t-icon name="refresh" /></template>
          刷新
        </t-button>
      </t-space>
    </template>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <t-card
        v-for="metric in primaryMetrics"
        :key="metric.label"
        :bordered="false">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-xl font-semibold">{{ metric.label }}</div>
            <div class="mt-5 text-3xl font-semibold">{{ metric.value }}</div>
          </div>
          <t-icon :name="metric.icon" class="mt-8 text-3xl text-foreground/60" />
        </div>
        <div class="mt-5 flex items-center justify-between text-sm text-foreground/70">
          <span>{{ metric.subLabel }}</span>
          <span>{{ metric.subValue }}</span>
        </div>
      </t-card>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <t-card
        v-for="metric in healthMetrics"
        :key="metric.label"
        :bordered="false">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm text-foreground/60">{{ metric.label }}</div>
            <div class="mt-2 text-2xl font-semibold">{{ metric.value }}</div>
          </div>
          <t-icon :name="metric.icon" class="text-3xl text-primary" />
        </div>
      </t-card>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
      <t-card
        v-for="insight in analytics.insights"
        :key="`${insight.title}-${insight.metric}`"
        :bordered="false">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <t-tag :theme="insightTheme(insight.level)" variant="light">
                {{ insight.metric }}
              </t-tag>
              <span class="font-semibold">{{ insight.title }}</span>
            </div>
            <div class="mt-3 text-sm text-foreground/70">
              {{ insight.description }}
            </div>
            <div class="mt-4 text-xs text-foreground/60">
              {{ insight.action }}
            </div>
          </div>
          <t-icon
            :name="insightIcon(insight.level)"
            class="mt-1 shrink-0 text-2xl text-primary" />
        </div>
      </t-card>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-4 2xl:grid-cols-3">
      <t-card
        class="2xl:col-span-2"
        :title="`近 ${analytics.range.days} 天运营趋势`"
        :bordered="false">
        <EchartsUI ref="trendRef" class="analytics-chart" />
      </t-card>
      <t-card title="积分流向" :bordered="false">
        <EchartsUI ref="pointFlowRef" class="analytics-chart" />
      </t-card>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
      <t-card title="近 12 月充值情况" :bordered="false">
        <EchartsUI ref="rechargeRef" class="analytics-chart" />
      </t-card>
      <t-card title="模型使用情况" :bordered="false">
        <EchartsUI ref="modelUsageRef" class="analytics-chart" />
      </t-card>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
      <t-card title="会员等级分布" :bordered="false">
        <EchartsUI ref="membershipLevelRef" class="analytics-chart" />
      </t-card>
      <t-card title="积分余额构成" :bordered="false">
        <EchartsUI ref="pointBucketRef" class="analytics-chart" />
      </t-card>
      <t-card title="订单状态" :bordered="false">
        <EchartsUI ref="orderStatusRef" class="analytics-chart" />
      </t-card>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
      <t-card title="任务类型分布" :bordered="false">
        <EchartsUI ref="taskUsageRef" class="analytics-chart" />
      </t-card>
      <t-card title="任务状态分布" :bordered="false">
        <EchartsUI ref="stateUsageRef" class="analytics-chart" />
      </t-card>
    </div>

    <t-card class="mt-5" title="模型质量明细" :bordered="false">
      <t-table
        row-key="model"
        hover
        :loading="loading"
        :columns="modelColumns"
        :data="analytics.modelStats"
        :pagination="null">
        <template #successRate="{ row }">
          <t-tag :theme="rateTheme(row.successRate)" variant="light">
            {{ formatPercent(row.successRate) }}
          </t-tag>
        </template>
        <template #latestAt="{ row }">
          {{ formatDateTime(row.latestAt) }}
        </template>
        <template #empty>
          <t-empty description="暂无模型调用统计" />
        </template>
      </t-table>
    </t-card>

    <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
      <t-card title="活跃用户排行" :bordered="false">
        <t-table
          row-key="userId"
          hover
          :loading="loading"
          :columns="activeUserColumns"
          :data="analytics.activeUsers"
          :pagination="null">
          <template #membershipName="{ row }">
            <t-tag variant="light">{{ row.membershipName }}</t-tag>
          </template>
          <template #pointsConsumed="{ row }">
            {{ formatInt(row.pointsConsumed) }}
          </template>
          <template #rechargeAmount="{ row }">
            {{ formatMoney(row.rechargeAmount) }}
          </template>
          <template #lastActiveAt="{ row }">
            {{ formatDateTime(row.lastActiveAt) }}
          </template>
          <template #empty>
            <t-empty description="暂无活跃用户" />
          </template>
        </t-table>
      </t-card>

      <t-card title="项目调用排行" :bordered="false">
        <t-table
          row-key="projectId"
          hover
          :loading="loading"
          :columns="activeProjectColumns"
          :data="analytics.activeProjects"
          :pagination="null">
          <template #successRate="{ row }">
            <t-tag :theme="rateTheme(row.successRate)" variant="light">
              {{ formatPercent(row.successRate) }}
            </t-tag>
          </template>
          <template #pointsConsumed="{ row }">
            {{ formatInt(row.pointsConsumed) }}
          </template>
          <template #lastTaskAt="{ row }">
            {{ formatDateTime(row.lastTaskAt) }}
          </template>
          <template #empty>
            <t-empty description="暂无项目调用" />
          </template>
        </t-table>
      </t-card>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
      <t-card title="收入产品排行" :bordered="false">
        <t-table
          row-key="name"
          hover
          :loading="loading"
          :columns="revenueProductColumns"
          :data="analytics.revenueProducts"
          :pagination="null">
          <template #orders="{ row }">
            {{ formatInt(row.orders) }}
          </template>
          <template #points="{ row }">
            {{ formatInt(row.points) }}
          </template>
          <template #amount="{ row }">
            {{ formatMoney(row.amount) }}
          </template>
          <template #empty>
            <t-empty description="暂无付费产品" />
          </template>
        </t-table>
      </t-card>

      <t-card title="最近积分流水" :bordered="false">
        <t-table
          row-key="id"
          hover
          :loading="loading"
          :columns="pointTransactionColumns"
          :data="analytics.recentPointTransactions"
          :pagination="null">
          <template #amount="{ row }">
            <t-tag :theme="amountTheme(row.amount)" variant="light">
              {{ row.amount > 0 ? '+' : '' }}{{ formatInt(row.amount) }}
            </t-tag>
          </template>
          <template #balanceAfter="{ row }">
            {{ formatInt(row.balanceAfter) }}
          </template>
          <template #createdAt="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
          <template #empty>
            <t-empty description="暂无积分流水" />
          </template>
        </t-table>
      </t-card>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
      <t-card title="充值构成" :bordered="false">
        <div class="space-y-4">
          <div
            v-for="item in analytics.rechargeBreakdown"
            :key="item.name"
            class="flex items-center justify-between gap-3">
            <div>
              <div class="font-medium">{{ item.name }}</div>
              <div class="text-xs text-foreground/60">
                {{ formatInt(item.orders) }} 笔订单
              </div>
            </div>
            <div class="text-right font-semibold">
              {{ formatMoney(item.amount) }}
            </div>
          </div>
          <t-empty
            v-if="analytics.rechargeBreakdown.length === 0"
            description="暂无充值数据" />
        </div>
      </t-card>

      <t-card class="xl:col-span-2" title="最近模型任务" :bordered="false">
        <t-table
          row-key="id"
          hover
          :loading="loading"
          :columns="taskColumns"
          :data="analytics.recentTasks"
          :pagination="null">
          <template #projectName="{ row }">
            <span>{{ row.projectName || '-' }}</span>
          </template>
          <template #state="{ row }">
            <t-tag :theme="stateTheme(row.state)" variant="light">
              {{ row.state }}
            </t-tag>
          </template>
          <template #startTime="{ row }">
            {{ formatDateTime(row.startTime) }}
          </template>
          <template #empty>
            <t-empty description="暂无模型任务记录" />
          </template>
        </t-table>
      </t-card>
    </div>
  </Page>
</template>

<style scoped>
.analytics-chart {
  height: 320px;
  width: 100%;
}
</style>
