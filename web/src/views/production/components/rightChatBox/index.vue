<template>
  <div class="rightChatBox" :style="{ width: boxWidth + 'px' }">
    <div ref="resizeHandleRef" class="resizeHandle"></div>
    <div class="header f ac jb">
      <span class="text">
        <i-dot theme="outline" :fill="connected ? 'var(--tf-success)' : 'var(--tf-danger)'" />
        {{ props.title }}
      </span>
      <div class="close">
        <i-click-to-fold size="18" @click.stop="emit('close')" />
      </div>
    </div>
    <div class="chatBox" v-loading="loadingHistory">
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
          allowContentSegmentCustom>
          <!-- <template #actionbar>
            <t-chat-actionbar :action-bar="['replay', 'copy']" />
          </template> -->
        </t-chat-message>
      </t-chat-list>
      <t-chat-sender
        class="inputBox"
        :disabled="status === 'pending' || status === 'streaming' || !connected"
        v-model="inputValue"
        :loading="status === 'pending' || status === 'streaming'"
        :placeholder="$t('workbench.production.chatBox.inputPlaceholder')"
        :textarea-props="{ placeholder: $t('workbench.production.chatBox.inputPlaceholder'), name: 'production-agent-input' }"
        @send="handleSend"
        @stop="handleStop">
        <template #footer-prefix>
          <div class="ac" style="gap: 5px">
            <t-popup trigger="click" placement="top-left">
              <t-button shape="square" variant="outline" size="small">
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
                    <span>{{ $t("workbench.production.chatBox.clearMessageMemory") }}</span>
                  </div>
                  <div class="settingMenuItem" @click="handleClearMemory('summary')">
                    <i-close size="14" />
                    <span>{{ $t("workbench.production.chatBox.clearSummaryMemory") }}</span>
                  </div>
                  <div class="settingMenuItem danger" @click="handleClearMemory('all')">
                    <i-delete-one size="14" />
                    <span>{{ $t("workbench.production.chatBox.clearAllMemory") }}</span>
                  </div>
                </div>
              </template>
            </t-popup>
            <t-popup trigger="click" placement="top" v-if="showThink">
              <t-button
                size="small"
                variant="outline"
                :theme="(['default', 'success', 'warning', 'danger'] as const)[thinkLevel] || 'default'">
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
                    @click="productionAgentStore().updateThinkConfig(opt.value)">
                    <span>{{ opt.label }}</span>
                  </div>
                </div>
              </template>
            </t-popup>
          </div>
        </template>
      </t-chat-sender>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, watchEffect } from "vue";
import { DialogPlugin } from "tdesign-vue-next";
import { storeToRefs } from "pinia";
import { useMousePressed, useMouse } from "@vueuse/core";
import _ from "lodash";
import axios from "#/utils/axios";
import productionAgentStore from "#/stores/productionAgent";
import projectStore from "#/stores/project";
const { project } = storeToRefs(projectStore());
const { connected, messages, status, episodesId, loadingHistory, thinkLevel } = storeToRefs(productionAgentStore());
const thinkLevelOptions = [
  { label: $t("workbench.scriptAgent.thinkLevel.off"), value: 0 },
  { label: $t("workbench.scriptAgent.thinkLevel.light"), value: 1 },
  { label: $t("workbench.scriptAgent.thinkLevel.deep"), value: 2 },
  { label: $t("workbench.scriptAgent.thinkLevel.extreme"), value: 3 },
];

const props = defineProps({ title: String });

const emit = defineEmits(["close"]);

const inputValue = ref("");

