<script setup lang="ts">
import type { SuperFormProps } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { Page } from '@super/common-ui';

import { useSuperVxeGrid } from '#/adapter/vxe-table';

import {
  fetchTransactions,
  formatDateTime,
  formatInt,
  type PointTransaction,
} from './api';

const formOptions: SuperFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: '按用户 ID 筛选',
      },
      fieldName: 'userId',
      label: '用户 ID',
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: '全部类型', value: 'all' },
          { label: '消耗', value: 'consume' },
          { label: '积分包购买', value: 'points_purchase' },
          { label: '会员赠送', value: 'membership_grant' },
          { label: '会员后台调整', value: 'membership_admin_update' },
          { label: '积分后台调整', value: 'admin_adjust' },
          { label: '注册赠送', value: 'register_bonus' },
        ],
      },
      defaultValue: 'all',
      fieldName: 'type',
      label: '流水类型',
    },
  ],
  showCollapseButton: false,
  submitOnChange: true,
  submitOnEnter: true,
};

const gridOptions: VxeTableGridOptions<PointTransaction> = {
  columns: [
    { title: '序号', type: 'seq', width: 64 },
    { field: 'user', slots: { default: 'user' }, title: '用户', width: 180 },
    { field: 'type', slots: { default: 'type' }, title: '类型', width: 180 },
    { field: 'description', minWidth: 260, title: '说明' },
    { align: 'right', field: 'amount', slots: { default: 'amount' }, title: '变动', width: 140 },
    { align: 'right', field: 'balanceAfter', slots: { default: 'balanceAfter' }, title: '变动后余额', width: 150 },
    { field: 'createdAt', slots: { default: 'createdAt' }, title: '时间', width: 180 },
  ],
  height: 'auto',
  keepSource: true,
  pagerConfig: {},
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues = {}) => {
        const res = await fetchTransactions({
          page: page.currentPage,
          pageSize: page.pageSize,
          type: formValues.type === 'all' ? undefined : formValues.type,
          userId: formValues.userId?.trim() || undefined,
        });
        return { items: res.list, total: res.total };
      },
    },
  },
  rowConfig: {
    keyField: 'id',
  },
  toolbarConfig: {
    custom: true,
    refresh: true,
    search: true,
    zoom: true,
  },
} as VxeTableGridOptions<PointTransaction>;

const [Grid, gridApi] = useSuperVxeGrid<PointTransaction>({
  formOptions,
  gridOptions,
});

function categoryLabel(category: string) {
  return (
    {
      consume: '消耗',
      earn: '获得',
      purchase: '购买',
    } as Record<string, string>
  )[category] || category;
}

function categoryTheme(category: string) {
  if (category === 'consume') return 'danger';
  if (category === 'purchase') return 'primary';
  return 'success';
}
</script>

<template>
  <Page auto-content-height title="积分流水">
    <template #description>
      <div class="mt-2 text-foreground/70">
        查询用户积分获得、购买、消耗和后台调整记录。
      </div>
    </template>
    <template #extra>
      <t-button theme="primary" @click="gridApi.reload()">
        <template #icon><t-icon name="refresh" /></template>
        刷新
      </t-button>
    </template>

    <Grid table-title="流水记录" table-title-help="支持按用户 ID 和流水类型筛选">
      <template #user="{ row }">
        <div class="font-medium">{{ row.userName || `用户 ${row.userId}` }}</div>
        <div class="text-xs text-foreground/60">ID {{ row.userId }}</div>
      </template>

      <template #type="{ row }">
        <t-space :size="6">
          <t-tag :theme="categoryTheme(row.category)" variant="light">
            {{ categoryLabel(row.category) }}
          </t-tag>
          <span class="text-xs text-foreground/60">{{ row.type }}</span>
        </t-space>
      </template>

      <template #amount="{ row }">
        <span
          class="font-semibold"
          :style="{
            color:
              row.amount < 0
                ? 'var(--td-error-color)'
                : 'var(--td-success-color)',
          }">
          {{ row.amount > 0 ? '+' : '' }}{{ formatInt(row.amount) }}
        </span>
      </template>

      <template #balanceAfter="{ row }">
        {{ formatInt(row.balanceAfter) }}
      </template>

      <template #createdAt="{ row }">
        {{ formatDateTime(row.createdAt) }}
      </template>
    </Grid>
  </Page>
</template>
