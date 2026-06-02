<script setup lang="ts">
import type { GlobalConfigProvider } from "tdesign-vue-next";

import { computed, onBeforeMount } from "vue";

import { merge } from "es-toolkit/compat";
import enConfig from "tdesign-vue-next/es/locale/en_US";
import zhConfig from "tdesign-vue-next/es/locale/zh_CN";

import { cachedLocale } from "#/locales";
import { initTheme } from "#/utils/theme";

defineOptions({ name: "App" });

function registerDebuggerShortcut() {
  document.addEventListener("keydown", (event) => {
    if (event.key === "F8") {
      event.preventDefault();
      debugger;
    }
  });
}

const tdesignLocaleMap: Record<string, object> = {
  "zh-CN": zhConfig,
  en: enConfig,
};

const customConfig: GlobalConfigProvider = {
  calendar: {},
  table: {},
  pagination: {},
};

const globalConfig = computed<GlobalConfigProvider>(
  () => merge({}, tdesignLocaleMap[cachedLocale.value] || zhConfig, customConfig) as GlobalConfigProvider,
);

onBeforeMount(() => {
  initTheme();
  registerDebuggerShortcut();
});
</script>

<template>
  <div class="tf-app-content">
    <t-config-provider :global-config="globalConfig">
      <RouterView />
    </t-config-provider>
  </div>
</template>
