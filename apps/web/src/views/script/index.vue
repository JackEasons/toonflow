<template>
  <div class="script">
    <div class="actionBar">
      <div class="actionBar-left f ac">
        <t-input :placeholder="$t('workbench.script.searchPlaceholder')" v-model="searchQuery" class="searchInput" clearable style="width: 300px" />
        <t-button theme="primary" @click="onChange">
          <template #icon><i-search /></template>
          {{ $t("workbench.script.search") }}
        </t-button>
        <t-button theme="primary" @click="handleAddScript">
          <template #icon><i-plus /></template>
          {{ $t("workbench.script.addScript") }}
        </t-button>
        <t-button theme="primary" @click="handleBatchAddScript">
          <template #icon><i-plus /></template>
          {{ $t("workbench.script.batchAddScript") }}
        </t-button>
      </div>
      <div class="actionBar-right f ac" v-if="scripts.length">
        <t-button :theme="isAllSelected ? 'default' : 'primary'" variant="outline" @click="toggleSelectAll(!isAllSelected)">
          {{ isAllSelected ? $t("workbench.script.cancelSelectAll") : $t("workbench.script.selectAll") }}
        </t-button>
        <t-button theme="primary" @click="handleExportScript" :disabled="selectedIds.length === 0">
          <template #icon><i-export /></template>
          {{ $t("workbench.script.exportScript") }}{{ selectedIds.length ? `(${selectedIds.length})` : "" }}
        </t-button>
        <t-button theme="primary" @click="handleExtractAssets" :loading="scriptLoad || extractQuoteLoading" :disabled="extractDisabled">
          <template #icon><i-export /></template>
          {{ extractAssetsLabel }}
        </t-button>
        <t-button theme="primary" @click="handleBatchDelete" :disabled="selectedIds.length === 0">
          <template #icon><i-delete /></template>
          {{ $t("workbench.script.deleteScript") }}{{ selectedIds.length ? `(${selectedIds.length})` : "" }}
        </t-button>
      </div>
    </div>
    <div class="contentArea">
      <div v-if="scripts.length === 0" class="emptyState">
        <t-empty />
      </div>
      <div v-else class="scriptsList f w">
        <div v-for="(item, index) in scripts" :key="index" @click="handleScriptClick(item)" class="scriptCard">
          <t-card shadow hover-shadow :style="{ width: '400px', cursor: 'pointer' }">
            <template #header>
              <div class="cardHeader">
                <span class="cardTitle">{{ item.name }}</span>
                <t-checkbox :checked="selectedIds.includes(item.id)" @click.stop @change="toggleSelect(item.id)" class="cardCheckbox" />
              </div>
            </template>
            <span class="content">{{ item.content }}</span>

            <t-loading v-if="item?.extractState == 0" :text="$t('workbench.script.msg.extracting')" size="small"></t-loading>
            <t-loading v-if="item?.extractState == 2" :text="$t('workbench.script.msg.waitExtract')" size="small"></t-loading>
            <t-tooltip :content="item.errorReason" v-if="item?.extractState == -1" theme="light">
              <t-tag theme="danger" size="small">{{ $t("workbench.script.msg.extractFailed") }}</t-tag>
            </t-tooltip>
            <div class="assetTags" v-else-if="item.relatedAssets?.length" @click.stop>
              <t-tag v-for="asset in item.relatedAssets" :key="asset.id" variant="light-outline" size="small">
                {{ asset.name }}
              </t-tag>
            </div>

            <div class="del">
              <i-delete theme="outline" size="18" @click.stop="handleDeleteScript(item.id)" style="cursor: pointer" />
            </div>
          </t-card>
        </div>
      </div>
    </div>
    <editScript v-model="detailsShow" :item="selectedScript" @searchScripts="searchScripts" />
    <addScript v-model="addScriptShow" @searchScripts="searchScripts" />
    <batchAddScript v-model="batchScriptShow" @select="searchScripts" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { DialogPlugin } from "tdesign-vue-next";
import { storeToRefs } from "pinia";
import axios from "#/utils/axios";
import editScript from "./components/editScript.vue";
import addScript from "./components/addScript.vue";
import batchAddScript from "./components/batchAddScript.vue";
import projectStore from "#/stores/project";
import settingStore from "#/stores/setting";
import imageListCacheStore from "#/stores/imageListCache";

const { clearScriptCache } = imageListCacheStore();

const { otherSetting } = storeToRefs(settingStore());
const { project } = storeToRefs(projectStore());
interface ScriptAsset {
  id: number;
  name: string;
  describe: string;
  prompt: string;
  type: "role" | "tool" | "scene" | "clip";
}
interface Script {
  id: number;
  name: string;
  content: string;
  createTime?: number;
  extractState?: -1 | 0 | 1 | 2; // -1 失败 0 正在提取 1 成功 等待提取
  errorReason?: string;
  relatedAssets?: ScriptAsset[];
}
type BillingQuote = {
  availablePoints: number;
  enough: boolean;
  requiredPoints: number;
};
const scripts = ref<Script[]>([]);
const searchQuery = ref("");
const addScriptShow = ref(false);
const selectedIds = ref<number[]>([]);
const scriptLoad = ref(false);
const batchScriptShow = ref(false);
const isAllSelected = computed(() => scripts.value.length > 0 && selectedIds.value.length === scripts.value.length);
const extractQuote = ref<BillingQuote | null>(null);
const extractQuoteError = ref("");
const extractQuoteLoading = ref(false);
let extractQuoteSeq = 0;

