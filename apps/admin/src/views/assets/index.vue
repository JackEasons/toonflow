<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Page } from '@super/common-ui';

import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next';

import {
  batchDeleteAdminAssets,
  deleteAdminAsset,
  fetchAdminAssetOptions,
  fetchAdminAssets,
  formatDateTime,
  formatInt,
  updateAdminAsset,
  type AdminAssetItem,
  type AdminAssetOptions,
} from './api';

type MediaType = 'audio' | 'image' | 'unknown' | 'video';

const loading = ref(false);
const saving = ref(false);
const detailVisible = ref(false);
const editVisible = ref(false);
const mediaPreviewVisible = ref(false);
const selectedRowKeys = ref<Array<number | string>>([]);
const rows = ref<AdminAssetItem[]>([]);
const detailRow = ref<AdminAssetItem | null>(null);
const mediaPreview = ref({
  name: '',
  src: '',
  type: 'unknown' as MediaType,
});
const filters = ref({
  keyword: '',
  projectId: '',
  scope: '',
  state: '',
  type: '',
  userId: '',
});
const pagination = ref({
  current: 1,
  pageSize: 20,
  showJumper: true,
  total: 0,
});
const statistics = ref({
  childAssets: 0,
  failed: 0,
  generated: 0,
  running: 0,
  total: 0,
  withPrompt: 0,
});
const options = ref<AdminAssetOptions>({
  projects: [],
  states: [],
  types: [],
  users: [],
});
const editForm = ref({
  describe: '',
  id: '',
  name: '',
  prompt: '',
  remark: '',
});

const columns = [
  { align: 'center', colKey: 'row-select', fixed: 'left', type: 'multiple', width: 48 },
  { align: 'center', cell: 'preview', colKey: 'previewUrl', fixed: 'left', title: '预览', width: 104 },
  { cell: 'asset', colKey: 'name', fixed: 'left', title: '资产', width: 240 },
  { cell: 'project', colKey: 'projectName', title: '项目 / 用户', width: 240 },
  { cell: 'state', colKey: 'imageState', title: '生成状态', width: 130 },
  { cell: 'prompt', colKey: 'prompt', ellipsis: true, title: '提示词', width: 260 },
  { cell: 'describe', colKey: 'describe', ellipsis: true, title: '描述', minWidth: 260 },
  { cell: 'startTime', colKey: 'startTime', title: '创建时间', width: 190 },
  { align: 'center', cell: 'operation', colKey: 'operation', fixed: 'right', title: '操作', width: 180 },
];

const typeOptions = computed(() => [
  { label: '全部类型', value: '' },
  ...options.value.types,
]);
const stateOptions = computed(() => [
  { label: '全部状态', value: '' },
  ...options.value.states,
]);
const projectOptions = computed(() => [
  { label: '全部项目', value: '' },
  ...options.value.projects,
]);
const userOptions = computed(() => [
  { label: '全部用户', value: '' },
  ...options.value.users,
]);
const scopeOptions = [
  { label: '全部层级', value: '' },
  { label: '主资产', value: 'parent' },
  { label: '衍生 / 子资产', value: 'child' },
];

const metricCards = computed(() => [
  {
    desc: `含子资产 ${formatInt(statistics.value.childAssets)}`,
    icon: 'folder',
    label: '筛选资产',
    theme: 'primary',
    value: formatInt(statistics.value.total),
  },
  {
    desc: '已绑定可预览文件',
    icon: 'image',
    label: '已生成',
    theme: 'success',
    value: formatInt(statistics.value.generated),
  },
  {
    desc: '图片或提示词仍在处理',
    icon: 'loading',
    label: '生成中',
    theme: 'warning',
    value: formatInt(statistics.value.running),
  },
  {
    desc: '需要排查生成链路',
    icon: 'error-circle',
    label: '失败',
    theme: 'danger',
    value: formatInt(statistics.value.failed),
  },
  {
    desc: '可用于重新生成',
    icon: 'file-copy',
    label: '有提示词',
    theme: 'primary',
    value: formatInt(statistics.value.withPrompt),
  },
]);

