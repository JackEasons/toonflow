<template>
  <div class="main" :style="{ height: isElectron ? 'calc(100vh - 32px)' : '100vh' }">
    <div class="menu fc jb">
      <div class="logoBox c">
        <div class="logo"></div>
      </div>
      <div class="itemBox fc ac">
        <t-tooltip
          :content="menu.labelKey ? $t(menu.labelKey) : ''"
          placement="right"
          destroyOnClose
          :showArrow="false"
          v-for="(menu, index) in menuList"
          :key="index">
          <div class="item fc c" v-if="menu.type === 'btn'" :class="{ active: activeMenu == menu.path }" @click="handleClick(menu)">
            <component :is="menu.icon" class="icon" />
          </div>
          <div class="divider" v-if="menu.type === 'divider'"></div>
        </t-tooltip>
      </div>
      <div class="footItem fc ac">
        <UserMembershipCenter />
        <t-tooltip :content="$t('workbench.menu.settings')" placement="right" destroyOnClose :showArrow="false">
          <div class="item settingsItem c" @click="showSetting = true">
            <i-setting-one class="icon" />
          </div>
        </t-tooltip>
      </div>
    </div>
    <div class="view">
      <div class="topMenu f ac jb" v-if="project?.id">
        <div class="title">
          <h2>{{ project?.name || $t("workbench.selectProject") }}</h2>
        </div>
        <div class="rightBtnList f ac">
          <t-tooltip
            :content="menu.labelKey ? $t(menu.labelKey) : ''"
            placement="bottom"
            destroyOnClose
            :showArrow="false"
            v-for="(menu, index) in rightBtnList"
            :key="index">
            <div
              class="item fc c"
              v-if="menu.type === 'btn' && (project.projectType === 'novel' || !menu.nodelOnly)"
              :class="{ active: activeMenu == menu.path }"
              @click="handleClick(menu)">
              <component :is="menu.icon" class="icon" />
            </div>
            <div class="divider" v-if="menu.type === 'divider'"></div>
          </t-tooltip>
        </div>
      </div>
      <div class="viewBox">
        <router-view v-slot="{ Component }">
          <component :is="Component" :key="$route.fullPath" />
        </router-view>
      </div>
    </div>
  </div>
  <hello />
  <setting />
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import setting from "#/components/setting/index.vue";
import hello from "#/components/hello.vue";
import UserMembershipCenter from "#/components/membership/UserMembershipCenter.vue";
import projectStore from "#/stores/project";
const { project } = storeToRefs(projectStore());
import settingStore from "#/stores/setting";
const { showSetting, isElectron } = storeToRefs(settingStore());
const menuList = ref([
  { type: "btn", path: "/project", labelKey: "workbench.menu.myProject", icon: "i-folder-close" },
  { type: "btn", path: "/task", labelKey: "workbench.menu.taskCenter", icon: "i-view-list" },
  { type: "btn", path: "/service-status", labelKey: "workbench.menu.serviceStatus", icon: "i-data" },
  // { type: "divider" },
]);

const rightBtnList = ref([
  { type: "btn", path: "/novel", labelKey: "workbench.menu.novel", icon: "i-notebook", nodelOnly: true },
  { type: "btn", path: "/scriptAgent", labelKey: "workbench.menu.scriptAgent", icon: "i-color-filter", nodelOnly: true },
  { type: "btn", path: "/script", labelKey: "workbench.menu.scriptManage", icon: "i-document-folder" },
  { type: "btn", path: "/cornerScape", labelKey: "workbench.menu.cornerScape", icon: "i-peoples-two" },
  { type: "btn", path: "/production", labelKey: "workbench.menu.production", icon: "i-carousel-video" },
  { type: "divider" },
  { type: "btn", path: "/assets", labelKey: "workbench.menu.assetCenter", icon: "i-receive" },
]);

const router = useRouter();
const route = useRoute();
const activeMenu = ref(route.path);