function formatBillingPoints(value?: number) {
  const points = Math.max(0, Number(value || 0));
  return Number.isInteger(points) ? String(points) : points.toFixed(2);
}

function getBillingErrorMessage(error: unknown) {
  return (error as any)?.message || "获取积分报价失败";
}

const extractQuoteCount = computed(() => {
  if (!selectedIds.value.length) return 0;
  const groupSize = Math.max(1, Math.floor(Number(otherSetting.value.assetsBatchGenereateSize || 5)));
  const scriptChunkCount = Math.ceil(selectedIds.value.length / 5);
  return Math.ceil(scriptChunkCount / groupSize);
});

const extractAssetsLabel = computed(() => {
  const base = `${$t("workbench.script.extractAssets")}${selectedIds.value.length ? `(${selectedIds.value.length})` : ""}`;
  if (!selectedIds.value.length) return base;
  if (extractQuoteError.value) return `${base} · 报价不可用`;
  const points = extractQuote.value?.requiredPoints || 0;
  return points > 0 ? `${base} · ${formatBillingPoints(points)}积分` : base;
});

const extractDisabled = computed(() => {
  return (
    selectedIds.value.length === 0 ||
    scriptLoad.value ||
    extractQuoteLoading.value ||
    Boolean(extractQuoteError.value) ||
    Boolean(extractQuote.value && !extractQuote.value.enough)
  );
});

async function refreshExtractQuote() {
  const count = extractQuoteCount.value;
  if (count <= 0) {
    extractQuote.value = null;
    extractQuoteError.value = "";
    return;
  }
  const seq = ++extractQuoteSeq;
  extractQuoteLoading.value = true;
  try {
    const { data } = await axios.post("/billing/quote", {
      calls: [
        {
          count,
          model: "universalAi",
          modelType: "text",
          taskType: "script_asset_extraction",
        },
      ],
    });
    if (seq === extractQuoteSeq) {
      extractQuote.value = data;
      extractQuoteError.value = "";
    }
  } catch (error) {
    if (seq === extractQuoteSeq) {
      extractQuote.value = null;
      extractQuoteError.value = getBillingErrorMessage(error);
    }
  } finally {
    if (seq === extractQuoteSeq) extractQuoteLoading.value = false;
  }
}

function toggleSelect(id: number) {
  const idx = selectedIds.value.indexOf(id);
  if (idx === -1) {
    selectedIds.value.push(id);
  } else {
    selectedIds.value.splice(idx, 1);
  }
}