function compactParams() {
  return {
    keyword: filters.value.keyword.trim() || undefined,
    page: pagination.value.current,
    pageSize: pagination.value.pageSize,
    projectId: filters.value.projectId || undefined,
    scope: filters.value.scope || undefined,
    state: filters.value.state || undefined,
    type: filters.value.type || undefined,
    userId: filters.value.userId || undefined,
  };
}

async function loadOptions() {
  options.value = await fetchAdminAssetOptions();
}

async function loadAssets() {
  loading.value = true;
  try {
    const res = await fetchAdminAssets(compactParams());
    rows.value = res.list;
    statistics.value = res.statistics;
    pagination.value.total = res.total;
  } finally {
    loading.value = false;
  }
}

async function refresh() {
  await loadAssets();
}

async function search() {
  pagination.value.current = 1;
  selectedRowKeys.value = [];
  await loadAssets();
}

function resetFilters() {
  filters.value = {
    keyword: '',
    projectId: '',
    scope: '',
    state: '',
    type: '',
    userId: '',
  };
  void search();
}

function handlePageChange(pageInfo: { current: number; pageSize: number }) {
  pagination.value.current = pageInfo.current;
  pagination.value.pageSize = pageInfo.pageSize;
  void loadAssets();
}

function handleSelectChange(value: Array<number | string>) {
  selectedRowKeys.value = value;
}

function textOrDash(value: null | number | string | undefined) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function assetState(row: AdminAssetItem) {
  return row.imageState || row.promptState || (row.filePath ? '已完成' : '未生成');
}

function stateTheme(state: string) {
  if (state === '已完成') return 'success';
  if (state === '生成中') return 'warning';
  if (state === '生成失败') return 'danger';
  return 'default';
}

function metricTheme(theme: string) {
  if (theme === 'success') return 'bg-green-500/10 text-green-600';
  if (theme === 'warning') return 'bg-amber-500/10 text-amber-600';
  if (theme === 'danger') return 'bg-red-500/10 text-red-600';
  return 'bg-sky-500/10 text-sky-600';
}

function getMediaType(row: AdminAssetItem): MediaType {
  if (!row.src && !row.previewUrl) return 'unknown';
  if (['role', 'scene', 'tool'].includes(row.type)) return 'image';
  if (row.fileType === 'audio' || row.type === 'audio') return 'audio';
  if (row.fileType === 'video') return 'video';

  const src = row.src || row.previewUrl;
  const ext = src.split('?')[0]?.split('.').pop()?.toLowerCase() || '';
  if (['bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'].includes(ext)) return 'image';
  if (['avi', 'mkv', 'mov', 'mp4', 'ogg', 'webm'].includes(ext)) return 'video';
  if (['aac', 'flac', 'm4a', 'mp3', 'ogg', 'wav'].includes(ext)) return 'audio';
  return 'unknown';
}

function openMediaPreview(row: AdminAssetItem) {
  const type = getMediaType(row);
  if (!row.src || type === 'image' || type === 'unknown') return;
  mediaPreview.value = {
    name: row.name,
    src: row.src,
    type,
  };
  mediaPreviewVisible.value = true;
}

function openDetail(row: AdminAssetItem) {
  detailRow.value = row;
  detailVisible.value = true;
}

function openEdit(row: AdminAssetItem) {
  editForm.value = {
    describe: row.describe,
    id: String(row.id),
    name: row.name,
    prompt: row.prompt,
    remark: row.remark,
  };
  editVisible.value = true;
}

async function submitEdit() {
  if (!editForm.value.name.trim()) {
    MessagePlugin.warning('请输入资产名称');
    return;
  }

  saving.value = true;
  try {
    await updateAdminAsset({
      describe: editForm.value.describe,
      id: editForm.value.id,
      name: editForm.value.name.trim(),
      prompt: editForm.value.prompt,
      remark: editForm.value.remark,
    });
    MessagePlugin.success('资产已更新');
    editVisible.value = false;
    await loadAssets();
  } finally {
    saving.value = false;
  }
}