watch(
  () => route.path,
  (newPath) => {
    activeMenu.value = newPath;
  },
);

function handleClick(menu: any) {
  if (menu.needProject && !project.value) return;
  router.push(menu.path);
  activeMenu.value = menu.path;
}
</script>

<style lang="scss" scoped>
.main {
  --tf-line: rgba(255, 255, 255, 0.1);
  --tf-line-strong: rgba(255, 255, 255, 0.18);
  --tf-accent: #62d8ca;
  --tf-accent-2: #9bbcff;
  --tf-success: #71d99a;
  --tf-danger: #f07182;
  --td-bg-color-page: #090909;
  --td-bg-color-container: rgba(21, 21, 22, 0.96);
  --td-bg-color-container-hover: rgba(118, 218, 204, 0.1);
  --td-bg-color-container-active: rgba(118, 218, 204, 0.16);
  --td-bg-color-container-select: rgba(118, 218, 204, 0.18);
  --td-bg-color-secondarycontainer: rgba(31, 31, 33, 0.94);
  --td-bg-color-secondarycontainer-hover: rgba(42, 42, 44, 0.98);
  --td-bg-color-secondarycontainer-active: rgba(118, 218, 204, 0.14);
  --td-bg-color-component: rgba(42, 42, 44, 0.94);
  --td-bg-color-component-hover: rgba(52, 52, 54, 0.98);
  --td-bg-color-component-active: rgba(118, 218, 204, 0.16);
  --td-bg-color-secondarycomponent: rgba(33, 51, 47, 0.94);
  --td-bg-color-secondarycomponent-hover: rgba(47, 70, 64, 0.98);
  --td-bg-color-specialcomponent: rgba(98, 216, 202, 0.12);
  --td-text-color-primary: rgba(245, 252, 249, 0.94);
  --td-text-color-secondary: rgba(219, 238, 232, 0.68);
  --td-text-color-placeholder: rgba(219, 238, 232, 0.42);
  --td-text-color-disabled: rgba(219, 238, 232, 0.28);
  --td-text-color-anti: #03100f;
  --td-text-color-brand: var(--tf-accent);
  --td-text-color-link: var(--tf-accent-2);
  --td-border-level-1-color: var(--tf-line);
  --td-border-level-2-color: rgba(118, 218, 204, 0.26);
  --td-component-border: var(--tf-line);
  --td-component-stroke: rgba(118, 218, 204, 0.15);

  width: 100vw;
  padding: 0 14px 14px 0;
  display: flex;
  gap: 14px;
  position: relative;
  color-scheme: dark;
  color: var(--td-text-color-primary);

  .menu {
    flex-shrink: 0;
    width: 88px;
    height: 100%;
    overflow: visible;
    background: transparent;
    border: 0;
    border-radius: 0;
    padding: 20px 12px 22px;
    color: var(--td-text-color-primary);
    box-shadow: none;
    backdrop-filter: blur(24px) saturate(1.2);
    position: relative;
    z-index: 20;
    isolation: isolate;
    &::before {
      display: none;
    }
    &::after {
      display: none;
    }
    .logoBox {
      width: 100%;
      height: 96px;
      flex-shrink: 0;
      align-items: flex-start;
      .logo {
        width: 36px;
        aspect-ratio: 1/1;
        background: linear-gradient(135deg, var(--tf-accent), var(--tf-accent-2));
        mask: url("@/assets/logo.svg") no-repeat center;
        mask-size: contain;
        -webkit-mask: url("@/assets/logo.svg") no-repeat center;
        -webkit-mask-size: contain;
        filter: drop-shadow(0 0 10px rgba(98, 216, 202, 0.24));
      }
    }
    .itemBox {
      flex: 0 0 auto;
      width: 64px;
      height: auto;
      margin: 0;
      padding: 8px;
      align-self: center;
      justify-content: center;
      gap: 2px;
      border: 1px solid rgba(118, 218, 204, 0.16);
      border-radius: 34px;
      background: rgba(10, 21, 31, 0.62);
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.34);
      backdrop-filter: blur(22px) saturate(120%);
    }
    .footItem {
      gap: 12px;
      width: 100%;
      min-height: 190px;
      flex-shrink: 0;
      justify-content: flex-end;
      .item {
        cursor: pointer;
        width: 44px;
        height: 44px;
        border: 1px solid rgba(118, 218, 204, 0.16);
        border-radius: 999px;
        background: rgba(14, 25, 23, 0.78);
        color: rgba(219, 238, 232, 0.68);
        .icon {
          font-size: 22px;
        }
        &:hover {
          color: rgba(245, 252, 249, 0.94);
          background-color: rgba(118, 218, 204, 0.1);
          border-color: rgba(118, 218, 204, 0.32);
        }
      }
      .active {
        background: #242426 !important;
        border-color: #3a3a3c;
        border-radius: 12px;
      }
    }
  }
  .menu::-webkit-scrollbar {
    width: 4px;
  }
  .menu::-webkit-scrollbar-thumb {
    background-color: rgba(98, 216, 202, 0.32);
    border-radius: 4px;
    &:hover {
      background-color: rgba(98, 216, 202, 0.5);
    }
  }
  .menu::-webkit-scrollbar-track {
    background-color: transparent;
  }
  .view {
    flex: 1;
    margin-top: 14px;
    margin-left: 0;
    background: #0b0b0c;
    border: 1px solid #252527;
    border-radius: 20px;
    width: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-gutter: stable;
    padding-left: 24px;
    padding-right: 24px;
    box-shadow: none;
    backdrop-filter: none;
    position: relative;
    isolation: isolate;
    &::before {
      content: "";
      display: none;
    }
    &::after {
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      content: "";
      background: transparent;
      opacity: 1;
    }
    > * {
      position: relative;
      z-index: 1;
    }
    .topMenu {
      min-height: 64px;
      height: 64px;
      border-bottom: 1px solid #242426;
      .title h2 {
        margin: 0;
        font-size: 23px;
        font-weight: 700;
        color: var(--td-text-color-primary);
      }
      .rightBtnList {
        .item {
          margin-bottom: 0px !important;
          margin-top: 0px !important;
          margin-right: 4px;
          margin-left: 4px;
          color: rgba(238, 249, 246, 0.82);
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.08);

          &:hover {
            color: #f5fcf9;
            background: rgba(110, 231, 223, 0.12);
            border-color: rgba(110, 231, 223, 0.28);
          }

          &.active {
            color: #6ee7df;
            background: rgba(110, 231, 223, 0.16) !important;
            border-color: rgba(110, 231, 223, 0.42);
            box-shadow: 0 0 0 1px rgba(110, 231, 223, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          }
        }
        .divider {
          width: 1px;
          height: 24px;
          background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.16), transparent);
          margin: 0 4px;
        }
      }
    }
    .viewBox {
      width: 100%;
      height: calc(100% - 64px);
      min-height: 0;
    }
  }
}

.item {
  margin-bottom: 4px;
  margin-top: 4px;
  cursor: pointer;
  width: 48px;
  height: 48px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: rgba(238, 249, 246, 0.72);
  transition:
    background 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
  .icon {
    font-size: 24px;
    color: currentColor;
  }
  :deep(svg) {
    color: currentColor !important;
  }
  :deep(svg [stroke]) {
    stroke: currentColor !important;
  }
  :deep(svg [fill]:not([fill="none"])) {
    fill: currentColor !important;
  }
  .title {
    font-size: 10px;
    white-space: nowrap;
    color: var(--td-text-color-primary);
  }
  &:hover {
    color: rgba(245, 252, 249, 0.94);
    background-color: #202022;
    border-color: #303033;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
    transform: translateY(-1px);
  }
}
.active {
  background: #242426 !important;
  color: #6ee7df;
  border-color: #3a3a3c;
  border-radius: 12px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.divider {
  width: 48px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.16), transparent);
  margin: 8px 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