function toggleSelectAll(checked: boolean) {
  if (checked) {
    selectedIds.value = scripts.value.map((s) => s.id);
  } else {
    selectedIds.value = [];
  }
}
// 搜索剧本
async function searchScripts() {
  try {
    const res = await axios.post("/script/getScrptApi", {
      projectId: project.value?.id,
      name: searchQuery.value,
    });
    scripts.value = res.data;
  } catch (error) {
    console.error("搜索剧本失败:", error);
    window.$message.error($t("workbench.script.msg.searchFailed"));
  }
}
onMounted(searchScripts);
// 搜索输入变化
function onChange() {
  searchScripts();
}
// 新增剧本
function handleAddScript() {
  addScriptShow.value = true;
}
function handleBatchAddScript() {
  batchScriptShow.value = true;
}
//导出剧本
async function handleExportScript() {
  if (!selectedIds.value.length) {
    window.$message.warning($t("workbench.script.msg.selectsExport"));
    return;
  }
  try {
    const res = await axios.post("/script/exportScript", { id: selectedIds.value }, { responseType: "blob" });
    const blob = new Blob([res as any], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `script_${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    window.$message.success($t("workbench.script.msg.exportSuccess"));
  } catch (error) {
    console.error("导出剧本失败:", error);
    window.$message.error((error as Error).message ?? $t("workbench.script.msg.exportFailed"));
  }
}
const selectedScript = ref<Script>({
  id: 0,
  name: "",
  content: "",
});
const detailsShow = ref(false);
// 点击剧本卡片
function handleScriptClick(item: Script) {
  selectedScript.value = { ...item };
  detailsShow.value = true;
}
// 删除剧本
async function handleDeleteScript(scriptId: number) {
  //判断是否有资产正在提取中
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.script.msg.deleteHeader"),
    body: $t("workbench.script.msg.deleteBody"),
    confirmBtn: $t("workbench.script.msg.deleteConfirm"),
    cancelBtn: $t("workbench.script.msg.cancel"),
    theme: "warning",
    onConfirm: async () => {
      try {
        await axios.post("/script/delScript", { ids: [scriptId] });
        window.$message.success($t("workbench.script.msg.deleteSuccess"));
        clearScriptCache(project.value!.id, scriptId);
        searchScripts();
        dialog.destroy();

        selectedIds.value = selectedIds.value.filter((i) => i !== scriptId);
      } catch (error) {
        console.error("删除剧本失败:", error);
        window.$message.error($t("workbench.script.msg.deleteFailed"));
        dialog.destroy();
      }
    },
    onClose: () => {
      dialog.destroy();
    },
  });
}
//提取资产
async function handleExtractAssets() {
  if (!project.value) return window.$message.error($t("workbench.script.msg.projectNotFound"));
  if (!extractQuote.value && !extractQuoteError.value) await refreshExtractQuote();
  if (extractQuoteError.value) return window.$message.error(extractQuoteError.value);
  if (extractQuote.value && !extractQuote.value.enough) {
    return window.$message.error(`积分不足，需要 ${extractQuote.value.requiredPoints} 积分，当前可用 ${extractQuote.value.availablePoints} 积分`);
  }
  //判断是否有资产正在提取中
  scriptLoad.value = true;
  try {
    await axios.post("/script/extractAssets", {
      scriptIds: selectedIds.value,
      projectId: project.value!.id,
      groupSize: otherSetting.value.assetsBatchGenereateSize,
    });
    searchScripts();
    selectedIds.value = [];
  } catch (e) {
    window.$message.error((e as any)?.message || $t("workbench.script.msg.extractFailed"));
  } finally {
    scriptLoad.value = false;
  }
}
//批量删除剧本
async function handleBatchDelete() {
  if (!selectedIds.value.length) {
    window.$message.warning($t("workbench.script.msg.selectDelScript"));
    return;
  }
  //判断是否有资产正在提取中
  const extractingIds = new Set(notCompletedData.value.map((s) => s.id));
  if (selectedIds.value.some((id) => extractingIds.has(id))) {
    return window.$message.error($t("workbench.script.msg.extractingInProgress"));
  }
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.script.msg.batchDeleteHeader"),
    body: $t("workbench.script.msg.batchDeleteBody", { count: selectedIds.value.length }),
    confirmBtn: $t("workbench.script.msg.deleteConfirm"),
    cancelBtn: $t("workbench.script.msg.cancel"),
    theme: "warning",
    onConfirm: async () => {
      try {
        await axios.post("/script/delScript", { ids: selectedIds.value });
        window.$message.success($t("workbench.script.msg.batchDeleteSuccess"));
        for (const item of selectedIds.value) {
          clearScriptCache(project.value!.id, item);
        }
        searchScripts();
        dialog.destroy();
      } catch (error) {
        console.error("删除剧本失败:", error);
        window.$message.error($t("workbench.script.msg.deleteFailed"));
        dialog.destroy();
      } finally {
        selectedIds.value = [];
      }
    },
    onClose: () => {
      dialog.destroy();
    },
  });
}

let pollingTimer: ReturnType<typeof setInterval> | null = null;

function startPolling() {
  if (pollingTimer) return;
  pollingTimer = setInterval(async () => {
    if (notCompletedData.value.length === 0) {
      stopPolling();
      return;
    }
    await pollScriptAssets();
  }, 3000);
}

function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}
const notCompletedData = computed(() => {
  return scripts.value.filter((s) => s.extractState == 0);
});
// 轮询相关

async function pollScriptAssets() {
  if (notCompletedData.value.length === 0) return;
  const ids = notCompletedData.value.map((item) => item.id);
  try {
    const { data } = await axios.post("/script/pollScriptAssets", { ids });
    if (data.length) {
      searchScripts();
    }
  } catch (e) {
    console.error("轮询事件状态失败:", e);
  }
}
watch(
  () => notCompletedData.value,
  (newVal) => {
    if (newVal.length > 0) {
      startPolling();
    } else {
      stopPolling();
    }
  },
);
watch(
  () => [selectedIds.value.join(","), otherSetting.value.assetsBatchGenereateSize],
  () => refreshExtractQuote(),
  { immediate: true },
);
onUnmounted(() => {
  stopPolling();
});
</script>

<style lang="scss" scoped>
.script {
  .smHead {
    margin-bottom: 32px;
  }
  .actionBar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    .actionBar-left {
      gap: 10px;
    }
    .actionBar-right {
      gap: 12px;
      .countBox {
        gap: 5px;
      }
    }
  }
  .contentArea {
    .scriptsList {
      gap: 20px;
      .scriptCard {
        position: relative;
      }
      .content {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        overflow: hidden;
        -webkit-line-clamp: 1;
      }
      .cardHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        .cardTitle {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
        }
        .cardCheckbox {
          flex-shrink: 0;
          margin-left: 12px;
        }
      }
      .assetTags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .del {
        text-align: right;
        opacity: 0.6;
        transition: opacity 0.2s;
      }
      .del:hover {
        opacity: 1;
      }
    }
    .emptyState {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 600px;
    }
  }
}

.settingDialogContent {
  padding: 16px 0;
  .settingItem {
    gap: 12px;
    margin-bottom: 16px;
    &:last-child {
      margin-bottom: 0;
    }
    .settingLabel {
      white-space: nowrap;
      min-width: 80px;
    }
  }
}
.settingDialogFooter {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}
</style>
