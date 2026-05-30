<script setup lang="ts">
import type { SuperFormProps } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, ref } from 'vue';

import { Page } from '@super/common-ui';

import { useSuperVxeGrid } from '#/adapter/vxe-table';

import {
  fetchCatalog,
  formatInt,
  formatMoney,
  savePackage,
  savePlan,
  type MembershipPlan,
  type PointsPackage,
} from './api';

const saving = ref(false);
const plans = ref<MembershipPlan[]>([]);
const packages = ref<PointsPackage[]>([]);
const planDialogVisible = ref(false);
const packageDialogVisible = ref(false);
const editingPlanKey = ref('');
const editingPackageKey = ref('');

const planForm = ref<MembershipPlan>(createPlanForm());
const packageForm = ref<PointsPackage>(createPackageForm());

const metrics = computed(() => {
  const enabledPlans = plans.value.filter((plan) => plan.enabled).length;
  const popularPlans = plans.value.filter((plan) => plan.popular).length;
  const enabledPackages = packages.value.filter((pkg) => pkg.enabled).length;
  const maxPackagePoints = packages.value.reduce(
    (max, pkg) => Math.max(max, Number(pkg.points || 0)),
    0,
  );

  return [
    {
      desc: `推荐 ${popularPlans} 个`,
      label: '启用套餐',
      value: `${enabledPlans}/${plans.value.length}`,
    },
    {
      desc: `最高 ${formatInt(maxPackagePoints)} 积分`,
      label: '启用积分包',
      value: `${enabledPackages}/${packages.value.length}`,
    },
    {
      desc: '同步展示到会员中心',
      label: '权益条目',
      value: formatInt(
        plans.value.reduce((sum, plan) => sum + plan.features.length, 0),
      ),
    },
  ];
});

const planFormOptions: SuperFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: '搜索套餐、等级或权益',
      },
      fieldName: 'keyword',
      label: '关键词',
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: '全部套餐', value: 'all' },
          { label: '仅启用', value: 'enabled' },
          { label: '仅停用', value: 'disabled' },
          { label: '仅推荐', value: 'popular' },
        ],
      },
      defaultValue: 'all',
      fieldName: 'status',
      label: '状态',
    },
  ],
  showCollapseButton: false,
  submitOnChange: true,
  submitOnEnter: true,
};

const packageFormOptions: SuperFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: '搜索积分包或说明',
      },
      fieldName: 'keyword',
      label: '关键词',
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: '全部积分包', value: 'all' },
          { label: '仅启用', value: 'enabled' },
          { label: '仅停用', value: 'disabled' },
        ],
      },
      defaultValue: 'all',
      fieldName: 'status',
      label: '状态',
    },
  ],
  showCollapseButton: false,
  submitOnChange: true,
  submitOnEnter: true,
};

const planGridOptions: VxeTableGridOptions<MembershipPlan> = {
  columns: [
    { title: '序号', type: 'seq', width: 64 },
    { align: 'left', field: 'name', slots: { default: 'name' }, title: '套餐', minWidth: 220 },
    { field: 'billingPeriod', slots: { default: 'billingPeriod' }, title: '周期', width: 88 },
    { field: 'price', slots: { default: 'price' }, title: '价格/积分', width: 156 },
    { field: 'limits', slots: { default: 'limits' }, title: '额度', width: 156 },
    { align: 'left', field: 'features', slots: { default: 'features' }, title: '权益', minWidth: 360 },
    { field: 'status', slots: { default: 'status' }, title: '状态', width: 128 },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: '操作',
      width: 172,
    },
  ],
  keepSource: true,
  maxHeight: 520,
  pagerConfig: {
    pageSize: 10,
  },
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues = {}) => {
        const res = await fetchCatalog();
        syncCatalog(res);
        const filtered = filterPlans(res.plans, formValues);
        return pageResult(filtered, page.currentPage, page.pageSize);
      },
    },
  },
  rowConfig: {
    keyField: 'key',
  },
  toolbarConfig: {
    custom: true,
    refresh: true,
    search: true,
    zoom: true,
  },
} as VxeTableGridOptions<MembershipPlan>;

