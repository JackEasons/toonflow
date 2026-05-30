<script setup lang="ts">
import type { AnalysisOverviewItem } from '@super/common-ui';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AnalysisOverview, Page } from '@super/common-ui';

import {
  fetchOverview,
  formatInt,
  formatMoney,
  type MembershipOverview,
} from './api';

const loading = ref(false);
const router = useRouter();
const overview = ref<MembershipOverview>({
  plans: [],
  pointPackages: [],
  totals: {
    activeMembers: 0,
    balance: 0,
    frozenBalance: 0,
    paidOrders: 0,
    totalSpent: 0,
    users: 0,
  },
});

const overviewItems = computed<AnalysisOverviewItem[]>(() => [
  {
    icon: 'lucide:users',
    title: '用户数',
    totalTitle: '会员用户',
    totalValue: overview.value.totals.activeMembers,
    value: overview.value.totals.users,
  },
  {
    icon: 'lucide:badge-check',
    title: '有效会员',
    totalTitle: '付费订单',
    totalValue: overview.value.totals.paidOrders,
    value: overview.value.totals.activeMembers,
  },
  {
    icon: 'lucide:coins',
    title: '用户积分',
    totalTitle: '冻结积分',
    totalValue: overview.value.totals.frozenBalance,
    value: overview.value.totals.balance,
  },
  {
    icon: 'lucide:activity',
    title: '累计消耗',
    totalTitle: '已支付订单',
    totalValue: overview.value.totals.paidOrders,
    value: overview.value.totals.totalSpent,
  },
]);

const planColumns = [
  { colKey: 'name', title: '套餐' },
  { colKey: 'billingPeriod', title: '周期', width: 100 },
  { colKey: 'price', title: '价格/积分', width: 160 },
  { colKey: 'limits', title: '额度', width: 180 },
  { colKey: 'status', title: '状态', width: 120 },
];

const packageColumns = [
  { colKey: 'points', title: '积分' },
  { colKey: 'price', title: '价格', width: 120 },
  { colKey: 'validityDays', title: '有效期', width: 120 },
  { colKey: 'status', title: '状态', width: 120 },
  { colKey: 'description', title: '说明' },
];

function periodLabel(value: string) {
  return (
    {
      enterprise: '企业',
      free: '免费',
      monthly: '月付',
      yearly: '年付',
    } as Record<string, string>
  )[value] || value;
}

async function loadOverview() {
  loading.value = true;
  try {
    overview.value = await fetchOverview();
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadOverview();
});
</script>

<template>
  <Page title="会员中心">
    <template #description>
      <div class="mt-2 text-foreground/70">
        会员、积分、订单和权益配置的运营总览。
      </div>
    </template>
    <template #extra>
      <t-space>
        <t-button variant="outline" @click="router.push('/membership/functions')">
          功能管理
        </t-button>
        <t-button theme="primary" :loading="loading" @click="loadOverview">
          <template #icon><t-icon name="refresh" /></template>
          刷新
        </t-button>
      </t-space>
    </template>

    <AnalysisOverview :items="overviewItems" />

    <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
      <t-card title="会员套餐" :bordered="false">
        <t-table
          row-key="key"
          hover
          :loading="loading"
          :data="overview.plans"
          :columns="planColumns"
          :pagination="null">
          <template #billingPeriod="{ row }">
            <t-tag variant="light">{{ periodLabel(row.billingPeriod) }}</t-tag>
          </template>
          <template #price="{ row }">
            {{ formatMoney(row.priceCny) }} / {{ formatInt(row.points) }} 积分
          </template>
          <template #limits="{ row }">
            分镜 {{ row.maxShots ?? '-' }} / 项目 {{ row.maxSeries ?? '-' }}
          </template>
          <template #status="{ row }">
            <t-space :size="6">
              <t-tag :theme="row.enabled ? 'success' : 'default'" variant="light">
                {{ row.enabled ? '启用' : '停用' }}
              </t-tag>
              <t-tag v-if="row.popular" theme="primary" variant="light">推荐</t-tag>
            </t-space>
          </template>
          <template #empty>
            <t-empty description="暂无会员套餐" />
          </template>
        </t-table>
      </t-card>

      <t-card title="积分包" :bordered="false">
        <t-table
          row-key="key"
          hover
          :loading="loading"
          :data="overview.pointPackages"
          :columns="packageColumns"
          :pagination="null">
          <template #points="{ row }">
            {{ formatInt(row.points) }}
          </template>
          <template #price="{ row }">
            {{ formatMoney(row.priceCny) }}
          </template>
          <template #validityDays="{ row }">
            {{ row.validityDays }} 天
          </template>
          <template #status="{ row }">
            <t-tag :theme="row.enabled ? 'success' : 'default'" variant="light">
              {{ row.enabled ? '启用' : '停用' }}
            </t-tag>
          </template>
          <template #empty>
            <t-empty description="暂无积分包" />
          </template>
        </t-table>
      </t-card>
    </div>
  </Page>
</template>
