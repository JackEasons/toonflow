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
        <t-tooltip :content="$t('workbench.menu.settings')" placement="right" destroyOnClose :showArrow="false">
          <div class="item c" @click="showSetting = true">
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
import setting from "@/components/setting/index.vue";
import hello from "@/components/hello.vue";
import projectStore from "@/stores/project";
const { project } = storeToRefs(projectStore());
import settingStore from "@/stores/setting";
const { showSetting, isElectron } = storeToRefs(settingStore());
const menuList = ref([
  { type: "btn", path: "/project", labelKey: "workbench.menu.myProject", icon: "i-folder-close" },
  { type: "btn", path: "/task", labelKey: "workbench.menu.taskCenter", icon: "i-view-list" },
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
  width: 100vw;
  padding: 14px;
  display: flex;
  gap: 16px;
  position: relative;
  color: var(--td-text-color-primary);

  .menu {
    width: 70px;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    background: #101011;
    border: 1px solid #252527;
    border-radius: 18px;
    padding-top: 16px;
    padding-bottom: 16px;
    color: var(--td-text-color-primary);
    box-shadow: none;
    backdrop-filter: none;
    position: relative;
    isolation: isolate;
    &::before {
      position: absolute;
      inset: 14px 10px auto;
      height: 1px;
      content: "";
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.16), transparent);
      opacity: 0.7;
    }
    &::after {
      position: absolute;
      inset: 0;
      z-index: -1;
      content: "";
      background: transparent;
      opacity: 1;
    }
    .logoBox {
      width: 100%;
      height: fit-content;
      .logo {
        width: 58%;
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
      flex: 1;
      margin-top: 16px;
      margin-bottom: 16px;
      padding-bottom: 16px;
      width: 100%;
      height: 100%;
    }
    .footItem {
      width: 100%;
      height: fit-content;
      .item {
        cursor: pointer;
        width: 48px;
        height: 48px;
        border: 1px solid transparent;
        .icon {
          font-size: 24px;
        }
        &:hover {
            background-color: #202022;
            border-color: #303033;
          border-radius: 12px;
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
  color: var(--td-text-color-secondary);
  transition:
    background 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
  .icon {
    font-size: 24px;
  }
  .title {
    font-size: 10px;
    white-space: nowrap;
    color: var(--td-text-color-primary);
  }
  &:hover {
    color: var(--td-text-color-primary);
    background-color: #202022;
    border-color: #303033;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
    transform: translateY(-1px);
  }
}
.active {
  background: #242426 !important;
  color: #f5f5f5;
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
