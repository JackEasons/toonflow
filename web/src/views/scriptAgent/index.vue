<template>
  <div class="scriptAgent">
    <Splitpanes class="default-theme data f">
      <Pane :size="48" :min-size="34" class="operate">
        <div class="box pr">
          <t-chat-list :clear-history="false">
            <t-chat-message
              v-for="message in messages"
              :key="message.id"
              :message="message"
              :name="(message as any).name"
              :placement="message.role === 'user' ? 'right' : 'left'"
              :variant="message.role === 'user' ? 'base' : 'outline'"
              :handleActions="message.role === 'user' ? {} : handleActions"
              :status="message.status"
              allowContentSegmentCustom></t-chat-message>
          </t-chat-list>
          <t-chat-sender
            class="inputBox"
            :disabled="status === 'pending' || status === 'streaming'"
            v-model="inputValue"
            :loading="status === 'pending' || status === 'streaming'"
            :placeholder="$t('workbench.scriptAgent.inputPlaceholder')"
            :textarea-props="{ placeholder: $t('workbench.scriptAgent.inputPlaceholder'), name: 'script-agent-input' }"
            @send="handleSend"
            @stop="handleStop">
            <template #footer-prefix>
              <t-popup trigger="click" placement="top-left">
                <t-button shape="square" variant="outline" size="small" :disabled="status === 'pending' || status === 'streaming'">
                  <template #icon>
                    <i-setting-config size="16" />
                  </template>
                </t-button>
                <template #content>
                  <div class="settingMenu">
                    <div class="settingMenuItem" @click="handleReconnect()">
                      <i-api size="14" />
                      <span>{{ $t("workbench.scriptAgent.reconnect") }}</span>
                    </div>
                    <div class="settingMenuItem" @click="handleClearMemory('message')">
                      <i-delete size="14" />
                      <span>{{ $t("workbench.scriptAgent.clearMessageMemory") }}</span>
                    </div>
                    <div class="settingMenuItem" @click="handleClearMemory('summary')">
                      <i-close size="14" />
                      <span>{{ $t("workbench.scriptAgent.clearSummaryMemory") }}</span>
                    </div>
                    <div class="settingMenuItem danger" @click="handleClearMemory('all')">
                      <i-delete-one size="14" />
                      <span>{{ $t("workbench.scriptAgent.clearAllMemory") }}</span>
                    </div>
                  </div>
                </template>
              </t-popup>
              <t-popup trigger="click" placement="top" v-if="showThink">
                <t-button
                  size="small"
                  variant="outline"
                  :theme="(['default', 'success', 'warning', 'danger'] as const)[thinkLevel] || 'default'"
                  style="margin-left: 8px">
                  <template #icon>
                    <i-tips size="16" />
                  </template>
                  {{ thinkLevelOptions[thinkLevel]?.label }}
                </t-button>
                <template #content>
                  <div class="settingMenu">
                    <div
                      v-for="opt in thinkLevelOptions"
                      :key="opt.value"
                      class="settingMenuItem"
                      :class="{ active: thinkLevel === opt.value }"
                      @click="scriptAgentStore().updateThinkConfig(opt.value)">
                      <span>{{ opt.label }}</span>
                    </div>
                  </div>
                </template>
              </t-popup>
            </template>
          </t-chat-sender>
          <i-dot class="dot" theme="outline" :fill="connected ? 'var(--tf-success)' : 'var(--tf-danger)'" />
          <transition name="fade">
            <div v-if="forceGenerateVisible" class="forceGenerateMask">
              <div class="forceGenerateCard">
                <div class="forceGenerateDesc">{{ $t("workbench.scriptAgent.forceGenerate.desc") }}</div>
                <div class="forceGenerateActions">
                  <t-button @click="forceGenerateVisible = false">{{ $t("workbench.scriptAgent.forceGenerate.confirm") }}</t-button>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </Pane>
      <Pane :size="52" :min-size="34" class="data">
        <div class="tabsWrapper">
          <t-tabs v-model="currentTable">
            <template #action>
              <div class="ac" v-if="currentTable == 1">
                <t-button @click="editMdPreview">{{ $t("workbench.scriptAgent.edit") }}</t-button>
              </div>
              <div class="ac" v-else-if="currentTable == 2">
                <t-button @click="editMdPreview">{{ $t("workbench.scriptAgent.edit") }}</t-button>
              </div>
            </template>
            <!-- <t-tab-panel :value="1" :label="$t('workbench.scriptAgent.chapterEvents')">
              <pre>{{ planData.event }}</pre>
            </t-tab-panel> -->
            <t-tab-panel :value="1" :label="$t('workbench.scriptAgent.storySkeleton')">
              <div class="panelContent">
                <MdPreview
                  v-if="planData.storySkeleton"
                  :modelValue="planData.storySkeleton"
                  :theme="themeSetting.mode === 'auto' ? undefined : themeSetting.mode" />
                <t-empty v-else :title="$t('workbench.scriptAgent.noContent')" />
              </div>
            </t-tab-panel>
            <t-tab-panel :value="2" :label="$t('workbench.scriptAgent.adaptationStrategy')">
              <div class="panelContent">
                <MdPreview
                  v-if="planData.adaptationStrategy"
                  :modelValue="planData.adaptationStrategy"
                  :theme="themeSetting.mode === 'auto' ? undefined : themeSetting.mode" />
                <t-empty v-else :title="$t('workbench.scriptAgent.noContent')" />
              </div>
            </t-tab-panel>
            <t-tab-panel :value="3" :label="$t('workbench.scriptAgent.script')">
              <div class="panelContent">
                <t-empty v-if="!planData.script?.length" :title="$t('workbench.scriptAgent.noContent')" />
                <div v-else class="scriptList">
                  <div
                    v-for="(item, index) in planData.script"
                    :key="getScriptCardKey(item, index)"
                    class="scriptCard"
                    :class="{ collapsed: isCardCollapsed(item, index) }">
                    <div class="scriptCardHeader">
                      <div class="scriptCardHeaderLeft">
                        <span class="scriptIndex">#{{ index + 1 }}</span>
                        <span class="scriptTitle">{{ item.name }}</span>
                      </div>
                      <div class="scriptCardActions">
                        <t-button size="small" variant="outline" @click="toggleCardCollapse(item, index)">
                          <template #icon>
                            <i-down v-if="!isCardCollapsed(item, index)" size="14" />
                            <i-right v-else size="14" />
                          </template>
                        </t-button>
                        <t-button size="small" @click="editScript(index)">
                          <template #icon><i-edit size="14" /></template>
                        </t-button>
                        <t-button theme="danger" variant="outline" size="small" @click="delScript(index)">
                          <template #icon><i-delete size="14" /></template>
                        </t-button>
                      </div>
                    </div>
                    <div class="scriptCardBody" v-if="!isCardCollapsed(item, index)">
                      <pre v-if="item.content">{{ item.content }}</pre>
                      <span v-else class="emptyContent">{{ $t("workbench.scriptAgent.noContent") }}</span>
                    </div>
                  </div>
                </div>
                <!-- 悬浮折叠按钮 -->
                <div class="floatCollapseBtn" v-if="planData.script?.length">
                  <t-button shape="circle" size="large" theme="primary" @click="toggleAllCards">
                    <template #icon>
                      <i-right v-if="isAllCollapsed" title="" size="18" />
                      <i-down v-else size="18" />
                    </template>
                  </t-button>
                </div>
              </div>
            </t-tab-panel>
          </t-tabs>
        </div>
      </Pane>
    </Splitpanes>
    <editMdPreivew v-model="dialogVisible" @save="onConfirm" :content="editContent" />

    <!-- 剧本编辑对话框 -->
    <t-dialog
      v-model:visible="scriptEditVisible"
      :header="$t('workbench.scriptAgent.editScript')"
      width="80%"
      top="10vh"
      placement="center"
      :confirm-btn="{ content: $t('workbench.scriptAgent.save'), theme: 'primary' }"
      dialogClassName="markdownEditDialog markdownEditDialog--script"
      @confirm="saveScript"
      @close="scriptEditVisible = false">
      <div class="scriptEditForm">
        <div class="scriptEditField">
          <strong>{{ scriptEditData.name }}</strong>
        </div>
        <div class="scriptEditField">
          <label>{{ $t("workbench.scriptAgent.content") }}</label>
          <MdEditor
            v-model="scriptEditData.content"
            :theme="themeSetting.mode === 'auto' ? undefined : themeSetting.mode"
            :toolbars="toolbars"
            :footers="[]"
            style="height: min(58vh, 680px)"
            @onUploadImg="() => {}"
            @drop.prevent />
        </div>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { MdEditor } from "md-editor-v3";
