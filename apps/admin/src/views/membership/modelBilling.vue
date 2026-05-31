<script setup lang="ts">
import { Page } from '@super/common-ui';
import { computed, onMounted, ref } from 'vue';

import {
  fetchModelBillingRules,
  formatInt,
  saveModelBillingRules,
  type ModelBillingRule,
} from './api';

const loading = ref(false);
const saving = ref(false);
const keyword = ref('');
const modelType = ref('all');
const rows = ref<ModelBillingRule[]>([]);
const summary = ref({ billableModels: 0, models: 0, vendors: 0 });

const columns = [
  { colKey: 'model', title: '模型', width: 320 },
  { colKey: 'vendorName', title: '服务商', width: 180 },
  { colKey: 'modelType', title: '类型', width: 110 },
  { align: 'right', colKey: 'pointsPerCall', title: '每次调用积分', width: 180 },
  { align: 'center', colKey: 'enabled', title: '启用计费', width: 120 },
  { align: 'right', colKey: 'preview', title: '预览', width: 140 },
  { colKey: 'status', title: '状态', width: 120 },
  { align: 'center', colKey: 'operation', fixed: 'right', title: '操作', width: 110 },
];

const typeOptions = [
  { label: '全部类型', value: 'all' },
  { label: '文本模型', value: 'text' },
  { label: '图片模型', value: 'image' },
  { label: '视频模型', value: 'video' },
];

const filteredRows = computed(() => {
  const key = keyword.value.trim().toLowerCase();
  return rows.value.filter((row) => {
    const matchesType = modelType.value === 'all' || row.modelType === modelType.value;
    const text = `${row.vendorName} ${row.modelLabel} ${row.modelName}`.toLowerCase();
    return matchesType && (!key || text.includes(key));
  });
});

function typeLabel(type: string) {
  return (
    {
      image: '图片',
      text: '文本',
      video: '视频',
    } as Record<string, string>
  )[type] || type;
}

function typeTheme(type: string) {
  if (type === 'video') return 'warning';
  if (type === 'image') return 'success';
  return 'primary';
}

function normalizeRow(row: ModelBillingRule) {
  row.pointsPerCall = Math.max(0, Math.round(Number(row.pointsPerCall || 0)));
}

async function loadData() {
  loading.value = true;
  try {
    const data = await fetchModelBillingRules();
    rows.value = data.models;
    summary.value = data.summary;
  } finally {
    loading.value = false;
  }
}

async function saveRows(targetRows: ModelBillingRule[]) {
  saving.value = true;
  try {
    targetRows.forEach(normalizeRow);
    const data = await saveModelBillingRules(targetRows);
    rows.value = data.models;
    summary.value = data.summary;
    window.$message.success('模型计费规则已保存');
  } catch (err: any) {
    window.$message.error(err?.message || '保存模型计费规则失败');
  } finally {
    saving.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <Page auto-content-height content-class="modelBillingPageContent" title="模型计费">
    <template #description>
      <div class="mt-2 text-foreground/70">
        独立维护已启用供应商下可用模型的每次调用积分。未启用计费或积分为 0 的模型不会扣费。
      </div>
    </template>
    <template #extra>
      <t-space>
        <t-button variant="outline" :loading="loading" @click="loadData">
          <template #icon><t-icon name="refresh" /></template>
          刷新
        </t-button>
        <t-button theme="primary" :loading="saving" @click="saveRows(rows)">
          <template #icon><t-icon name="save" /></template>
          保存全部
        </t-button>
      </t-space>
    </template>

    <div class="modelBilling">
      <section class="summaryBand">
        <div class="metric">
          <span>服务商</span>
          <strong>{{ formatInt(summary.vendors) }}</strong>
        </div>
        <div class="metric">
          <span>模型总数</span>
          <strong>{{ formatInt(summary.models) }}</strong>
        </div>
        <div class="metric">
          <span>已计费模型</span>
          <strong>{{ formatInt(summary.billableModels) }}</strong>
        </div>
      </section>

      <section class="toolbar">
        <t-input v-model="keyword" clearable placeholder="搜索服务商、模型名或模型 ID" />
        <t-select v-model="modelType" :options="typeOptions" style="width: 180px" />
      </section>

      <t-alert theme="info" title="扣费口径" close>
        这里配置的是“单次模型调用”的基础积分。批量生成会按有效生成条数累加，任务失败会释放已冻结积分。
      </t-alert>

      <div class="tableRegion">
        <t-table
          row-key="model"
          :data="filteredRows"
          :columns="columns"
          :loading="loading"
          hover
          bordered
          table-layout="fixed"
          max-height="100%"
          class="billingTable">
          <template #model="{ row }">
            <div class="modelCell">
              <strong>{{ row.modelLabel }}</strong>
              <span>{{ row.modelName }}</span>
            </div>
          </template>

          <template #modelType="{ row }">
            <t-tag :theme="typeTheme(row.modelType)" variant="light">
              {{ typeLabel(row.modelType) }}
            </t-tag>
          </template>

          <template #pointsPerCall="{ row }">
            <t-input-number
              v-model="row.pointsPerCall"
              :min="0"
              :decimal-places="0"
              theme="column"
              align="right"
              style="width: 140px"
              @blur="normalizeRow(row)" />
          </template>

          <template #enabled="{ row }">
            <t-switch v-model="row.enabled" />
          </template>

          <template #preview="{ row }">
            <span class="previewCost">{{ row.enabled ? `${formatInt(row.pointsPerCall)} 积分/次` : '不扣费' }}</span>
          </template>

          <template #status="{ row }">
            <t-tag v-if="row.enabled && row.pointsPerCall > 0" theme="success" variant="light">计费中</t-tag>
            <t-tag v-else theme="default" variant="light">免费</t-tag>
          </template>

          <template #operation="{ row }">
            <t-button size="small" variant="text" theme="primary" :loading="saving" @click="saveRows([row])">
              保存
            </t-button>
          </template>
        </t-table>
      </div>
    </div>
  </Page>
</template>

<style scoped lang="scss">
:deep(.modelBillingPageContent) {
  overflow: hidden !important;
}

.modelBilling {
  display: grid;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  gap: 14px;
}

.summaryBand {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.metric {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  padding: 16px;
  background: var(--td-bg-color-container);

  span {
    display: block;
    color: var(--td-text-color-secondary);
    font-size: 13px;
  }

  strong {
    display: block;
    margin-top: 6px;
    color: var(--td-text-color-primary);
    font-size: 24px;
  }
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(260px, 420px) 180px;
  gap: 12px;
}

.modelCell {
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

.previewCost {
  font-weight: 600;
}

.tableRegion {
  min-height: 0;
  overflow: hidden;
}

.billingTable {
  height: 100%;
}

:deep(.billingTable .t-table),
:deep(.billingTable .t-table__content) {
  height: 100%;
}

@media (max-width: 720px) {
  .summaryBand,
  .toolbar {
    grid-template-columns: 1fr;
  }
}
</style>
