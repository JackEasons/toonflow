<template>
  <div class="fileManagement">
    <header class="fileHeader">
      <div class="pathInfo">
        <div class="pathTitle">
          <t-icon name="folder-open" />
          <span>{{ activePathText }}</span>
        </div>
        <t-breadcrumb max-item-width="220">
          <t-breadcrumb-item v-for="item in breadcrumbItems" :key="item.path || 'root'" @click="navigateTo(item.path)">
            {{ item.label }}
          </t-breadcrumb-item>
        </t-breadcrumb>
      </div>

      <div class="toolbar">
        <t-input v-model="keyword" clearable :placeholder="$t('settings.file.searchPlaceholder')" class="searchInput">
          <template #prefix-icon>
            <t-icon name="search" />
          </template>
        </t-input>
        <t-button variant="outline" @click="fetchList()">
          <template #icon>
            <t-icon name="refresh" />
          </template>
          {{ $t("settings.file.refresh") }}
        </t-button>
        <t-button variant="outline" @click="openCreateDialog('folder')">
          <template #icon>
            <t-icon name="folder-add" />
          </template>
          {{ $t("settings.file.newFolder") }}
        </t-button>
        <t-button theme="primary" variant="outline" @click="openCreateDialog('file')">
          <template #icon>
            <t-icon name="file-add" />
          </template>
          {{ $t("settings.file.newFile") }}
        </t-button>
        <t-button theme="primary" @click="triggerUpload">
          <template #icon>
            <t-icon name="upload" />
          </template>
          {{ $t("settings.file.upload") }}
        </t-button>
        <input ref="uploadInputRef" type="file" multiple class="hiddenInput" @change="handleUpload" />
      </div>
    </header>

    <div class="managerLayout">
      <aside class="quickPanel">
        <div class="panelTitle">{{ $t("settings.file.quickPath") }}</div>
        <button
          v-for="item in folderList"
          :key="item.path || 'data'"
          class="quickPath"
          :class="{ active: currentPath === item.path }"
          type="button"
          @click="navigateTo(item.path)">
          <t-icon name="folder" />
          <span class="quickName">{{ $t(item.label) }}</span>
          <span class="quickDesc">{{ $t(item.desc) }}</span>
        </button>

        <t-button v-if="isElectron" block variant="outline" @click="handleOpenFolder(currentPath)">
          <template #icon>
            <t-icon name="folder-open" />
          </template>
          {{ $t("settings.file.openLocal") }}
        </t-button>
      </aside>

      <section class="filePanel">
        <div class="tableHeader">
          <t-button :disabled="!currentPath" variant="text" @click="navigateUp">
            <template #icon>
              <t-icon name="chevron-left" />
            </template>
            {{ $t("settings.file.parentFolder") }}
          </t-button>
          <span>{{ $t("settings.file.itemCount", { count: filteredEntries.length }) }}</span>
        </div>

        <t-table
          row-key="path"
          size="small"
          hover
          max-height="calc(100vh - 292px)"
          :loading="loading"
          :data="filteredEntries"
          :columns="columns"
          :pagination="null"
          class="fileTable">
          <template #type="{ row }">
            <t-tag :theme="row.type === 'directory' ? 'primary' : 'default'" variant="light">
              {{ row.type === "directory" ? $t("settings.file.directory") : $t("settings.file.fileType") }}
            </t-tag>
          </template>

          <template #name="{ row }">
            <button class="nameButton" type="button" @click="row.type === 'directory' ? navigateTo(row.path) : downloadEntry(row)">
              <t-icon :name="row.type === 'directory' ? 'folder-open' : 'file'" />
              <span>{{ row.name }}</span>
              <t-tag v-if="row.isSymlink" size="small" theme="warning" variant="light">link</t-tag>
            </button>
          </template>

          <template #size="{ row }">
            {{ formatSize(row.size) }}
          </template>

          <template #modifiedAt="{ row }">
            {{ formatDate(row.modifiedAt) }}
          </template>

          <template #operation="{ row }">
            <t-space :size="0" break-line>
              <t-button v-if="row.type === 'directory'" theme="primary" variant="text" @click="navigateTo(row.path)">
                {{ $t("settings.file.enter") }}
              </t-button>
              <t-button v-if="row.type === 'file'" variant="text" @click="downloadEntry(row)">
                {{ $t("settings.file.download") }}
              </t-button>
            </t-space>
          </template>

          <template #empty>
            <t-empty :description="$t('settings.file.empty')" />
          </template>
        </t-table>
      </section>
    </div>

    <t-dialog
      v-model:visible="createVisible"
      :header="createType === 'folder' ? $t('settings.file.createFolderTitle') : $t('settings.file.createFileTitle')"
      :confirm-btn="{ content: $t('common.save'), loading: createSaving }"
      :close-on-overlay-click="false"
      @confirm="submitCreate">
      <t-form label-align="top">
        <t-form-item :label="$t('settings.file.createName')">
          <t-input v-model="createName" autofocus :placeholder="$t('settings.file.createNamePlaceholder')" />
        </t-form-item>
        <t-form-item v-if="createType === 'file'" :label="$t('settings.file.fileContent')">
          <t-textarea v-model="createContent" :autosize="{ minRows: 8, maxRows: 14 }" />
        </t-form-item>
      </t-form>
    </t-dialog>

  </div>
