<script setup lang="ts">
import type { SuperFormProps } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, ref } from 'vue';

import { Page } from '@super/common-ui';

import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next';

import { useSuperVxeGrid } from '#/adapter/vxe-table';
import { requestClient } from '#/api/request';

type InviteStatus = 'approved' | 'disabled' | 'pending' | 'rejected';
type InviteRiskLevel = 'danger' | 'normal' | 'warning';

interface InviteOwner {
  id: string;
  name: string;
  realName: string;
}

interface InviteItem {
  code: string;
  createdAt: string;
  dailyLimit: number;
  disabled: boolean;
  id: string;
  ipDailyLimit: number;
  lastRegisteredAt: null | string;
  maxUses: number;
  owner?: InviteOwner;
  remainingUses: number;
  requestReason: string;
  reviewNote: string;
  reviewedAt: string;
  riskLevel: InviteRiskLevel;
  riskReasons: string[];
  status: InviteStatus;
  todayMaxIpUses: number;
  todayUses: number;
  uniqueIpCount: number;
  useCount: number;
  userId: string;
}

interface InviteRegistrationItem {
  avatar: string;
  createdAt: string;
  id: string;
  inviteCode: string;
  inviteeName: string;
  inviteeRealName: string;
  inviteeUserId: string;
  ipAddress: string;
  userAgent: string;
}

interface InviteListResult {
  list: InviteItem[];
  metrics: {
    approved: number;
    disabled: number;
    pending: number;
    rejected: number;
    riskWarnings: number;
    todayUses: number;
    totalUses: number;
  };
  total: number;
}

const saving = ref(false);
const ruleDialogVisible = ref(false);
const registrationDialogVisible = ref(false);
const registrationLoading = ref(false);
const registrationRows = ref<InviteRegistrationItem[]>([]);
const registrationInvite = ref<InviteItem | null>(null);
const selectedInvite = ref<InviteItem | null>(null);
const actionLoading = ref<null | { action: 'approve' | 'disable' | 'enable' | 'reject'; id: string }>(null);
const metrics = ref<InviteListResult['metrics']>({
  approved: 0,
  disabled: 0,
  pending: 0,
  rejected: 0,
  riskWarnings: 0,
  todayUses: 0,
  totalUses: 0,
});
const ruleForm = ref({
  dailyLimit: 5,
  ipDailyLimit: 2,
  maxUses: 20,
  reviewNote: '',
});
const ruleLimits = {
  dailyLimit: 20,
  ipDailyLimit: 5,
  maxUses: 100,
  textLength: 500,
};

const metricCards = computed(() => [
  { desc: '等待管理员处理', label: '待审核', value: String(metrics.value.pending) },
  { desc: '当前可用于注册', label: '已启用', value: String(metrics.value.approved) },
  { desc: '累计邀请注册', label: '注册量', value: String(metrics.value.totalUses) },
  { desc: '今天通过邀请码注册', label: '今日注册', value: String(metrics.value.todayUses) },
  { desc: '接近或触发风控阈值', label: '风控预警', value: String(metrics.value.riskWarnings) },
  { desc: '已停用的邀请码', label: '已停用', value: String(metrics.value.disabled) },
  { desc: '被拒绝的申请', label: '已拒绝', value: String(metrics.value.rejected) },
]);

const formOptions: SuperFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: '用户名、邀请码、用户 ID 或申请说明',
      },
      fieldName: 'keyword',
      label: '关键词',
    },
    {
      component: 'Select',
      componentProps: {
        clearable: true,
        options: [
          { label: '待审核', value: 'pending' },
          { label: '已通过', value: 'approved' },
          { label: '已拒绝', value: 'rejected' },
          { label: '已停用', value: 'disabled' },
        ],
      },
      fieldName: 'status',
      label: '状态',
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
};

