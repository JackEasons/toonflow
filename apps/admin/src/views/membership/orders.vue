<script setup lang="ts">
import type { SuperFormProps } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { Page } from '@super/common-ui';

import { useSuperVxeGrid } from '#/adapter/vxe-table';

import {
  fetchOrders,
  formatDateTime,
  formatInt,
  formatMoney,
  formatOrderStatus,
  updateOrder,
  type OrderRecord,
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
          { label: '全部状态', value: 'all' },
          { label: '已支付', value: 'paid' },
          { label: '待支付', value: 'pending' },
          { label: '已取消', value: 'canceled' },
          { label: '已退款', value: 'refunded' },
        ],
      },
      defaultValue: 'all',
      fieldName: 'status',
      label: '订单状态',
    },
  ],
  showCollapseButton: false,
  submitOnChange: true,
  submitOnEnter: true,
};

const gridOptions: VxeTableGridOptions<OrderRecord> = {
  columns: [
    { title: '序号', type: 'seq', width: 64 },
    { field: 'orderNo', minWidth: 190, title: '订单号' },
    { field: 'user', slots: { default: 'user' }, title: '用户', width: 170 },
    { field: 'kind', slots: { default: 'kind' }, title: '类型', width: 110 },
    { field: 'amount', slots: { default: 'amount' }, title: '金额/积分', width: 180 },
    { field: 'status', slots: { default: 'status' }, title: '状态', width: 120 },
    { field: 'createdAt', slots: { default: 'createdAt' }, title: '创建时间', width: 180 },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: '操作',
      width: 180,
    },
  ],
  height: 'auto',
  keepSource: true,
  pagerConfig: {},
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues = {}) => {
        const res = await fetchOrders({
          page: page.currentPage,
          pageSize: page.pageSize,
          status: formValues.status === 'all' ? undefined : formValues.status,
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
} as VxeTableGridOptions<OrderRecord>;

const [Grid, gridApi] = useSuperVxeGrid<OrderRecord>({
  formOptions,
  gridOptions,
});

async function submitStatus(row: OrderRecord, nextStatus: 'canceled' | 'paid') {
  await updateOrder({ id: row.id, status: nextStatus });
  window.$message.success('订单已更新');
  await gridApi.query();
}
</script>

<template>
  <Page auto-content-height title="订单管理">
    <template #description>
      <div class="mt-2 text-foreground/70">
        处理会员订阅和积分包订单，支持后台标记支付或取消。
      </div>
    </template>
    <template #extra>
      <t-button theme="primary" @click="gridApi.reload()">
        <template #icon><t-icon name="refresh" /></template>
        刷新
      </t-button>
    </template>

    <Grid table-title="订单列表" table-title-help="支持按用户 ID 和订单状态筛选">
      <template #user="{ row }">
        <div class="font-medium">{{ row.userName || `用户 ${row.userId}` }}</div>
        <div class="text-xs text-foreground/60">ID {{ row.userId }}</div>
      </template>

      <template #kind="{ row }">
        <t-tag :theme="row.kind === 'plan' ? 'primary' : 'success'" variant="light">
          {{ row.kind === 'plan' ? '会员' : '积分包' }}
        </t-tag>
      </template>

      <template #amount="{ row }">
        {{ formatMoney(row.amountCny) }} / {{ formatInt(row.points) }} 积分
      </template>

      <template #status="{ row }">
        <t-tag
          :theme="
            row.status === 'paid'
              ? 'success'
              : row.status === 'pending'
                ? 'warning'
                : 'default'
          "
          variant="light">
          {{ formatOrderStatus(row.status) }}
        </t-tag>
      </template>

      <template #createdAt="{ row }">
        {{ formatDateTime(row.createdAt) }}
      </template>

      <template #operation="{ row }">
        <t-space :size="0">
          <t-button
            v-if="row.status !== 'paid'"
            variant="text"
            theme="success"
            @click="submitStatus(row, 'paid')">
            标记支付
          </t-button>
          <t-button
            v-if="row.status !== 'canceled'"
            variant="text"
            theme="danger"
            @click="submitStatus(row, 'canceled')">
            取消
          </t-button>
        </t-space>
      </template>
    </Grid>
  </Page>
</template>