</template>

<script setup lang="ts">
// -nocheck
import { storeToRefs } from "pinia";
import { computed, onMounted, ref } from "vue";
import type { TableProps } from "tdesign-vue-next";
import { LoadingPlugin } from "tdesign-vue-next";

import settingStore from "#/stores/setting";
import axios from "#/utils/axios";

const { isElectron } = storeToRefs(settingStore());

type EntryType = "directory" | "file";
type CreateType = "folder" | "file";

type FileEntry = {
  editable: boolean;
  extension: string;
  isSymlink: boolean;
  modifiedAt: string;
  name: string;
  path: string;
  size: number | null;
  type: EntryType;
};

type QuickPathItem = {
  desc: string;
  label: string;
  path: string;
};

const folderList: QuickPathItem[] = [
  { label: "settings.file.folders.data", path: "", desc: "settings.file.folders.dataDesc" },
  { label: "settings.file.folders.logs", path: "logs", desc: "settings.file.folders.logsDesc" },
  { label: "settings.file.folders.oss", path: "oss", desc: "settings.file.folders.ossDesc" },
  { label: "settings.file.folders.skills", path: "skills", desc: "settings.file.folders.skillsDesc" },
  { label: "settings.file.folders.models", path: "models", desc: "settings.file.folders.modelsDesc" },
  { label: "settings.file.folders.web", path: "web", desc: "settings.file.folders.webDesc" },
  { label: "settings.file.folders.serve", path: "serve", desc: "settings.file.folders.serveDesc" },
  { label: "settings.file.folders.vendor", path: "vendor", desc: "settings.file.folders.vendorDesc" },
];

const currentPath = ref("");
const entries = ref<FileEntry[]>([]);
const keyword = ref("");
const loading = ref(false);
const uploadInputRef = ref<HTMLInputElement | null>(null);

const createVisible = ref(false);
const createSaving = ref(false);
const createType = ref<CreateType>("folder");
const createName = ref("");
const createContent = ref("");

const activePathText = computed(() => (currentPath.value ? `data/${currentPath.value}` : "data"));

const breadcrumbItems = computed(() => {
  const items = [{ label: "data", path: "" }];
  const parts = currentPath.value.split("/").filter(Boolean);
  let acc = "";
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    items.push({ label: part, path: acc });
  }
  return items;
});

const filteredEntries = computed(() => {
  if (!keyword.value.trim()) return entries.value;
  const needle = keyword.value.trim().toLowerCase();
  return entries.value.filter((entry) => entry.name.toLowerCase().includes(needle) || entry.path.toLowerCase().includes(needle));
});

const columns = computed<TableProps["columns"]>(() => [
  { colKey: "name", title: $t("settings.file.name"), minWidth: 260 },
  { colKey: "type", title: $t("settings.file.type"), width: 92 },
  { colKey: "size", title: $t("settings.file.size"), width: 112 },
  { colKey: "modifiedAt", title: $t("settings.file.modifiedAt"), width: 180 },
  { colKey: "operation", title: $t("settings.file.actions"), width: 120, fixed: "right" },
]);

function getErrorMessage(err: any, fallback: string) {
  return err?.message || err?.msg || fallback;
}

async function fetchList(path = currentPath.value) {
  loading.value = true;
  try {
    const { data } = await axios.post("/setting/fileManagement/list", { path });
    currentPath.value = path;
    entries.value = Array.isArray(data) ? data : [];
  } catch (err) {
    window.$message.error(getErrorMessage(err, $t("settings.file.msg.loadFailed")));
  } finally {
    loading.value = false;
  }
}

function navigateTo(path: string) {
  keyword.value = "";
  fetchList(path);
}