function confirmDelete(row: AdminAssetItem) {
  const dialog = DialogPlugin.confirm({
    body: `删除资产「${row.name || row.id}」会同步删除其子资产、图片/音频记录和关联关系。`,
    cancelBtn: '取消',
    confirmBtn: { content: '删除', theme: 'danger' },
    header: '删除资产',
    onCancel: () => dialog.hide(),
    onConfirm: async () => {
      await deleteAdminAsset(row.id);
      MessagePlugin.success('资产已删除');
      selectedRowKeys.value = selectedRowKeys.value.filter((id) => id !== row.id);
      dialog.hide();
      await loadAssets();
    },
  });
}

function confirmBatchDelete() {
  if (!selectedRowKeys.value.length) {
    MessagePlugin.warning('请选择要删除的资产');
    return;
  }

  const dialog = DialogPlugin.confirm({
    body: `将删除 ${selectedRowKeys.value.length} 个选中资产，并同步清理其子资产、媒体记录和关联关系。`,
    cancelBtn: '取消',
    confirmBtn: { content: '批量删除', theme: 'danger' },
    header: '批量删除资产',
    onCancel: () => dialog.hide(),
    onConfirm: async () => {
      await batchDeleteAdminAssets(selectedRowKeys.value);
      MessagePlugin.success('资产已批量删除');
      selectedRowKeys.value = [];
      dialog.hide();
      await loadAssets();
    },
  });
}

onMounted(async () => {
  await loadOptions();
  await loadAssets();
});
</script>