function handleSend(text: string) {
  productionAgentStore().chat(text);
  inputValue.value = "";
}
function handleStop() {
  productionAgentStore().stopGenerate();
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

//快捷发送
const handleActions = {
  suggestion: (data?: any) => {
    productionAgentStore().chat(data?.content?.prompt);
  },
};

const memoryTypeLabel: Record<string, string> = {
  message: $t("workbench.production.chatBox.messageMemory"),
  summary: $t("workbench.production.chatBox.summaryMemory"),
  all: $t("workbench.production.chatBox.allMemory"),
};
function handleClearMemory(type: "message" | "summary" | "all") {
  const dialog = DialogPlugin.confirm({
    header: $t("workbench.production.chatBox.confirmClear"),
    body: $t("workbench.production.chatBox.confirmClearBody", { type: memoryTypeLabel[type] }),
    confirmBtn: $t("workbench.production.chatBox.confirmClearBtn"),
    cancelBtn: $t("workbench.production.cancel"),
    theme: "warning",
    onConfirm: async () => {
      await axios.post(`/agents/clearMemory`, { projectId: project.value?.id, agentType: "productionAgent", episodesId: episodesId.value, type });
      window.$message.success($t("workbench.production.chatBox.memoryCleared", { type: memoryTypeLabel[type] }));
      dialog.destroy();
      productionAgentStore().getHistory();
    },
  });
}

const resizeHandleRef = ref<HTMLElement | null>(null);
const boxWidth = ref(460);
const MIN_WIDTH = 420;
const { pressed } = useMousePressed({ target: resizeHandleRef });
const { x } = useMouse();
const dragStartX = ref(0);
const dragStartWidth = ref(460);
watch(pressed, (isPressed) => {
  if (isPressed) {
    dragStartX.value = x.value;
    dragStartWidth.value = boxWidth.value;
  }
});
watchEffect(() => {
  if (pressed.value) {
    const maxWidth = window.innerWidth * 0.8;
    boxWidth.value = Math.min(maxWidth, Math.max(MIN_WIDTH, dragStartWidth.value + (dragStartX.value - x.value)));
  }
});

const showThink = ref(false);
onMounted(async () => {
  const { data } = await axios.post(`/project/getModelDetails`, { key: "productionAgent" });
  if (data && data.think) {
    showThink.value = true;
  }
});
</script>

<style lang="scss" scoped>
.rightChatBox {
  position: absolute;
  top: 10px;
  right: 12px;
  bottom: 10px;
  display: flex;
  flex-direction: column;
  z-index: 9999;
  min-width: 420px;
  height: calc(100% - 20px);
  overflow: hidden;
  border: 1px solid #2a2a2c;
  border-radius: 22px;
  background: #151516;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.34);

  .resizeHandle {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 10;
    width: 5px;
    cursor: col-resize;
    user-select: none;
    background: transparent;
    transition: background 0.18s ease;
    &:hover {
      background: rgba(118, 218, 204, 0.16);
    }
  }

  .chatBox {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    width: 100%;
    overflow: hidden;
  }

  :deep(.t-chat__list) {
    flex: 1;
    min-height: 0;
    padding: 18px 14px 16px 16px;
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

  .header {
    height: 52px;
    padding: 0 16px;
    flex-shrink: 0;
    border-bottom: 1px solid #2a2a2c;
    background: #151516;
    .text {
      display: -webkit-box;
      overflow: hidden;
      font-size: 17px;
      line-height: 1.4;
      color: rgba(245, 245, 245, 0.92);
      text-overflow: ellipsis;
      white-space: nowrap;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
    }
    .close {
      cursor: pointer;
      aspect-ratio: 1/1;
      color: rgba(235, 235, 235, 0.72);
    }
  }

  .inputBox {
    flex-shrink: 0;
    width: calc(100% - 24px);
    max-width: calc(100% - 24px);
    box-sizing: border-box;
    min-height: 126px;
    margin: 0 12px 12px;
    padding: 15px 16px 14px !important;
    border: 1px solid #303033;
    border-radius: 16px;
    background: #1d1d1f;
    box-shadow: none;
  }

  :deep(.t-chat-sender) {
    width: 100%;
    box-sizing: border-box;
    padding: 15px 16px 14px;
  }

  :deep(.t-chat-sender__textarea) {
    width: 100%;
    box-sizing: border-box;
    min-height: 66px;
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
    margin-bottom: 12px;
  }

  :deep(.t-chat-sender .t-textarea .t-textarea__inner) {
    min-height: 66px !important;
    max-height: 104px;
    padding: 0 !important;
    font-size: 14px;
    line-height: 1.55;
    color: rgba(245, 245, 245, 0.92);
    background: transparent !important;
  }

  :deep(.t-chat-sender .t-textarea .t-textarea__inner::placeholder) {
    color: rgba(235, 235, 235, 0.38);
  }

  :deep(.t-chat-sender__footer) {
    align-items: center;
    min-height: 28px;
    background: transparent;
  }

  :deep(.t-chat-sender__footer .t-button--variant-outline) {
    color: rgba(235, 235, 235, 0.72) !important;
    border-color: #3a3a3c !important;
    background: #242426 !important;
  }

  :deep(.t-chat-sender__textarea:hover),
  :deep(.t-chat-sender__textarea--focus) {
    border-color: transparent !important;
    box-shadow: none !important;
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

  :deep(.t-chat__detail),
  :deep(.t-chat__text--variant--base .t-chat__detail),
  :deep(.t-chat__text--variant--outline .t-chat__detail),
  :deep(t-chat-item::part(t-chat__item__content)),
  :deep(t-chat-item::part(t-chat__text)),
  :deep(t-chat-item::part(t-chat__item__detail)) {
    box-sizing: border-box;
    max-width: min(100%, 820px) !important;
    padding: 0 !important;
    color: rgba(238, 244, 242, 0.9);
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  :deep(.t-chat__inner.user .t-chat__detail),
  :deep(.t-chat__inner.user .t-chat__text--variant--base .t-chat__detail),
  :deep(t-chat-item[role="user"]::part(t-chat__item__content)),
  :deep(t-chat-item[placement="right"]::part(t-chat__item__content)) {
    width: max-content !important;
    max-width: min(340px, 78%) !important;
    min-width: 64px !important;
    padding: 0 !important;
    white-space: pre-wrap !important;
    word-break: normal !important;
    overflow-wrap: break-word !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  :deep(t-chat-item[role="user"]),
  :deep(t-chat-item[placement="right"]) {
    --td-chat-item-content-base-padding: 0;
    --td-chat-item-content-border: 0;
    --td-chat-item-outline-border-color: transparent;
    --td-chat-item-default-bg: transparent;
    --td-chat-item-primary-bg: transparent;
  }

  :deep(t-chat-item[role="user"]::part(t-chat__text)),
  :deep(t-chat-item[placement="right"]::part(t-chat__text)),
  :deep(t-chat-item[role="user"]::part(t-chat__text--user)),
  :deep(t-chat-item[placement="right"]::part(t-chat__text--user)) {
    display: inline-block !important;
    width: max-content !important;
    max-width: 100% !important;
    min-width: 64px !important;
    padding: 10px 16px !important;
    color: rgba(225, 241, 255, 0.88);
    text-align: left;
    white-space: pre-wrap !important;
    word-break: normal !important;
    overflow-wrap: break-word !important;
    border: 1px solid rgba(255, 255, 255, 0.05) !important;
    border-radius: 14px !important;
    background: #242426 !important;
    box-shadow: none !important;
  }

  :deep(.t-chat__text),
  :deep(.t-chat__text__assistant),
  :deep(.t-chat__text__content),
  :deep(t-chat-item::part(t-chat__text__markdown)),
  :deep(t-chat-item::part(md_p)),
  :deep(t-chat-item::part(md_li)),
  :deep(t-chat-item::part(md_strong)) {
    color: rgba(238, 249, 246, 0.9);
    line-height: 1.68;
  }

  :deep(.t-chat__text__content table),
  :deep(t-chat-item::part(md_table)) {
    overflow: hidden !important;
    border: 1px solid #303033 !important;
    border-radius: 8px !important;
    background: #1f1f21 !important;
  }

  :deep(.t-chat__text__content table th),
  :deep(t-chat-item::part(md_th)) {
    color: rgba(245, 245, 245, 0.86) !important;
    background: #2a2a2c !important;
    border-color: #303033 !important;
  }

  :deep(.t-chat__text__content table td),
  :deep(t-chat-item::part(md_td)) {
    color: rgba(235, 235, 235, 0.82) !important;
    background: #1f1f21 !important;
    border-color: #303033 !important;
  }

  :deep(.t-chat__text__assistant blockquote),
  :deep(t-chat-item::part(md_blockquote)) {
    color: rgba(235, 235, 235, 0.72) !important;
    border-left: 3px solid #6ee7df !important;
    background: #1f1f21 !important;
  }

  :deep(.t-chat__base),
  :deep(.t-chat__name) {
    color: rgba(196, 224, 217, 0.56) !important;
  }

  :deep(.t-chat__to-bottom) {
    color: #7edcd2 !important;
    background: rgba(238, 252, 248, 0.055) !important;
    border-radius: 50%;
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
      background-color: var(--td-bg-color-container-hover);
    }
    &.danger {
      color: var(--td-error-color);
    }
  }
}
.modelSelCls {
  gap: 5px;
  .paramSelect {
    max-width: 80px;
  }
}
</style>