import type { ToolbarNames } from "md-editor-v3";
import { MdPreview } from "md-editor-v3";
import settingStore from "@/stores/setting";
const { themeSetting } = storeToRefs(settingStore());
import { Splitpanes, Pane } from "splitpanes";
import axios from "@/utils/axios";
import type { ChatMessagesData } from "@tdesign-vue-next/chat";
import projectStore from "@/stores/project";
const { project } = storeToRefs(projectStore());
import editMdPreivew from "@/components/editMdPreivew.vue";
import scriptAgentStore from "@/stores/scriptAgent";
const { connected, messages, status, planData, thinkLevel } = storeToRefs(scriptAgentStore());
const thinkLevelOptions = [
  { label: $t("workbench.scriptAgent.thinkLevel.off"), value: 0 },
  { label: $t("workbench.scriptAgent.thinkLevel.light"), value: 1 },
  { label: $t("workbench.scriptAgent.thinkLevel.deep"), value: 2 },
  { label: $t("workbench.scriptAgent.thinkLevel.extreme"), value: 3 },
];
import productionAgentStore from "@/stores/productionAgent";
const currentTable = ref(1);
const inputValue = ref("");
const toolbars: ToolbarNames[] = [
  "bold",
  "underline",
  "italic",
  "strikeThrough",
  "-",
  "title",
  "sub",
  "sup",
  "quote",
  "unorderedList",
  "orderedList",
  "task",
  "-",
  "codeRow",
  "code",
  "table",
  "-",
  "revoke",
  "next",
  "=",
  "preview",
];
const defMsg: ChatMessagesData[] = [
  {
    id: "welcome",
    role: "assistant",
    content: [
      { type: "text", status: "complete", data: $t("workbench.scriptAgent.welcomeMsg") },
      {
        type: "suggestion",
        status: "complete",
        data: [{ title: $t("workbench.scriptAgent.start"), prompt: $t("workbench.scriptAgent.start") }],
      },
    ],
  },
];