<template>
  <Page auto-content-height title="资产管理">
    <template #description>
      <div class="mt-2 text-foreground/70">
        统一管理 Web 项目中的角色、场景、道具、素材和音频资产。
      </div>
    </template>
    <template #extra>
      <t-space>
        <t-button theme="default" variant="outline" @click="refresh">
          <template #icon><t-icon name="refresh" /></template>
          刷新
        </t-button>
        <t-button theme="danger" :disabled="!selectedRowKeys.length" @click="confirmBatchDelete">
          <template #icon><t-icon name="delete" /></template>
          批量删除
        </t-button>
      </t-space>
    </template>

    <div class="mb-5 grid grid-cols-1 gap-4 md:grid-cols-5">
      <div
        v-for="item in metricCards"
        :key="item.label"
        class="rounded-lg border border-border bg-card px-5 py-4">
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm text-foreground/60">{{ item.label }}</div>
          <span class="inline-flex size-8 items-center justify-center rounded-md" :class="metricTheme(item.theme)">
            <t-icon :name="item.icon" />
          </span>
        </div>
        <div class="mt-2 truncate text-2xl font-semibold">{{ item.value }}</div>
        <div class="mt-1 truncate text-xs text-foreground/50">{{ item.desc }}</div>
      </div>
    </div>

    <div class="mb-4 rounded-lg border border-border bg-card p-4">
      <div class="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_repeat(5,1fr)_auto]">
        <t-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索资产、提示词、项目、用户或 ID"
          @enter="search">
          <template #prefix-icon><t-icon name="search" /></template>
        </t-input>
        <t-select v-model="filters.type" :options="typeOptions" filterable />
        <t-select v-model="filters.state" :options="stateOptions" filterable />
        <t-select v-model="filters.projectId" :options="projectOptions" filterable />
        <t-select v-model="filters.userId" :options="userOptions" filterable />
        <t-select v-model="filters.scope" :options="scopeOptions" />
        <t-space>
          <t-button theme="primary" @click="search">查询</t-button>
          <t-button variant="outline" @click="resetFilters">重置</t-button>
        </t-space>
      </div>
    </div>

    <t-table
      row-key="id"
      hover
      stripe
      size="small"
      table-layout="fixed"
      :columns="columns"
      :data="rows"
      :loading="loading"
      :pagination="pagination"
      :selected-row-keys="selectedRowKeys"
      @page-change="handlePageChange"
      @select-change="handleSelectChange">
      <template #preview="{ row }">
        <div class="preview-cell">
          <t-image-viewer
            v-if="getMediaType(row) === 'image' && (row.src || row.previewUrl)"
            :images="[row.src || row.previewUrl]"
            :close-on-esc-keydown="true"
            :close-on-overlay="true">
            <template #trigger="{ open }">
              <button class="preview-trigger" type="button" @click="open">
                <img :src="row.previewUrl || row.src" :alt="row.name" />
                <span class="preview-overlay">
                  <t-icon name="browse" />
                </span>
              </button>
            </template>
          </t-image-viewer>
          <button
            v-else-if="getMediaType(row) === 'video'"
            class="preview-trigger media-preview"
            type="button"
            @click="openMediaPreview(row)">
            <video :src="row.src" />
            <span class="preview-overlay">
              <t-icon name="play-circle" />
            </span>
          </button>
          <button
            v-else-if="getMediaType(row) === 'audio'"
            class="preview-trigger audio-preview"
            type="button"
            @click="openMediaPreview(row)">
            <t-icon name="music" size="26px" />
            <span class="preview-overlay">
              <t-icon name="play-circle" />
            </span>
          </button>
          <div v-else class="preview-trigger empty-preview">
            <t-icon name="image" size="24px" />
          </div>
        </div>
      </template>

      <template #asset="{ row }">
        <div class="min-w-0 text-left">
          <div class="flex min-w-0 items-center gap-2">
            <span class="truncate font-medium">{{ textOrDash(row.name) }}</span>
            <t-tag size="small" variant="light">{{ row.typeLabel }}</t-tag>
          </div>
          <div class="mt-1 truncate text-xs text-foreground/60">
            ID {{ row.id }}
            <span v-if="row.parentName"> / {{ row.parentName }}</span>
          </div>
        </div>
      </template>

      <template #project="{ row }">
        <div class="min-w-0 text-left">
          <div class="truncate">{{ textOrDash(row.projectName) }}</div>
          <div class="mt-1 truncate text-xs text-foreground/60">
            {{ textOrDash(row.userName || row.username) }}
          </div>
        </div>
      </template>

      <template #state="{ row }">
        <t-space direction="vertical" :size="4">
          <t-tag :theme="stateTheme(assetState(row))" variant="light">
            {{ assetState(row) }}
          </t-tag>
          <span v-if="row.promptState" class="text-xs text-foreground/60">
            提示词 {{ row.promptState }}
          </span>
        </t-space>
      </template>

      <template #prompt="{ row }">
        <span class="line-clamp-2 text-left text-xs leading-5">{{ textOrDash(row.prompt) }}</span>
      </template>

      <template #describe="{ row }">
        <span class="line-clamp-2 text-left text-xs leading-5">{{ textOrDash(row.describe) }}</span>
      </template>

      <template #startTime="{ row }">
        <span>{{ formatDateTime(row.startTime) }}</span>
      </template>

      <template #operation="{ row }">
        <t-space :size="0">
          <t-button variant="text" theme="primary" @click="openDetail(row)">详情</t-button>
          <t-button variant="text" theme="primary" @click="openEdit(row)">编辑</t-button>
          <t-button variant="text" theme="danger" @click="confirmDelete(row)">删除</t-button>
        </t-space>
      </template>
    </t-table>

    <t-dialog
      v-model:visible="editVisible"
      header="编辑资产"
      placement="center"
      width="640px"
      :confirm-btn="{ content: '保存', loading: saving }"
      @confirm="submitEdit">
      <t-form label-align="top">
        <t-form-item label="资产名称">
          <t-input v-model="editForm.name" clearable placeholder="请输入资产名称" />
        </t-form-item>
        <t-form-item label="描述">
          <t-textarea
            v-model="editForm.describe"
            :autosize="{ minRows: 3, maxRows: 5 }"
            placeholder="请输入资产描述" />
        </t-form-item>
        <t-form-item label="提示词">
          <t-textarea
            v-model="editForm.prompt"
            :autosize="{ minRows: 4, maxRows: 8 }"
            placeholder="请输入生成提示词" />
        </t-form-item>
        <t-form-item label="备注">
          <t-textarea
            v-model="editForm.remark"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="请输入备注" />
        </t-form-item>
      </t-form>
    </t-dialog>

    <t-drawer
      v-model:visible="detailVisible"
      :header="detailRow?.name || '资产详情'"
      size="520px"
      :footer="false">
      <template v-if="detailRow">
        <div class="space-y-5">
          <div class="detail-preview">
            <img
              v-if="getMediaType(detailRow) === 'image' && (detailRow.src || detailRow.previewUrl)"
              :src="detailRow.src || detailRow.previewUrl"
              :alt="detailRow.name" />
            <video
              v-else-if="getMediaType(detailRow) === 'video'"
              :src="detailRow.src"
              controls />
            <audio
              v-else-if="getMediaType(detailRow) === 'audio'"
              :src="detailRow.src"
              controls />
            <div v-else class="detail-empty">
              <t-icon name="image" size="32px" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div class="detail-label">资产 ID</div>
              <div>{{ detailRow.id }}</div>
            </div>
            <div>
              <div class="detail-label">类型</div>
              <div>{{ detailRow.typeLabel }}</div>
            </div>
            <div>
              <div class="detail-label">项目</div>
              <div>{{ textOrDash(detailRow.projectName) }}</div>
            </div>
            <div>
              <div class="detail-label">用户</div>
              <div>{{ textOrDash(detailRow.userName || detailRow.username) }}</div>
            </div>
            <div>
              <div class="detail-label">生成状态</div>
              <div>{{ assetState(detailRow) }}</div>
            </div>
            <div>
              <div class="detail-label">创建时间</div>
              <div>{{ formatDateTime(detailRow.startTime) }}</div>
            </div>
          </div>

          <div>
            <div class="detail-label">描述</div>
            <p class="detail-text">{{ textOrDash(detailRow.describe) }}</p>
          </div>
          <div>
            <div class="detail-label">提示词</div>
            <p class="detail-text">{{ textOrDash(detailRow.prompt) }}</p>
          </div>
          <div>
            <div class="detail-label">备注</div>
            <p class="detail-text">{{ textOrDash(detailRow.remark) }}</p>
          </div>
          <div v-if="detailRow.imageErrorReason || detailRow.promptErrorReason">
            <div class="detail-label">错误信息</div>
            <p class="detail-text text-red-600">
              {{ detailRow.imageErrorReason || detailRow.promptErrorReason }}
            </p>
          </div>
        </div>
      </template>
    </t-drawer>

    <t-dialog
      v-model:visible="mediaPreviewVisible"
      :header="mediaPreview.name || '媒体预览'"
      :footer="false"
      width="680px"
      placement="center">
      <div class="media-dialog">
        <video
          v-if="mediaPreview.type === 'video'"
          :src="mediaPreview.src"
          controls
          autoplay />
        <audio
          v-else-if="mediaPreview.type === 'audio'"
          :src="mediaPreview.src"
          controls
          autoplay />
      </div>
    </t-dialog>
  </Page>