const gridOptions: VxeTableGridOptions<InviteItem> = {
  columns: [
    { title: '序号', type: 'seq', width: 64 },
    { field: 'owner', slots: { default: 'owner' }, title: '申请用户', minWidth: 220 },
    { field: 'code', slots: { default: 'code' }, title: '邀请码', minWidth: 180 },
    { field: 'status', slots: { default: 'status' }, title: '状态', width: 150 },
    { field: 'rules', slots: { default: 'rules' }, title: '约束规则', minWidth: 260 },
    { field: 'requestReason', slots: { default: 'requestReason' }, title: '申请/审核说明', minWidth: 260 },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: '操作',
      width: 340,
    },
  ],
  height: 'auto',
  keepSource: true,
  pagerConfig: {},
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues = {}) => {
        const res = await requestClient.get<InviteListResult>('/admin/invites', {
          params: {
            keyword: formValues.keyword?.trim() || '',
            page: page.currentPage,
            pageSize: page.pageSize,
            status: formValues.status || '',
          },
        });
        metrics.value = res.metrics;
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
} as VxeTableGridOptions<InviteItem>;

const [Grid, gridApi] = useSuperVxeGrid<InviteItem>({
  formOptions,
  gridOptions,
});

function statusLabel(status: InviteStatus) {
  return (
    {
      approved: '已通过',
      disabled: '已停用',
      pending: '待审核',
      rejected: '已拒绝',
    } as Record<InviteStatus, string>
  )[status];
}

function statusTheme(status: InviteStatus) {
  if (status === 'approved') return 'success';
  if (status === 'pending') return 'warning';
  return 'danger';
}

function riskTheme(level: InviteRiskLevel) {
  if (level === 'danger') return 'danger';
  if (level === 'warning') return 'warning';
  return 'default';
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN');
}

function usagePercent(row: InviteItem) {
  if (!row.maxUses) return 0;
  return Math.min(100, Math.round((row.useCount / row.maxUses) * 100));
}

function openRuleDialog(row: InviteItem) {
  selectedInvite.value = row;
  ruleForm.value = {
    dailyLimit: row.dailyLimit,
    ipDailyLimit: row.ipDailyLimit,
    maxUses: row.maxUses,
    reviewNote: row.reviewNote || '',
  };
  ruleDialogVisible.value = true;
}

function isActionLoading(row: InviteItem, action: 'approve' | 'disable' | 'enable' | 'reject') {
  return actionLoading.value?.id === row.id && actionLoading.value.action === action;
}

async function openRegistrations(row: InviteItem) {
  registrationInvite.value = row;
  registrationRows.value = [];
  registrationDialogVisible.value = true;
  registrationLoading.value = true;
  try {
    registrationRows.value = await requestClient.get<InviteRegistrationItem[]>(`/admin/invites/${row.id}/registrations`);
  } finally {
    registrationLoading.value = false;
  }
}

async function submitAction(row: InviteItem, action: 'approve' | 'disable' | 'enable' | 'reject') {
  const actionLabel = {
    approve: '通过',
    disable: '停用',
    enable: '启用',
    reject: '拒绝',
  }[action];

  const submit = async () => {
    actionLoading.value = { action, id: row.id };
    try {
      await requestClient.post(`/admin/invites/${row.id}`, {
        action,
        dailyLimit: row.dailyLimit,
        ipDailyLimit: row.ipDailyLimit,
        maxUses: row.maxUses,
      });
      MessagePlugin.success(`邀请码已${actionLabel}`);
      await gridApi.query();
    } finally {
      actionLoading.value = null;
    }
  };

  if (action === 'approve') {
    await submit();
    return;
  }

  const dialog = DialogPlugin.confirm({
    body: `确认${actionLabel}「${row.owner?.name || row.userId}」的邀请码申请？`,
    cancelBtn: '取消',
    confirmBtn: action === 'reject' || action === 'disable' ? { content: actionLabel, theme: 'danger' } : actionLabel,
    header: `${actionLabel}邀请码`,
    onCancel: () => dialog.hide(),
    onConfirm: async () => {
      await submit();
      dialog.hide();
    },
  });
}