onMounted(() => {
  if (messages.value.length <= 0) messages.value = [...defMsg, ...messages.value];
  getPlanData();
  getNovel();
  scriptAgentStore().connect();

  if (messages.value.length <= 1) getHistory();
});
const agentWorkDataId = ref<number>();
async function getPlanData() {
  const { data } = await axios.post("/scriptAgent/getPlanData", { projectId: project.value?.id, agentType: "scriptAgent" });
  planData.value.storySkeleton = data.data.storySkeleton;
  planData.value.adaptationStrategy = data.data.adaptationStrategy;
  planData.value.script = data.data.script || [];
  agentWorkDataId.value = data.id;
}

//快捷发送
const handleActions = {
  suggestion: (data?: any) => {
    scriptAgentStore().chat(data?.content?.prompt);
  },
};

function handleSend(text: string) {
  scriptAgentStore().chat(text);
  inputValue.value = "";
}
function handleStop() {
  scriptAgentStore().stopGenerate();
}

const memoryTypeLabel: Record<string, string> = {
  message: $t("workbench.scriptAgent.memoryType.message"),
  summary: $t("workbench.scriptAgent.memoryType.summary"),
  all: $t("workbench.scriptAgent.memoryType.all"),
};
function handleClearMemory(type: "message" | "summary" | "all" | "reconnect") {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.scriptAgent.msg.clearConfirm"),
    body: $t("workbench.scriptAgent.msg.clearBody", { type: memoryTypeLabel[type] }),
    confirmBtn: $t("workbench.scriptAgent.msg.confirmClear"),
    cancelBtn: $t("workbench.scriptAgent.msg.cancel"),
    theme: "warning",
    onConfirm: async () => {
      await axios.post(`/agents/clearMemory`, { projectId: project.value?.id, agentType: "scriptAgent", type });
      window.$message.success($t("workbench.scriptAgent.msg.memoryCleared", { type: memoryTypeLabel[type] }));
      dialog.destroy();
      getHistory();
    },
  });
}
function handleReconnect() {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.scriptAgent.msg.reconnect"),
    body: $t("workbench.scriptAgent.msg.notReconnect"),
    confirmBtn: $t("workbench.scriptAgent.msg.keepReconnect"),
    cancelBtn: $t("workbench.scriptAgent.msg.cancel"),
    theme: "warning",
    onConfirm: async () => {
      productionAgentStore().reconnect();
      dialog.destroy();
    },
  });
}

const loadingHistory = ref(false);
async function getHistory() {
  loadingHistory.value = true;
  const { data } = await axios.post(`/agents/getMemory`, {
    projectId: project.value?.id,
    agentType: "scriptAgent",
  });
  messages.value = [...defMsg, ...data];
  loadingHistory.value = false;
}