const packageGridOptions: VxeTableGridOptions<PointsPackage> = {
  columns: [
    { title: '序号', type: 'seq', width: 64 },
    { align: 'left', field: 'key', slots: { default: 'key' }, title: '积分包', minWidth: 220 },
    { align: 'right', field: 'points', slots: { default: 'points' }, title: '积分', width: 128 },
    { align: 'right', field: 'priceCny', slots: { default: 'priceCny' }, title: '价格', width: 112 },
    { field: 'validityDays', slots: { default: 'validityDays' }, title: '有效期', width: 112 },
    { align: 'left', field: 'description', title: '说明', minWidth: 420 },
    { field: 'status', slots: { default: 'status' }, title: '状态', width: 100 },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: '操作',
      width: 172,
    },
  ],
  keepSource: true,
  maxHeight: 520,
  pagerConfig: {
    pageSize: 10,
  },
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues = {}) => {
        const res = await fetchCatalog();
        syncCatalog(res);
        const filtered = filterPackages(res.pointPackages, formValues);
        return pageResult(filtered, page.currentPage, page.pageSize);
      },
    },
  },
  rowConfig: {
    keyField: 'key',
  },
  toolbarConfig: {
    custom: true,
    refresh: true,
    search: true,
    zoom: true,
  },
} as VxeTableGridOptions<PointsPackage>;

const [PlanGrid, planGridApi] = useSuperVxeGrid<MembershipPlan>({
  formOptions: planFormOptions,
  gridOptions: planGridOptions,
});
const [PackageGrid, packageGridApi] = useSuperVxeGrid<PointsPackage>({
  formOptions: packageFormOptions,
  gridOptions: packageGridOptions,
});

function createPlanForm(source?: MembershipPlan): MembershipPlan {
  return source
    ? { ...source, features: [...source.features] }
    : {
        billingPeriod: 'monthly',
        enabled: true,
        features: ['会员积分额度', '生成任务优先级', '下载去水印'],
        key: '',
        levelKey: 'standard',
        levelName: '标准会员',
        maxSeries: 10,
        maxShots: 50,
        name: '',
        originalPriceCny: null,
        pointValidityDays: 31,
        points: 500,
        popular: false,
        priceCny: 60,
        sortOrder: 10,
        yearlyDiscountLabel: null,
      };
}

function createPackageForm(source?: PointsPackage): PointsPackage {
  return source
    ? { ...source }
    : {
        description: '',
        enabled: true,
        key: '',
        points: 500,
        priceCny: 60,
        sortOrder: 10,
        validityDays: 730,
      };
}

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

function syncLevelName() {
  const map = {
    advanced: '高级会员',
    enterprise: '企业会员',
    free: '免费会员',
    standard: '标准会员',
  } as Record<string, string>;
  planForm.value.levelName =
    map[planForm.value.levelKey] || planForm.value.levelName;
}

function syncCatalog(res: { plans: MembershipPlan[]; pointPackages: PointsPackage[] }) {
  plans.value = res.plans;
  packages.value = res.pointPackages;
}

function pageResult<T>(items: T[], currentPage: number, pageSize: number) {
  const safePage = Number(currentPage) > 0 ? Number(currentPage) : 1;
  const safePageSize = Number(pageSize) > 0 ? Number(pageSize) : 10;
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    total: items.length,
  };
}

function filterPlans(source: MembershipPlan[], formValues: Record<string, any>) {
  const keyword = String(formValues.keyword || '').trim().toLowerCase();
  const status = formValues.status || 'all';
  return source.filter((plan) => {
    const statusMatched =
      status === 'all' ||
      (status === 'enabled' && plan.enabled) ||
      (status === 'disabled' && !plan.enabled) ||
      (status === 'popular' && plan.popular);
    if (!statusMatched) return false;
    if (!keyword) return true;
    return [
      plan.key,
      plan.name,
      plan.levelKey,
      plan.levelName,
      plan.billingPeriod,
      ...plan.features,
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword);
  });
}

function filterPackages(source: PointsPackage[], formValues: Record<string, any>) {
  const keyword = String(formValues.keyword || '').trim().toLowerCase();
  const status = formValues.status || 'all';
  return source.filter((pkg) => {
    const statusMatched =
      status === 'all' ||
      (status === 'enabled' && pkg.enabled) ||
      (status === 'disabled' && !pkg.enabled);
    if (!statusMatched) return false;
    if (!keyword) return true;
    return [pkg.key, pkg.description, pkg.points]
      .join(' ')
      .toLowerCase()
      .includes(keyword);
  });
}