async function submitRules() {
  if (!selectedInvite.value) return;
  saving.value = true;
  try {
    await requestClient.post(`/admin/invites/${selectedInvite.value.id}`, {
      action: 'updateLimits',
      ...ruleForm.value,
    });
    MessagePlugin.success('邀请码规则已更新');
    ruleDialogVisible.value = false;
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Page auto-content-height title="邀请码管理">
    <template #description>
      <div class="mt-2 text-foreground/70">
        防滥用规则：审核会员的邀请码申请，并通过总量、每日、同 IP 每日上限控制注册风险。
      </div>
    </template>
    <template #extra>
      <t-button theme="primary" @click="gridApi.reload()">
        <template #icon><t-icon name="refresh" /></template>
        刷新
      </t-button>
    </template>

    <div class="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-7">
      <div
        v-for="item in metricCards"
        :key="item.label"
        class="rounded-lg border border-border bg-card px-5 py-4">
        <div class="text-sm text-foreground/60">{{ item.label }}</div>
        <div class="mt-2 truncate text-2xl font-semibold">{{ item.value }}</div>
        <div class="mt-1 text-xs text-foreground/50">{{ item.desc }}</div>
      </div>
    </div>

    <Grid table-title="邀请码申请" table-title-help="admin 账号不能申请邀请码；每个会员最多拥有一个邀请码">
      <template #owner="{ row }">
        <div class="min-w-0 text-left">
          <div class="truncate font-medium">{{ row.owner?.realName || row.owner?.name || '-' }}</div>
          <div class="truncate text-xs text-foreground/60">ID {{ row.userId }} · {{ row.owner?.name || '-' }}</div>
        </div>
      </template>

      <template #code="{ row }">
        <div class="min-w-0 text-left">
          <div class="truncate font-mono text-sm">{{ row.code || '审核通过后由用户生成' }}</div>
          <div class="truncate text-xs text-foreground/60">已注册 {{ row.useCount }} 个账号</div>
          <div class="truncate text-xs text-foreground/50">最后注册 {{ formatDate(row.lastRegisteredAt) }}</div>
        </div>
      </template>

      <template #status="{ row }">
        <div class="flex flex-col items-start gap-2">
          <t-tag :theme="statusTheme(row.status)" variant="light">{{ statusLabel(row.status) }}</t-tag>
          <t-tag v-if="row.riskLevel !== 'normal'" :theme="riskTheme(row.riskLevel)" variant="light">
            风控预警
          </t-tag>
        </div>
      </template>

      <template #rules="{ row }">
        <div class="text-xs leading-5">
          <div class="grid grid-cols-3 gap-2">
            <span>总 {{ row.useCount }}/{{ row.maxUses }}</span>
            <span>剩 {{ row.remainingUses }}</span>
            <span>{{ usagePercent(row) }}%</span>
            <span>今日 {{ row.todayUses }}/{{ row.dailyLimit }}</span>
            <span>单 IP {{ row.todayMaxIpUses }}/{{ row.ipDailyLimit }}</span>
            <span>去重 IP {{ row.uniqueIpCount }}</span>
          </div>
          <div v-if="row.riskReasons.length > 0" class="mt-1 truncate" style="color: var(--td-warning-color)">
            {{ row.riskReasons[0] }}
          </div>
        </div>
      </template>

      <template #requestReason="{ row }">
        <div class="min-w-0 text-left">
          <div class="truncate">{{ row.requestReason || '-' }}</div>
          <div class="truncate text-xs text-foreground/60">
            {{ row.reviewNote || '暂无审核备注' }} · {{ formatDate(row.reviewedAt || row.createdAt) }}
          </div>
        </div>
      </template>

      <template #operation="{ row }">
        <t-space :size="0">
          <t-button
            v-if="['pending', 'rejected'].includes(row.status)"
            variant="text"
            theme="primary"
            :loading="isActionLoading(row, 'approve')"
            @click="submitAction(row, 'approve')">
            通过
          </t-button>
          <t-button
            v-if="row.status !== 'rejected'"
            variant="text"
            theme="danger"
            :loading="isActionLoading(row, 'reject')"
            @click="submitAction(row, 'reject')">
            拒绝
          </t-button>
          <t-button
            v-if="row.status === 'approved'"
            variant="text"
            theme="danger"
            :loading="isActionLoading(row, 'disable')"
            @click="submitAction(row, 'disable')">
            停用
          </t-button>
          <t-button
            v-if="row.status === 'disabled'"
            variant="text"
            theme="primary"
            :loading="isActionLoading(row, 'enable')"
            @click="submitAction(row, 'enable')">
            启用
          </t-button>
          <t-button variant="text" theme="primary" @click="openRegistrations(row)">注册账号</t-button>
          <t-button variant="text" theme="primary" @click="openRuleDialog(row)">规则</t-button>
        </t-space>
      </template>
    </Grid>

    <t-dialog
      v-model:visible="ruleDialogVisible"
      header="邀请码约束规则"
      placement="center"
      width="520px"
      :confirm-btn="{ content: '保存', loading: saving }"
      @confirm="submitRules">
      <t-form label-align="top">
        <t-form-item label="总注册上限">
          <t-input-number v-model="ruleForm.maxUses" :min="1" :max="ruleLimits.maxUses" :step="1" />
        </t-form-item>
        <t-form-item label="每日注册上限">
          <t-input-number v-model="ruleForm.dailyLimit" :min="1" :max="ruleLimits.dailyLimit" :step="1" />
        </t-form-item>
        <t-form-item label="同 IP 每日注册上限">
          <t-input-number v-model="ruleForm.ipDailyLimit" :min="1" :max="Math.min(ruleLimits.ipDailyLimit, ruleForm.dailyLimit)" :step="1" />
        </t-form-item>
        <t-form-item label="审核备注">
          <t-textarea
            v-model="ruleForm.reviewNote"
            :autosize="{ minRows: 3, maxRows: 5 }"
            :maxlength="ruleLimits.textLength"
            placeholder="可记录风控原因或审核说明" />
        </t-form-item>
      </t-form>
    </t-dialog>

    <t-dialog
      v-model:visible="registrationDialogVisible"
      header="邀请注册账号"
      placement="center"
      width="760px"
      :footer="false">
      <div class="mb-4 min-w-0 text-sm text-foreground/70">
        <span class="font-medium">{{ registrationInvite?.owner?.realName || registrationInvite?.owner?.name || '-' }}</span>
        <span class="mx-2 text-foreground/40">·</span>
        <span class="font-mono">{{ registrationInvite?.code || '暂未生成邀请码' }}</span>
        <span class="mx-2 text-foreground/40">·</span>
        <span>今日 {{ registrationInvite?.todayUses || 0 }} / 单 IP {{ registrationInvite?.todayMaxIpUses || 0 }}</span>
      </div>
      <t-loading :loading="registrationLoading">
        <t-empty v-if="registrationRows.length === 0" description="暂无通过该邀请码注册的账号" />
        <div v-else class="max-h-[520px] space-y-3 overflow-auto pr-1">
          <div
            v-for="item in registrationRows"
            :key="item.id"
            class="rounded-md border border-border bg-card px-4 py-3">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="truncate font-medium">{{ item.inviteeRealName || item.inviteeName || '-' }}</div>
                <div class="mt-1 truncate text-xs text-foreground/60">
                  ID {{ item.inviteeUserId }} · {{ item.inviteeName || '-' }}
                </div>
              </div>
              <div class="shrink-0 text-right text-xs text-foreground/60">{{ formatDate(item.createdAt) }}</div>
            </div>
            <div class="mt-3 grid grid-cols-1 gap-2 text-xs text-foreground/60 md:grid-cols-2">
              <div class="truncate">IP：{{ item.ipAddress || '-' }}</div>
              <div class="truncate">邀请码：{{ item.inviteCode || '-' }}</div>
              <div class="truncate md:col-span-2">UA：{{ item.userAgent || '-' }}</div>
            </div>
          </div>
        </div>
      </t-loading>
    </t-dialog>
  </Page>
</template>