// 强制生成蒙层
const forceGenerateVisible = ref(false);
const novelData = ref([]);

function getNovel() {
  axios.post("/novel/getNovelData", { projectId: project.value?.id }).then(({ data }: any) => {
    novelData.value = data;
    const hasUnfinished = (novelData.value as any[]).some((item: any) => item.eventState === 0);
    if (hasUnfinished && !forceGenerateVisible.value) {
      forceGenerateVisible.value = true;
    }
  });
}

const dialogVisible = ref(false);
const editContent = ref("");
//编辑markdown
function editMdPreview() {
  if (currentTable.value == 1) editContent.value = planData.value.storySkeleton;
  else if (currentTable.value == 2) editContent.value = planData.value.adaptationStrategy;
  dialogVisible.value = true;
}

const scriptEditIndex = ref(-1);
const scriptEditData = ref({
  name: "",
  content: "",
});
const scriptEditVisible = ref(false);

function editScript(index: number) {
  const item = planData.value.script[index];
  scriptEditIndex.value = index;
  scriptEditData.value = {
    name: item.name,
    content: item.content,
  };
  scriptEditVisible.value = true;
}

async function saveScript() {
  if (scriptEditIndex.value < 0) return;
  planData.value.script[scriptEditIndex.value] = { ...scriptEditData.value };
  await scriptAgentStore().setPlanData();
  await getPlanData();
  window.$message.success($t("workbench.scriptAgent.msg.scriptUpdated"));
  scriptEditVisible.value = false;
}
async function delScript(index: number) {
  const item = planData.value.script[index];
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.scriptAgent.msg.deleteConfirm"),
    body: $t("workbench.scriptAgent.msg.deleteBody"),
    confirmBtn: $t("workbench.scriptAgent.msg.confirmDelete"),
    cancelBtn: $t("workbench.scriptAgent.msg.cancel"),
    theme: "danger",
    onConfirm: async () => {
      if (item.id) {
        await axios.post("/script/delScript", { ids: [item.id] });
        planData.value.script.splice(index, 1);
      } else {
        planData.value.script.splice(index, 1);
      }
      await scriptAgentStore().setPlanData();
      await getPlanData();
      window.$message.success($t("workbench.scriptAgent.msg.scriptDeleted"));
      dialog.destroy();
    },
  });
}
function onConfirm(value: string) {
  axios
    .post("/scriptAgent/updateData", {
      id: agentWorkDataId.value,
      data: {
        storySkeleton: currentTable.value == 1 ? value : planData.value.storySkeleton,
        adaptationStrategy: currentTable.value == 2 ? value : planData.value.adaptationStrategy,
        script: planData.value.script,
      },
    })
    .then(() => {
      window.$message.success($t("workbench.scriptAgent.msg.updated"));
      getPlanData();
    })
    .catch((err) => {
      window.$message.error(err?.message ?? $t("workbench.scriptAgent.msg.error"));
    });
}

const showThink = ref(false);
onMounted(async () => {
  const { data } = await axios.post(`/project/getModelDetails`, { key: "scriptAgent" });
  if (data && data.think) {
    showThink.value = true;
  }
});

type ScriptCardItem = {
  id?: number;
  name: string;
  content: string;
};

// 剧本卡片折叠状态
const collapsedCards = ref<Record<string, boolean>>({});

function getScriptCardKey(item: ScriptCardItem, index: number) {
  if (item.id !== undefined && item.id !== null) {
    return `id:${item.id}`;
  }
  return `index:${index}`;
}

function isCardCollapsed(item: ScriptCardItem, index: number) {
  return Boolean(collapsedCards.value[getScriptCardKey(item, index)]);
}

watch(
  () => planData.value.script?.map((item, index) => getScriptCardKey(item, index)) || [],
  (keys) => {
    const nextCollapsedCards: Record<string, boolean> = {};
    keys.forEach((key) => {
      if (collapsedCards.value[key]) {
        nextCollapsedCards[key] = true;
      }
    });
    collapsedCards.value = nextCollapsedCards;
  },
  { immediate: true },
);

// 是否全部折叠
const isAllCollapsed = computed(() => {
  if (!planData.value.script?.length) return false;
  return planData.value.script.every((item, index) => isCardCollapsed(item, index));
});