async function refreshCatalogGrids() {
  await Promise.all([planGridApi.query(), packageGridApi.query()]);
}

function openPlanDialog(row?: MembershipPlan, duplicate = false) {
  editingPlanKey.value = duplicate ? '' : row?.key || '';
  planForm.value = createPlanForm(row);
  if (duplicate && row) {
    planForm.value.key = `${row.key}_copy`;
    planForm.value.name = `${row.name} 副本`;
    planForm.value.enabled = false;
    planForm.value.popular = false;
  }
  planDialogVisible.value = true;
}

function openPackageDialog(row?: PointsPackage, duplicate = false) {
  editingPackageKey.value = duplicate ? '' : row?.key || '';
  packageForm.value = createPackageForm(row);
  if (duplicate && row) {
    packageForm.value.key = `${row.key}_copy`;
    packageForm.value.enabled = false;
  }
  packageDialogVisible.value = true;
}

async function submitPlan() {
  if (!planForm.value.key.trim() || !planForm.value.name.trim()) {
    window.$message.warning('请填写套餐标识和套餐名称');
    return;
  }
  saving.value = true;
  try {
    const res = await savePlan({
      ...planForm.value,
      originalPriceCny: planForm.value.originalPriceCny || null,
      yearlyDiscountLabel: planForm.value.yearlyDiscountLabel || null,
    });
    syncCatalog(res);
    window.$message.success('会员套餐已保存');
    planDialogVisible.value = false;
    await refreshCatalogGrids();
  } finally {
    saving.value = false;
  }
}

async function submitPackage() {
  if (!packageForm.value.key.trim()) {
    window.$message.warning('请填写积分包标识');
    return;
  }
  saving.value = true;
  try {
    const res = await savePackage(packageForm.value);
    syncCatalog(res);
    window.$message.success('积分包已保存');
    packageDialogVisible.value = false;
    await refreshCatalogGrids();
  } finally {
    saving.value = false;
  }
}

async function togglePlanEnabled(row: MembershipPlan) {
  saving.value = true;
  try {
    const res = await savePlan({ ...row, enabled: !row.enabled });
    syncCatalog(res);
    window.$message.success(row.enabled ? '套餐已停用' : '套餐已启用');
    await refreshCatalogGrids();
  } finally {
    saving.value = false;
  }
}

