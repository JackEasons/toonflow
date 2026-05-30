<script setup lang="ts">
import type { SuperFormProps } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { ref } from 'vue';

import { Page } from '@super/common-ui';

import { useSuperVxeGrid } from '#/adapter/vxe-table';

import {
  adjustPoints,
  fetchUsers,
  formatDate,
  formatInt,
  updateMembership,
  type MemberUser,
} from './api';

const saving = ref(false);
const membershipDialogVisible = ref(false);
const pointsDialogVisible = ref(false);

const membershipForm = ref({
  autoRenew: false,
  expiresAt: '',
  levelKey: 'free',
  levelName: '免费会员',
  planKey: 'free',
  status: 'active',
  userId: '',
});
const pointsForm = ref({
  amount: 0,
  bucket: 'bonus' as 'bonus' | 'membership' | 'recharge',
  description: '后台调整积分',
  userId: '',
});

const formOptions: SuperFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: '用户名、昵称或用户 ID',
      },
      fieldName: 'keyword',
      label: '关键词',
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
};

const gridOptions: VxeTableGridOptions<MemberUser> = {
  columns: [
    { title: '序号', type: 'seq', width: 64 },
    { field: 'user', slots: { default: 'user' }, title: '用户', width: 260 },
    { field: 'membership', slots: { default: 'membership' }, title: '会员', width: 220 },
    { field: 'points', slots: { default: 'points' }, title: '积分账户', minWidth: 320 },
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
        const res = await fetchUsers({
          keyword: formValues.keyword?.trim() || '',
          page: page.currentPage,
          pageSize: page.pageSize,
        });
        return { items: res.list, total: res.total };
      },
    },
  },
  rowConfig: {
    keyField: 'userId',
  },
  toolbarConfig: {
    custom: true,
    refresh: true,
    search: true,
    zoom: true,
  },
} as VxeTableGridOptions<MemberUser>;

const [Grid, gridApi] = useSuperVxeGrid<MemberUser>({
  formOptions,
  gridOptions,
});

function syncLevelName() {
  const map = {
    advanced: '高级会员',
    enterprise: '企业会员',
    free: '免费会员',
    standard: '标准会员',
  } as Record<string, string>;
  membershipForm.value.levelName =
    map[membershipForm.value.levelKey] || membershipForm.value.levelName;
}

function openMembershipDialog(row: MemberUser) {
  membershipForm.value = {
    autoRenew: row.membership.autoRenew,
    expiresAt: row.membership.expiresAt || '',
    levelKey: row.membership.levelKey,
    levelName: row.membership.levelName,
    planKey: row.membership.planKey,
    status: row.membership.status,
    userId: row.userId,
  };
  membershipDialogVisible.value = true;
}

function openPointsDialog(row: MemberUser) {
  pointsForm.value = {
    amount: 0,
    bucket: 'bonus',
    description: '后台调整积分',
    userId: row.userId,
  };
  pointsDialogVisible.value = true;
}

async function submitMembership() {
  saving.value = true;
  try {
    await updateMembership({
      ...membershipForm.value,
      expiresAt: membershipForm.value.expiresAt || null,
    });
    window.$message.success('会员已更新');
    membershipDialogVisible.value = false;
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}

async function submitPoints() {
  saving.value = true;
  try {
    await adjustPoints(pointsForm.value);
    window.$message.success('积分已调整');
    pointsDialogVisible.value = false;
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Page auto-content-height title="用户管理">
    <template #description>
      <div class="mt-2 text-foreground/70">
        查看用户会员身份、积分余额，并处理后台人工调整。
      </div>
    </template>
    <template #extra>
      <t-button theme="primary" @click="gridApi.reload()">
        <template #icon><t-icon name="refresh" /></template>
        刷新
      </t-button>
    </template>

    <Grid table-title="用户列表" table-title-help="支持按用户名、昵称或用户 ID 搜索">
      <template #user="{ row }">
        <div class="flex min-w-0 items-center gap-3">
          <t-avatar size="36px" :image="row.avatar || undefined">
            {{ row.name.slice(0, 1) }}
          </t-avatar>
          <div class="min-w-0 text-left">
            <div class="truncate font-medium">{{ row.name }}</div>
            <div class="truncate text-xs text-foreground/60">ID {{ row.userId }}</div>
          </div>
        </div>
      </template>

      <template #membership="{ row }">
        <t-space direction="vertical" :size="4">
          <t-tag
            :theme="row.membership.levelKey === 'free' ? 'default' : 'primary'"
            variant="light">
            {{ row.membership.levelName }}
          </t-tag>
          <span class="text-xs text-foreground/60">
            {{ formatDate(row.membership.expiresAt) }}
          </span>
        </t-space>
      </template>

      <template #points="{ row }">
        <div class="font-semibold">{{ formatInt(row.points.remaining) }}</div>
        <div class="mt-1 text-xs text-foreground/60">
          会员 {{ formatInt(row.points.membership) }} / 充值
          {{ formatInt(row.points.recharge) }} / 赠送
          {{ formatInt(row.points.bonus) }}
        </div>
      </template>

      <template #operation="{ row }">
        <t-space :size="0">
          <t-button variant="text" theme="primary" @click="openMembershipDialog(row)">
            调会员
          </t-button>
          <t-button variant="text" theme="success" @click="openPointsDialog(row)">
            调积分
          </t-button>
        </t-space>
      </template>
    </Grid>

    <t-dialog
      v-model:visible="membershipDialogVisible"
      header="调整会员"
      placement="center"
      width="520px"
      :confirm-btn="{ content: '保存', loading: saving }"
      @confirm="submitMembership">
      <t-form label-align="top">
        <t-form-item label="会员等级">
          <t-select v-model="membershipForm.levelKey" @change="syncLevelName">
            <t-option value="free" label="免费会员" />
            <t-option value="standard" label="标准会员" />
            <t-option value="advanced" label="高级会员" />
            <t-option value="enterprise" label="企业会员" />
          </t-select>
        </t-form-item>
        <t-form-item label="显示名称">
          <t-input v-model="membershipForm.levelName" />
        </t-form-item>
        <t-form-item label="状态">
          <t-select v-model="membershipForm.status">
            <t-option value="active" label="生效中" />
            <t-option value="expired" label="已过期" />
            <t-option value="disabled" label="已禁用" />
          </t-select>
        </t-form-item>
        <t-form-item label="到期时间">
          <t-input
            v-model="membershipForm.expiresAt"
            placeholder="留空表示长期有效，例如 2026-12-31T23:59:59+08:00" />
        </t-form-item>
        <t-form-item label="自动续费">
          <t-switch v-model="membershipForm.autoRenew" />
        </t-form-item>
      </t-form>
    </t-dialog>

    <t-dialog
      v-model:visible="pointsDialogVisible"
      header="调整积分"
      placement="center"
      width="520px"
      :confirm-btn="{ content: '保存', loading: saving }"
      @confirm="submitPoints">
      <t-form label-align="top">
        <t-form-item label="调整数量">
          <t-input-number
            v-model="pointsForm.amount"
            :min="-9999999"
            :max="9999999"
            style="width: 100%" />
        </t-form-item>
        <t-form-item label="积分类型">
          <t-select v-model="pointsForm.bucket">
            <t-option value="bonus" label="赠送积分" />
            <t-option value="recharge" label="充值积分" />
            <t-option value="membership" label="会员积分" />
          </t-select>
        </t-form-item>
        <t-form-item label="说明">
          <t-textarea v-model="pointsForm.description" placeholder="后台调整积分" />
        </t-form-item>
      </t-form>
    </t-dialog>
  </Page>
</template>
