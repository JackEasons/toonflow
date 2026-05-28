<template>
  <t-dialog :header="$t('settings.title')" :footer="false" placement="center" width="1200px" v-model:visible="showSetting">
    <div class="settingPanel">
      <t-menu class="settingMenu" v-model:value="activeMenu" :style="{ height: '70vh' }">
        <t-menu-item v-for="item in menuItems" :key="item.key" :value="item.key">
          <template #icon>
            <t-badge :count="needUpdate && item.key === 'about' ? 1 : 0" dot>
              <component :is="item.icon" class="icon" />
            </t-badge>
          </template>
          {{ $t(item.label) }}
        </t-menu-item>
      </t-menu>
      <div class="settingRight">
        <div class="sectionTitle">{{ currentMenuItem ? $t(currentMenuItem.label) : "" }}</div>
        <div class="settingContent">
          <uiConfig v-if="activeMenu === 'ui'" />
          <languageConfig v-if="activeMenu === 'language'" />
          <vendorConfig v-if="activeMenu === 'vendorConfig'" />
          <loginConfig v-if="activeMenu === 'loginConfig'" />
          <agentConfog v-if="activeMenu === 'agentConfog'" />
          <promptManage v-if="activeMenu === 'promptManage'" />
          <otherConfig v-if="activeMenu === 'otherConfig'" />
          <dbConfig v-if="activeMenu === 'dbConfig'" />
          <logoutConfig v-if="activeMenu === 'logoutConfig'" />
          <memoryConfig v-if="activeMenu === 'memoryConfig'" />
          <fileManagement v-if="activeMenu === 'fileManagement'" />
          <skillManagement v-if="activeMenu === 'skillManagement'" />
          <devConfig v-if="activeMenu === 'devConfig'" />
          <modelMap v-if="activeMenu === 'modelMap'" />
        </div>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import settingStore from "@/stores/setting";
const { showSetting, activeMenu, needUpdate } = storeToRefs(settingStore());

import uiConfig from "./components/uiConfig.vue";
import languageConfig from "./components/languageConfig.vue";
import loginConfig from "./components/loginConfig.vue";
import agentConfog from "./components/agentConfog.vue";
import dbConfig from "./components/dbConfig.vue";
import otherConfig from "./components/otherConfig.vue";
import logoutConfig from "./components/logoutConfig.vue";
import vendorConfig from "./components/vendorConfig.vue";
import memoryConfig from "./components/memoryConfig.vue";
import fileManagement from "./components/fileManagement.vue";
import skillManagement from "./components/skillManagement.vue";
import devConfig from "./components/devConfig.vue";
import promptManage from "./components/promptManage.vue";
import modelMap from "./components/modelMap.vue";

const menuItems = [
  { key: "ui", label: "settings.menu.ui", icon: "i-theme" },
  { key: "language", label: "settings.menu.language", icon: "i-translate" },
  { key: "vendorConfig", label: "settings.menu.vendorConfig", icon: "i-computer" },
  { key: "modelMap", label: "settings.menu.modelMap", icon: "i-computer" },
  { key: "agentConfog", label: "settings.menu.agentConfig", icon: "i-color-filter" },
  { key: "promptManage", label: "settings.menu.promptManage", icon: "i-tips" },
  { key: "skillManagement", label: "settings.menu.skillsSkillsManagement", icon: "i-ring" },
  { key: "memoryConfig", label: "settings.menu.memoryConfig", icon: "i-memory-card-one" },
  { key: "loginConfig", label: "settings.menu.loginConfig", icon: "i-lock" },
  { key: "dbConfig", label: "settings.menu.dbConfig", icon: "i-data" },
  { key: "fileManagement", label: "settings.menu.fileManagement", icon: "i-hard-disk" },
  { key: "otherConfig", label: "settings.menu.otherConfig", icon: "i-application-menu" },
  { key: "devConfig", label: "settings.menu.devConfig", icon: "i-flask" },
  { key: "logoutConfig", label: "settings.menu.logoutConfig", icon: "i-logout" },
];

const currentMenuItem = computed(() => menuItems.find((item) => item.key === activeMenu.value));
</script>

<style lang="scss" scoped>
.settingPanel {
  display: flex;
  height: 70vh;
  overflow: hidden;
  gap: 16px;

  .settingMenu {
    width: 220px;
    min-width: 220px;
    padding: 8px;
    border: 1px solid rgba(104, 255, 226, 0.12);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.025);
    flex-shrink: 0;
    .icon {
      font-size: 20px;
      margin-right: 8px;
    }
  }

  .settingRight {
    flex: 1;
    padding: 4px 8px 4px 0;
    height: 70vh;
    overflow-y: auto;

    .sectionTitle {
      font-size: 18px;
      font-weight: 800;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(104, 255, 226, 0.14);
      margin-bottom: 14px;
      height: auto;
      color: var(--td-text-color-primary);
    }

    .settingContent {
      width: 100%;
      height: calc(70vh - 56px);
    }
  }
}
:deep(.t-menu) {
  padding: 0;
  padding-right: 0;
}
:deep(.t-is-active) {
  .t-badge {
    color: var(--td-brand-color) !important;
  }
}
</style>