async function togglePackageEnabled(row: PointsPackage) {
  saving.value = true;
  try {
    const res = await savePackage({ ...row, enabled: !row.enabled });
    syncCatalog(res);
    window.$message.success(row.enabled ? '积分包已停用' : '积分包已启用');
    await refreshCatalogGrids();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Page title="功能管理">
    <template #description>
      <div class="mt-2 text-foreground/70">
        管理会员套餐、积分包和对外展示的权益文案。
      </div>
    </template>
    <template #extra>
      <t-button theme="primary" @click="refreshCatalogGrids">
        <template #icon><t-icon name="refresh" /></template>
        刷新
      </t-button>
    </template>

    <div class="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
      <div
        v-for="item in metrics"
        :key="item.label"
        class="rounded-lg border border-border bg-card px-5 py-4">
        <div class="text-sm text-foreground/60">{{ item.label }}</div>
        <div class="mt-2 text-2xl font-semibold">{{ item.value }}</div>
        <div class="mt-1 text-xs text-foreground/50">{{ item.desc }}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-5">
      <PlanGrid table-title="会员套餐" table-title-help="订阅套餐会同步展示到 Web 侧会员中心">
        <template #toolbar-tools>
          <t-button theme="primary" @click="openPlanDialog()">
            <template #icon><t-icon name="add" /></template>
            新增套餐
          </t-button>
        </template>

        <template #name="{ row }">
          <div class="font-medium">{{ row.name }}</div>
          <div class="text-xs text-foreground/60">{{ row.key }}</div>
        </template>

        <template #billingPeriod="{ row }">
          <t-tag variant="light">{{ periodLabel(row.billingPeriod) }}</t-tag>
        </template>

        <template #price="{ row }">
          {{ formatMoney(row.priceCny) }} / {{ formatInt(row.points) }} 积分
        </template>

        <template #limits="{ row }">
          分镜 {{ row.maxShots ?? '-' }} / 项目 {{ row.maxSeries ?? '-' }}
        </template>

        <template #features="{ row }">
          <t-space :size="6">
            <t-tag v-for="feature in row.features.slice(0, 3)" :key="feature" variant="light">
              {{ feature }}
            </t-tag>
            <span v-if="row.features.length > 3" class="text-xs text-foreground/60">
              +{{ row.features.length - 3 }}
            </span>
          </t-space>
        </template>

        <template #status="{ row }">
          <t-space :size="6">
            <t-tag :theme="row.enabled ? 'success' : 'default'" variant="light">
              {{ row.enabled ? '启用' : '停用' }}
            </t-tag>
            <t-tag v-if="row.popular" theme="primary" variant="light">推荐</t-tag>
          </t-space>
        </template>

        <template #operation="{ row }">
          <t-space :size="0">
            <t-button variant="text" theme="primary" @click="openPlanDialog(row)">
              编辑
            </t-button>
            <t-button variant="text" theme="primary" @click="openPlanDialog(row, true)">
              复制
            </t-button>
            <t-button
              variant="text"
              :theme="row.enabled ? 'danger' : 'success'"
              :loading="saving"
              @click="togglePlanEnabled(row)">
              {{ row.enabled ? '停用' : '启用' }}
            </t-button>
          </t-space>
        </template>
      </PlanGrid>

      <PackageGrid table-title="积分包" table-title-help="积分包会同步展示到 Web 侧购买积分页">
        <template #toolbar-tools>
          <t-button theme="primary" @click="openPackageDialog()">
            <template #icon><t-icon name="add" /></template>
            新增积分包
          </t-button>
        </template>

        <template #key="{ row }">
          <div class="font-medium">{{ row.key }}</div>
          <div class="text-xs text-foreground/60">排序 {{ row.sortOrder }}</div>
        </template>

        <template #points="{ row }">
          {{ formatInt(row.points) }}
        </template>

        <template #priceCny="{ row }">
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

        <template #operation="{ row }">
          <t-space :size="0">
            <t-button variant="text" theme="primary" @click="openPackageDialog(row)">
              编辑
            </t-button>
            <t-button variant="text" theme="primary" @click="openPackageDialog(row, true)">
              复制
            </t-button>
            <t-button
              variant="text"
              :theme="row.enabled ? 'danger' : 'success'"
              :loading="saving"
              @click="togglePackageEnabled(row)">
              {{ row.enabled ? '停用' : '启用' }}
            </t-button>
          </t-space>
        </template>
      </PackageGrid>
    </div>

    <t-dialog
      v-model:visible="planDialogVisible"
      :header="editingPlanKey ? '编辑会员套餐' : '新增会员套餐'"
      placement="center"
      width="720px"
      :confirm-btn="{ content: '保存', loading: saving }"
      @confirm="submitPlan">
      <t-alert
        class="mb-4"
        theme="info"
        message="会员套餐会同步展示到 Web 侧会员订阅弹窗，停用后不再对用户展示。" />
      <t-form :data="planForm" label-align="top">
        <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <t-form-item label="套餐标识">
            <t-input
              v-model="planForm.key"
              :disabled="Boolean(editingPlanKey)"
              placeholder="standard_monthly" />
          </t-form-item>
          <t-form-item label="套餐名称">
            <t-input v-model="planForm.name" placeholder="标准会员" />
          </t-form-item>
          <t-form-item label="等级">
            <t-select v-model="planForm.levelKey" @change="syncLevelName">
              <t-option value="free" label="免费会员" />
              <t-option value="standard" label="标准会员" />
              <t-option value="advanced" label="高级会员" />
              <t-option value="enterprise" label="企业会员" />
            </t-select>
          </t-form-item>
          <t-form-item label="等级展示名">
            <t-input v-model="planForm.levelName" />
          </t-form-item>
          <t-form-item label="计费周期">
            <t-select v-model="planForm.billingPeriod">
              <t-option value="free" label="免费" />
              <t-option value="monthly" label="月付" />
              <t-option value="yearly" label="年付" />
              <t-option value="enterprise" label="企业" />
            </t-select>
          </t-form-item>
          <t-form-item label="排序">
            <t-input-number v-model="planForm.sortOrder" style="width: 100%" />
          </t-form-item>
          <t-form-item label="价格（元）">
            <t-input-number
              v-model="planForm.priceCny"
              :min="0"
              :decimal-places="2"
              style="width: 100%" />
          </t-form-item>
          <t-form-item label="原价（元）">
            <t-input-number
              v-model="planForm.originalPriceCny"
              :min="0"
              :decimal-places="2"
              style="width: 100%" />
          </t-form-item>
          <t-form-item label="赠送积分">
            <t-input-number v-model="planForm.points" :min="0" style="width: 100%" />
          </t-form-item>
          <t-form-item label="积分有效期（天）">
            <t-input-number
              v-model="planForm.pointValidityDays"
              :min="1"
              style="width: 100%" />
          </t-form-item>
          <t-form-item label="最大分镜数">
            <t-input-number v-model="planForm.maxShots" :min="0" style="width: 100%" />
          </t-form-item>
          <t-form-item label="最大项目数">
            <t-input-number v-model="planForm.maxSeries" :min="0" style="width: 100%" />
          </t-form-item>
          <t-form-item label="年付折扣标签">
            <t-input v-model="planForm.yearlyDiscountLabel" placeholder="例如 8折" />
          </t-form-item>
          <t-form-item label="开关">
            <div class="flex h-8 items-center gap-6">
              <t-checkbox v-model="planForm.enabled">启用</t-checkbox>
              <t-checkbox v-model="planForm.popular">推荐</t-checkbox>
            </div>
          </t-form-item>
        </div>
        <t-form-item label="权益文案">
          <t-tag-input
            v-model="planForm.features"
            clearable
            placeholder="输入权益后回车" />
        </t-form-item>
        <div class="rounded-lg border border-border bg-muted/40 p-4">
          <div class="mb-2 text-sm font-medium">展示预览</div>
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <t-tag :theme="planForm.enabled ? 'success' : 'default'" variant="light">
              {{ planForm.enabled ? '启用' : '停用' }}
            </t-tag>
            <t-tag v-if="planForm.popular" theme="primary" variant="light">推荐</t-tag>
            <strong>{{ planForm.name || '未命名套餐' }}</strong>
            <span class="text-foreground/60">
              {{ formatMoney(planForm.priceCny) }} / {{ formatInt(planForm.points) }} 积分
            </span>
          </div>
        </div>
      </t-form>
    </t-dialog>

    <t-dialog
      v-model:visible="packageDialogVisible"
      :header="editingPackageKey ? '编辑积分包' : '新增积分包'"
      placement="center"
      width="560px"
      :confirm-btn="{ content: '保存', loading: saving }"
      @confirm="submitPackage">
      <t-alert
        class="mb-4"
        theme="info"
        message="积分包会同步展示到 Web 侧购买积分页，停用后不再对用户展示。" />
      <t-form :data="packageForm" label-align="top">
        <t-form-item label="积分包标识">
          <t-input
            v-model="packageForm.key"
            :disabled="Boolean(editingPackageKey)"
            placeholder="points_500" />
        </t-form-item>
        <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <t-form-item label="积分数量">
            <t-input-number v-model="packageForm.points" :min="1" style="width: 100%" />
          </t-form-item>
          <t-form-item label="价格（元）">
            <t-input-number
              v-model="packageForm.priceCny"
              :min="0"
              :decimal-places="2"
              style="width: 100%" />
          </t-form-item>
          <t-form-item label="有效期（天）">
            <t-input-number
              v-model="packageForm.validityDays"
              :min="1"
              style="width: 100%" />
          </t-form-item>
          <t-form-item label="排序">
            <t-input-number v-model="packageForm.sortOrder" style="width: 100%" />
          </t-form-item>
        </div>
        <t-form-item label="说明">
          <t-textarea
            v-model="packageForm.description"
            placeholder="约生成 50 个视频片段或 500 张图片" />
        </t-form-item>
        <t-form-item label="状态">
          <t-checkbox v-model="packageForm.enabled">启用</t-checkbox>
        </t-form-item>
      </t-form>
    </t-dialog>
  </Page>
</template>