function navigateUp() {
  if (!currentPath.value) return;
  const parent = currentPath.value.split("/").filter(Boolean).slice(0, -1).join("/");
  navigateTo(parent);
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatSize(value: number | null) {
  if (value == null) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function openCreateDialog(type: CreateType) {
  createType.value = type;
  createName.value = "";
  createContent.value = "";
  createVisible.value = true;
}

async function submitCreate() {
  const name = createName.value.trim();
  if (!name) {
    window.$message.warning($t("settings.file.msg.nameRequired"));
    return;
  }

  createSaving.value = true;
  try {
    const endpoint = createType.value === "folder" ? "createFolder" : "createFile";
    await axios.post(`/setting/fileManagement/${endpoint}`, {
      content: createContent.value,
      currentPath: currentPath.value,
      name,
    });
    createVisible.value = false;
    window.$message.success($t("settings.file.msg.createSuccess"));
    await fetchList();
  } catch (err) {
    window.$message.error(getErrorMessage(err, $t("settings.file.msg.createFailed")));
  } finally {
    createSaving.value = false;
  }
}

function triggerUpload() {
  uploadInputRef.value?.click();
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.readAsDataURL(file);
  });
}

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  if (!files.length) return;

  LoadingPlugin(true);
  try {
    for (const file of files) {
      const contentBase64 = await readFileAsBase64(file);
      await axios.post("/setting/fileManagement/upload", {
        contentBase64,
        currentPath: currentPath.value,
        filename: file.name,
      });
    }
    window.$message.success($t("settings.file.msg.uploadSuccess", { count: files.length }));
    await fetchList();
  } catch (err) {
    window.$message.error(getErrorMessage(err, $t("settings.file.msg.uploadFailed")));
  } finally {
    input.value = "";
    LoadingPlugin(false);
  }
}

async function downloadEntry(row: FileEntry) {
  try {
    const blob = await axios.post("/setting/fileManagement/download", { path: row.path }, { responseType: "blob" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = row.name;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  } catch (err) {
    window.$message.error(getErrorMessage(err, $t("settings.file.msg.downloadFailed")));
  }
}

const handleOpenFolder = (path: string) => {
  axios.post("/setting/fileManagement/openFolder", { path }).catch((err) => {
    window.$message?.error(getErrorMessage(err, $t("settings.file.openFailed")));
  });
};

onMounted(() => fetchList(""));
</script>

<style lang="scss" scoped>
.fileManagement {
  --file-hover-bg: linear-gradient(90deg, var(--ds-settings-accent-soft), var(--ds-settings-blue-soft)), var(--ds-settings-panel-soft);
  --file-active-bg: linear-gradient(90deg, rgba(98, 216, 202, 0.18), rgba(111, 157, 255, 0.12)), var(--ds-settings-panel-soft);

  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 16px;
}

.fileHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px;
  border: 1px solid var(--td-component-stroke);
  border-radius: 8px;
}

.pathInfo {
  min-width: 0;
}

.pathTitle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--td-text-color-primary);

  span {
    word-break: break-all;
  }
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.searchInput {
  width: 220px;
}

.hiddenInput {
  display: none;
}

.managerLayout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.quickPanel,
.filePanel {
  min-height: 0;
  border: 1px solid var(--td-component-stroke);
  border-radius: 8px;
}

.quickPanel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  overflow: auto;
}

.panelTitle {
  padding: 2px 4px 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.quickPath {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 2px 8px;
  width: 100%;
  padding: 10px;
  text-align: left;
  color: var(--td-text-color-primary);
  background: var(--ds-settings-folder-bg);
  border: 1px solid var(--td-component-border);
  border-radius: 8px;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;

  .t-icon {
    grid-row: span 2;
    margin-top: 2px;
    color: var(--ds-settings-text);
  }

  &.active,
  &:hover {
    border-color: var(--td-brand-color);
    background: var(--file-hover-bg);
    color: var(--ds-settings-text);
  }

  &.active {
    background: var(--file-active-bg);
  }
}

.quickName {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  color: var(--ds-settings-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quickDesc {
  overflow: hidden;
  font-size: 12px;
  color: var(--td-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quickPath.active .quickDesc,
.quickPath:hover .quickDesc {
  color: var(--ds-settings-muted);
}

.filePanel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tableHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: 0 12px;
  border-bottom: 1px solid var(--td-component-stroke);
  color: var(--td-text-color-secondary);
}

.fileTable {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.fileTable :deep(.t-table__content) {
  overflow: auto;
}

.fileTable :deep(.t-table__body tr:hover),
.fileTable :deep(.t-table__body tr:hover > td),
.fileTable :deep(.t-table__body tr.t-table__row--hover),
.fileTable :deep(.t-table__body tr.t-table__row--hover > td) {
  background: var(--file-hover-bg) !important;
  color: var(--ds-settings-text) !important;
}

.fileTable :deep(.t-table__body tr:hover .t-button--variant-text),
.fileTable :deep(.t-table__body tr.t-table__row--hover .t-button--variant-text),
.fileTable :deep(.t-table__body tr:hover .nameButton),
.fileTable :deep(.t-table__body tr.t-table__row--hover .nameButton) {
  color: var(--ds-settings-text) !important;
}

.nameButton {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  gap: 8px;
  padding: 0;
  color: var(--td-text-color-primary);
  background: transparent;
  border: 0;
  cursor: pointer;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@media (max-width: 1100px) {
  .fileHeader {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar {
    justify-content: flex-start;
  }

  .managerLayout {
    grid-template-columns: 1fr;
  }

  .quickPanel {
    max-height: 220px;
  }

  .fileTable {
    max-height: calc(100vh - 430px);
  }
}
</style>
