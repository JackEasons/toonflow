<script setup lang="ts">
import type { GlobalConfigProvider } from "tdesign-vue-next";

import { computed, nextTick, onBeforeMount, onMounted } from "vue";

import { config } from "md-editor-v3";
import { merge } from "es-toolkit/compat";
import enConfig from "tdesign-vue-next/es/locale/en_US";
import zhConfig from "tdesign-vue-next/es/locale/zh_CN";

import { cachedLocale } from "#/locales";
import { initTheme } from "#/utils/theme";

defineOptions({ name: "App" });

type LinkClickHandler = (event: MouseEvent) => Promise<boolean>;

function registerDebuggerShortcut() {
  document.addEventListener("keydown", (event) => {
    if (event.key === "F8") {
      event.preventDefault();
      debugger;
    }
  });
}

async function handleLinkClick(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();

  const target = event.currentTarget as HTMLAnchorElement | null;
  const url = target?.getAttribute("data-link") || target?.getAttribute("href");
  if (!url) return false;

  window.open(url, "_blank", "noopener,noreferrer");
  return false;
}

async function setupMarkdownRenderer() {
  await nextTick();
  await nextTick();
  await nextTick();
  await nextTick();

  config({
    markdownItConfig(md) {
      const defaultRender =
        md.renderer.rules.link_open ||
        function (tokens, idx, options, env, self) {
          return self.renderToken(tokens, idx, options);
        };

      md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        const href = token.attrGet("href");

        if (href) {
          token.attrSet("target", "_blank");
          token.attrSet("rel", "noopener noreferrer");
          token.attrSet("data-link", href);
          token.attrSet("onclick", "return handleLinkClick(event)");
        }

        return defaultRender(tokens, idx, options, env, self);
      };
    },
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

onMounted(() => {
  (window as unknown as Window & { handleLinkClick: LinkClickHandler }).handleLinkClick = handleLinkClick;
  void setupMarkdownRenderer();
});
</script>

<template>
  <div class="tf-app-content">
    <t-config-provider :global-config="globalConfig">
      <RouterView />
    </t-config-provider>
  </div>
</template>