</template>

<style scoped>
.preview-cell {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

.preview-trigger {
  position: relative;
  display: flex;
  width: 72px;
  height: 72px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 6px;
  background: var(--td-bg-color-secondarycontainer);
  color: var(--td-text-color-secondary);
}

button.preview-trigger {
  cursor: pointer;
}

.preview-trigger img,
.preview-trigger video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 55%);
  color: #fff;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.preview-trigger:hover .preview-overlay {
  opacity: 1;
}

.audio-preview {
  color: var(--td-brand-color);
}

.empty-preview {
  cursor: default;
}

.detail-preview {
  display: flex;
  min-height: 220px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  background: var(--td-bg-color-secondarycontainer);
}

.detail-preview img,
.detail-preview video {
  max-width: 100%;
  max-height: 420px;
  object-fit: contain;
}

.detail-preview audio {
  width: min(100%, 420px);
}

.detail-empty {
  display: flex;
  height: 220px;
  align-items: center;
  justify-content: center;
  color: var(--td-text-color-placeholder);
}

.detail-label {
  margin-bottom: 6px;
  color: var(--td-text-color-secondary);
  font-size: 12px;
}

.detail-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
}

.media-dialog {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0 16px;
}

.media-dialog video {
  width: 100%;
  max-height: 66vh;
  border-radius: 8px;
  background: #000;
}

.media-dialog audio {
  width: min(100%, 520px);
}
</style>