// 切换单个卡片折叠状态
function toggleCardCollapse(item: ScriptCardItem, index: number) {
  const key = getScriptCardKey(item, index);
  collapsedCards.value[key] = !collapsedCards.value[key];
}

// 一键折叠/展开所有卡片
function toggleAllCards() {
  const nextCollapsed = !isAllCollapsed.value;
  const nextCollapsedCards = { ...collapsedCards.value };
  planData.value.script?.forEach((item, index) => {
    nextCollapsedCards[getScriptCardKey(item, index)] = nextCollapsed;
  });
  collapsedCards.value = nextCollapsedCards;
}
</script>

<style lang="scss" scoped>
.scriptAgent {
  height: calc(100% - 8px);
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 8px;

  > .data {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
}

.scriptAgent :deep(.splitpanes.default-theme) {
  gap: 22px;
}

.scriptAgent :deep(.splitpanes__pane) {
  background-color: transparent !important;
}

.scriptAgent :deep(.splitpanes__splitter) {
  flex: 0 0 1px;
  width: 1px;
  min-width: 1px;
  margin: 12px 0;
  border-left: none;
  background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.07), transparent) !important;
}

.scriptAgent :deep(.splitpanes__pane.operate),
.scriptAgent :deep(.splitpanes__pane.data) {
  display: flex;
  min-height: 0;
  height: 100%;
}

.scriptAgent :deep(.splitpanes__pane.operate) {
  min-width: 300px;
}

.box {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;

  &::before {
    display: none;
  }

  .dot {
    position: absolute;
    top: 14px;
    left: 14px;
    z-index: 2;
    filter: drop-shadow(0 0 8px currentColor);
  }

  :deep(.t-chat__list) {
    flex: 1;
    min-height: 0;
    padding: 24px 10px 18px;
    overflow-y: auto;
    scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
    scrollbar-width: thin;
  }

  :deep(.t-chat__list::-webkit-scrollbar-thumb) {
    background: rgba(255, 255, 255, 0.16) !important;
    border: 1px solid rgba(8, 8, 8, 0.9) !important;
  }

  :deep(.t-chat__list::-webkit-scrollbar-track) {
    background: transparent !important;
  }

  :deep(.t-chat__item) {
    margin-bottom: 18px;
  }

  :deep(.t-chat__detail),
  :deep(.t-chat__text--variant--base .t-chat__detail),
  :deep(.t-chat__text--variant--outline .t-chat__detail) {
    width: auto;
    max-width: min(820px, 92%);
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  :deep(.t-chat__inner.user .t-chat__detail),
  :deep(.t-chat__inner.user .t-chat__text--variant--base .t-chat__detail) {
    width: fit-content;
    max-width: min(620px, 78%);
    padding: 10px 16px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 14px;
    background: #242426;
  }

  :deep(.t-chat__base) {
    padding-left: 0;
    color: rgba(196, 224, 217, 0.56);
  }

  :deep(.t-chat__text) {
    color: rgba(241, 250, 247, 0.92);
    padding: 12px 0;
    line-height: 1.68;
  }

  :deep(.t-chat__text__assistant),
  :deep(.t-chat__text__content),
  :deep(.t-chat__text pre) {
    color: rgba(241, 250, 247, 0.9);
    line-height: 1.72;
  }

  :deep(.t-chat__text__assistant :where(code):not(:where(pre *))) {
    color: #f09aa5;
    background: rgba(240, 113, 130, 0.12);
  }

  .inputBox {
    flex-shrink: 0;
    width: calc(100% - 20px);
    max-width: calc(100% - 20px);
    box-sizing: border-box;
    min-height: 148px;
    margin: 0 10px 0;
    padding: 15px 16px 14px !important;
    border: 1px solid #303033;
    border-radius: 16px;
    background: #1d1d1f;
    box-shadow: none;
  }

  :deep(.t-chat__sender) {
    padding: 0;
    background: transparent;
  }

  :deep(.t-chat-sender) {
    width: 100%;
    box-sizing: border-box;
    padding: 15px 16px 14px;
  }

  :deep(.t-chat-sender__textarea) {
    width: 100%;
    box-sizing: border-box;
    min-height: 82px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  :deep(.t-chat-sender .t-textarea) {
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  :deep(.t-chat-sender__textarea__wrapper) {
    margin-bottom: 14px;
  }

  :deep(.t-chat-sender .t-textarea .t-textarea__inner) {
    min-height: 82px !important;
    max-height: 112px;
    padding: 0 !important;
    font-size: 15px;
    line-height: 1.55;
    color: rgba(245, 245, 245, 0.92);
    background: transparent !important;
  }

  :deep(.t-chat-sender .t-textarea .t-textarea__inner::placeholder) {
    color: rgba(235, 235, 235, 0.38);
  }

  :deep(.t-chat-sender__footer) {
    align-items: center;
    min-height: 30px;
    background: transparent;
  }

  :deep(.t-chat-sender__footer .t-button--variant-outline) {
    color: rgba(235, 235, 235, 0.72) !important;
    border-color: #3a3a3c !important;
    background: #242426 !important;
  }

  :deep(.t-chat-sender__textarea:hover),
  :deep(.t-chat-sender__textarea--focus) {
    border-color: transparent;
    box-shadow: none;
  }

  :deep(.t-chat-sender__button .t-chat-sender__button__default) {
    width: 32px;
    height: 32px;
    color: rgba(235, 235, 235, 0.88);
    background: #3a3a3c;
    box-shadow: none;
  }

  :deep(.t-chat-sender__button .t-chat-sender__button--disabled) {
    color: rgba(255, 255, 255, 0.34) !important;
    background: #2c2c2e !important;
  }
}

.tabsWrapper {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  border: 1px solid #2a2a2c;
  border-radius: 24px;
  background: #151516;
  box-shadow: none;
  backdrop-filter: none;

  &::before {
    display: none;
  }

  :deep(.t-tabs) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }

  :deep(.t-tabs__header) {
    flex-shrink: 0;
    height: 64px;
    border-bottom: 1px solid #2a2a2c;
    background: #151516;
  }

  :deep(.t-tabs__nav-container),
  :deep(.t-tabs__nav) {
    height: 100%;
  }

  :deep(.t-tabs__nav) {
    padding: 0 24px;
  }

  :deep(.t-tabs__nav-item) {
    padding: 0 18px;
    font-weight: 650;
    letter-spacing: 0;
  }

  :deep(.t-tabs__operations) {
    padding-right: 0;
  }

  :deep(.t-tabs__operations .t-button) {
    margin-right: 10px;
    min-width: 70px;
    color: rgba(245, 245, 245, 0.92) !important;
    border-color: #3a3a3c !important;
    background: #2a2a2c !important;
    box-shadow: none !important;
  }

  :deep(.t-tabs__content) {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: #111112;
  }

  :deep(.t-tab-panel) {
    height: 100%;
  }
}

.panelContent {
  height: 100%;
  overflow-y: auto;
  padding: 0;
  box-sizing: border-box;
  position: relative;

  &::-webkit-scrollbar-thumb {
    background-color: var(--td-border-level-2-color);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-track {
    background-color: transparent;
  }

  :deep(.md-editor) {
    background: transparent !important;
  }

  :deep(.md-editor-preview-wrapper) {
    max-width: 1080px;
    margin: 0 auto;
    padding: 18px 24px 40px;
  }

  :deep(.md-editor-preview) {
    box-sizing: border-box;
    padding: 24px 24px 44px;
    color: rgba(243, 250, 248, 0.92);
    font-size: 15px;
    line-height: 1.78;
  }

  :deep(.md-editor-preview > *:first-child) {
    margin-top: 0 !important;
  }

  :deep(.md-editor-preview h1),
  :deep(.md-editor-preview h2),
  :deep(.md-editor-preview h3) {
    letter-spacing: 0;
  }

  :deep(.md-editor-preview h1) {
    padding-bottom: 14px;
    margin: 0 0 20px;
    border-bottom: 1px solid #2a2a2c;
  }

  :deep(.md-editor-preview h2) {
    margin: 34px 0 14px;
  }

  :deep(.md-editor-preview h3) {
    margin: 28px 0 12px;
  }

  :deep(.md-editor-preview hr) {
    margin: 18px 0 26px;
    border-color: #2a2a2c;
  }

  :deep(.md-editor-preview p) {
    margin: 0 0 14px;
  }

  :deep(.md-editor-preview p + h2),
  :deep(.md-editor-preview blockquote + h2),
  :deep(.md-editor-preview ul + h2),
  :deep(.md-editor-preview ol + h2) {
    margin-top: 38px;
  }

  :deep(.md-editor-preview p + h3),
  :deep(.md-editor-preview blockquote + h3),
  :deep(.md-editor-preview ul + h3),
  :deep(.md-editor-preview ol + h3) {
    margin-top: 30px;
  }

  :deep(.md-editor-preview blockquote) {
    margin: 12px 0 20px;
    padding: 14px 18px;
    color: rgba(235, 235, 235, 0.72);
    border-left: 3px solid #6ee7df;
    border-radius: 0 10px 10px 0;
    background: #1f1f21;
  }

  :deep(.md-editor-preview blockquote p:last-child) {
    margin-bottom: 0;
  }

  :deep(.md-editor-preview ul),
  :deep(.md-editor-preview ol) {
    margin: 14px 0 22px;
  }

  :deep(.md-editor-preview li) {
    margin: 6px 0;
  }

  :deep(.md-editor-preview table) {
    margin: 16px 0 24px;
    overflow: hidden;
    border-radius: 12px;
    border-color: #303033;
    background: #1e1e20;
  }

  :deep(.md-editor-preview table th) {
    color: rgba(245, 245, 245, 0.86);
    border-color: #303033;
    background: #2a2a2c;
  }

  :deep(.md-editor-preview table td) {
    color: rgba(235, 235, 235, 0.82);
    border-color: #303033;
    background: #1f1f21;
  }

  :deep(.md-editor-preview table tr:nth-child(even) td) {
    background: #242426;
  }

  :deep(.t-empty) {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.scriptList {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 14px;
  align-items: start;
  padding: 22px;
}

.scriptCard {
  border: 1px solid #303033;
  border-radius: 14px;
  overflow: hidden;
  background: #202022;
  display: flex;
  flex-direction: column;
  align-self: start;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.18);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;

  &:hover {
    border-color: #3a3a3c;
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.22);
    transform: translateY(-1px);
  }

  .scriptCardHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    background: #252527;
    border-bottom: 1px solid #303033;
    .scriptCardHeaderLeft {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .scriptCardActions {
      flex-shrink: 0;
      display: flex;
      gap: 4px;
    }
    .scriptIndex {
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
      color: rgba(245, 245, 245, 0.86);
      border: 1px solid #3a3a3c;
      background: #2f2f31;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .scriptTitle {
      font-size: 14px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  .scriptCardBody {
    font-size: 13px;
    line-height: 1.7;
    padding: 12px 14px;
    max-height: 340px;
    overflow-y: auto;
    &::-webkit-scrollbar-thumb {
      background-color: var(--td-border-level-2-color);
      border-radius: 4px;
    }
    &::-webkit-scrollbar-track {
      background-color: var(--td-bg-color-secondarycontainer);
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
      font-family: inherit;
      color: rgba(237, 248, 245, 0.86);
    }
    .emptyContent {
      display: block;
      font-size: 13px;
    }
    :deep(.md-editor-preview-wrapper) {
      padding: 0;
    }
  }
  .scriptCardFooter {
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid #303033;
    background-color: #252527;
    .assetsLabel {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 12px;
      white-space: nowrap;
      margin-top: 2px;
      flex-shrink: 0;
    }
    .assetsTags {
      display: flex;
      flex-wrap: wrap;
      gap: 5.6px;
    }
  }
}

.scriptEditForm {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
  .scriptEditField {
    display: flex;
    flex-direction: column;
    gap: 6px;
    label {
      font-size: 13px;
      font-weight: 500;
    }
    .assets-list {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 10px;
    }
  }
  .assetsEditor {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-radius: 6px;
    padding: 8px 12px;
    background: rgba(19, 38, 34, 0.52);
    .assetsTagList {
      display: flex;
      flex-wrap: wrap;
      gap: 5.6px;
      min-height: 24px;
    }
    .assetsInputRow {
      display: flex;
      gap: 8px;
      align-items: center;
    }
  }
}

.forceGenerateMask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.62);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  border-radius: 10px;
  .forceGenerateCard {
    background:
      linear-gradient(180deg, rgba(18, 42, 38, 0.88), rgba(7, 19, 17, 0.86)),
      var(--td-bg-color-container);
    border: 1px solid rgba(118, 218, 204, 0.18);
    border-radius: 12px;
    padding: 28px 32px 24px;
    max-width: 300px;
    width: 90%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    .forceGenerateActions {
      display: flex;
      gap: 12px;
      margin-top: 8px;
      width: 100%;
      justify-content: center;
    }
  }
}
.settingMenu {
  padding: 4px 0;
  .settingMenuItem {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 16px;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    &:hover {
      background-color: rgba(98, 216, 202, 0.1);
    }
    &.danger {
      color: var(--td-error-color);
    }
  }
}
:deep(.t-tabs__operations--right) {
  top: 0;
  bottom: 0;
}
:deep(.t-tabs__btn--right) {
  display: none;
}

// 悬浮折叠按钮样式
.floatCollapseBtn {
  position: fixed;
  right: 34px;
  bottom: 34px;
  z-index: 100;
  .t-button {
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(98, 216, 202, 0.14);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 16px 34px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(98, 216, 202, 0.22);
    }
  }
}

// 折叠状态样式
.scriptCard {
  &.collapsed {
    .scriptCardHeader {
      border-bottom: none;
    }
  }
}

.scriptAgent :deep(.t-chat__detail),
.scriptAgent :deep(.t-chat__text--variant--base .t-chat__detail),
.scriptAgent :deep(.t-chat__text--variant--outline .t-chat__detail) {
  width: auto !important;
  max-width: min(820px, 92%) !important;
  color: rgba(238, 244, 242, 0.9) !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.scriptAgent :deep(.t-chat__inner.user .t-chat__detail) {
  width: fit-content !important;
  max-width: min(620px, 78%) !important;
  padding: 10px 16px !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
  border-radius: 14px !important;
  background: #242426 !important;
  box-shadow: none !important;
}

.scriptAgent :deep(.t-chat__text__assistant),
.scriptAgent :deep(.t-chat__text__content),
.scriptAgent :deep(.t-chat__text__content p),
.scriptAgent :deep(.t-chat__text__content li),
.scriptAgent :deep(.t-chat__text__content pre) {
  color: rgba(238, 249, 246, 0.9) !important;
}

.scriptAgent :deep(.t-chat__text__content table) {
  overflow: hidden;
  width: 100%;
  border: 1px solid rgba(214, 226, 223, 0.1) !important;
  border-radius: 12px;
  border-collapse: separate;
  border-spacing: 0;
  background: #1e1e20 !important;
}

.scriptAgent :deep(.t-chat__text__content table th) {
  color: rgba(245, 245, 245, 0.86) !important;
  background: #2a2a2c !important;
  border-color: #303033 !important;
}

.scriptAgent :deep(.t-chat__text__content table td) {
  color: rgba(235, 235, 235, 0.82) !important;
  background: #1f1f21 !important;
  border-color: #303033 !important;
}

.scriptAgent :deep(.t-chat__text__content table tr:nth-child(even) td) {
  background: #242426 !important;
}

.scriptAgent :deep(.t-chat__text__assistant blockquote) {
  color: rgba(235, 235, 235, 0.72) !important;
  border-left-color: #6ee7df !important;
  background: #1f1f21 !important;
}

.scriptAgent :deep(.t-chat__text__assistant :where(code):not(:where(pre *))) {
  color: #f2a0aa !important;
  background: rgba(240, 113, 130, 0.12) !important;
}

.scriptAgent :deep(.t-chat-sender__textarea) {
  width: 100% !important;
  box-sizing: border-box !important;
  min-height: 82px !important;
  padding: 0 !important;
  background: transparent !important;
}

.scriptAgent :deep(.t-chat-sender .t-textarea) {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.scriptAgent :deep(.t-chat-sender__footer) {
  align-items: center !important;
  min-height: 30px !important;
  background: transparent !important;
}

.scriptAgent :deep(.t-chat-sender__footer .t-button--variant-outline) {
  color: rgba(235, 235, 235, 0.72) !important;
  border-color: #3a3a3c !important;
  background: #242426 !important;
}

.scriptAgent :deep(.t-chat-sender__textarea__wrapper) {
  margin-bottom: 14px !important;
}

.scriptAgent :deep(.t-chat-sender__textarea) {
  border: 0 !important;
  border-radius: 0 !important;
}

.scriptAgent :deep(.t-chat-sender__textarea--focus),
.scriptAgent :deep(.t-chat-sender__textarea:hover) {
  border-color: transparent !important;
  box-shadow: none !important;
}

@media (max-width: 980px) {
  .scriptAgent :deep(.splitpanes.default-theme) {
    gap: 10px;
  }

  .scriptAgent :deep(.splitpanes__pane.operate) {
    min-width: 260px;
  }

  .panelContent :deep(.md-editor-preview-wrapper) {
    padding: 16px 14px 34px;
  }

  .panelContent :deep(.md-editor-preview) {
    padding: 20px 16px 36px;
  }

  .scriptList {
    grid-template-columns: 1fr;
    padding: 16px;
  }
}
</style>
