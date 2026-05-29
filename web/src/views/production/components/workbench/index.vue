<template>
  <t-dialog
    body="String"
    :header="false"
    :footer="false"
    :closeBtn="false"
    v-model:visible="visible"
    attach="body"
    placement="center"
    mode="full-screen"
    dialogClassName="noFooter workbenchDialog"
    class="workbenchDialogHost">
    <div class="workbenchShell">
      <div class="closure">
        <i-close-small theme="outline" size="24" fill="currentColor" @click="visible = false" />
      </div>
      <div class="topMenu f ac">
        <t-tooltip :content="$t('workbench.production.wb.quickPreview')" placement="bottom" theme="primary" destroyOnClose :showArrow="false">
          <div class="item fc c" :class="{ active: activeMenu === 'preview' }" @click="changeMenu('preview')">
            <i-blackboard class="icon" />
          </div>
        </t-tooltip>
        <t-tooltip :content="$t('workbench.production.wb.videoGeneration')" placement="bottom" theme="primary" destroyOnClose :showArrow="false">
          <div class="item fc c" :class="{ active: activeMenu === 'generate' }" @click="changeMenu('generate')">
            <i-playback-progress class="icon" />
          </div>
        </t-tooltip>
        <t-tooltip :content="$t('workbench.production.wb.videoEditing')" placement="bottom" theme="primary" destroyOnClose :showArrow="false">
          <div class="item fc c" :class="{ active: activeMenu === 'editVideo' }" @click="changeMenu('editVideo')">
            <i-editing class="icon" />
          </div>
        </t-tooltip>
      </div>
      <div class="content">
        <preview v-if="activeMenu === 'preview'" />
        <generate v-if="activeMenu === 'generate'" @importVideo="handleBatchDownload" v-model="extractLines" />
        <editVideo
          v-if="activeMenu === 'editVideo'"
          :initial-tracks="mockTracks"
          :initial-video-items="initialVideoItems"
          :initial-media-items="mockMediaItems"
          :initial-audio-items="mockAudioItems"
          :initial-image-items="mockImageItems"
          :canvas-width="canvasWidth"
          :canvas-height="canvasHeight"
          ref="editVideoRef" />
      </div>
      <div v-if="importLoading" class="importLoadingMask">
        <div class="importLoadingContent">
          <t-loading size="large" :text="$t('workbench.production.wb.importingLoading')" />
        </div>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { inject, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import type { Ref } from "vue";
import axios from "#/utils/axios";
import preview from "./preview.vue";
import generate from "./generate/index.vue";
import editVideo from "./editVideo/index.vue";
import { generateId, type Track } from "vue-clip-track";
import type { MediaItem, AudioItem } from "./editVideo/utils/mediaData";
import projectStore from "#/stores/project";
const { project } = storeToRefs(projectStore());

const visible = defineModel("visible", {
  type: Boolean,
  default: false,
});
const activeMenu = ref("preview");

// 画布尺寸配置
const canvasWidth = ref(1920);
const canvasHeight = ref(1080);

onMounted(() => {
  const size = project.value?.videoRatio;
  if (size == "16:9") {
    canvasWidth.value = 1920;
    canvasHeight.value = 1080;
  } else if (size == "1:1") {
    canvasWidth.value = 1080;
    canvasHeight.value = 1080;
  } else if (size == "9:16") {
    canvasWidth.value = 1080;
    canvasHeight.value = 1920;
  }
});

// ============ 演示数据（可替换为在线资源地址） ============

/** 资源库 - 分镜视频 */
const initialVideoItems = ref<MediaItem[]>([]);

/** 资源库 - 视频素材 */
const mockMediaItems = ref<MediaItem[]>([]);

/** 资源库 - 音频素材 */
const mockAudioItems = ref<AudioItem[]>([]);

/** 资源库 - 图片素材 */
const mockImageItems = ref<MediaItem[]>([]);

const extractLines = ref(false);
const importLoading = ref(false);

onMounted(() => {
  editFootage();
});
type MediaType = "image" | "video" | "audio" | "unknown";
type ImportVideoItem = {
  trackId: number;
  videoId: number;
  src: string;
  duration: number;
};

function getMediaType(src?: string): MediaType {
  if (!src) return "unknown";
  const ext = src.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
  if (["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "aac", "flac", "m4a"].includes(ext)) return "audio";
  return "unknown";
}
//切换菜单
function changeMenu(type: string) {
  activeMenu.value = type;
  if (type == "editVideo") editFootage();
}
const episodesId = inject<Ref<number>>("episodesId")!;
//查询剪辑素材
function editFootage() {
  axios
    .post("/assets/getMaterialData", {
      projectId: project.value?.id,
      scriptId: episodesId.value ?? 0,
    })
    .then(({ data }) => {
      const videoList = data.data.filter((item: any) => getMediaType(item.filePath) === "video");
      const audioList = data.data.filter((item: any) => getMediaType(item.filePath) === "audio");
      const imageList = data.data.filter((item: any) => getMediaType(item.filePath) === "image");
      initialVideoItems.value = data.video.flatMap((item: any, index: number) => {
        if (Array.isArray(item.video)) {
          return item.video.map((subItem: any, subIndex: number) => ({
            id: `video-${subItem.id}`,
            type: "video",
            name: "#" + $t("workbench.production.wb.storyboardVideoName", { storyboard: index + 1, id: subIndex + 1 }),
            duration: subItem.duration || 0,
            icon: "🎬",
            color: "linear-gradient(135deg, #1b8f86 0%, #426fd6 100%)",
            url: subItem.filePath,
            selected: item.videoId == subItem.id ? true : false,
          }));
        }
      });
      mockMediaItems.value = videoList.map((item: any) => ({
        id: `video-${item.id}`,
        type: "video",
        name: item.name,
        duration: item.duration || 0,
        icon: "🎥",
        color: "linear-gradient(135deg, #1b8f86 0%, #426fd6 100%)",
        url: item.filePath,
        loading: true,
      }));
      mockAudioItems.value = audioList.map((item: any) => ({
        id: `audio-${item.id}`,
        type: "audio",
        name: item.name,
        duration: item.duration || 0,
        url: item.filePath,
        loading: true,
      }));
      mockImageItems.value = imageList.map((item: any) => ({
        id: `image-${item.id}`,
        type: "image",
        name: item.name,
        duration: item.duration || 5,
        icon: "🖼️",
        color: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        url: item.filePath,
        loading: true,
      }));
    });
}

function createDemoTracks(): Track[] {
  const createTrack = (type: Track["type"], name: string, order: number, isMain: boolean = false): Track => ({
    id: generateId("track-"),
    type,
    name,
    visible: true,
    locked: false,
    clips: [],
    order,
    ...(isMain && { isMain }),
  });
  return [
    createTrack("video", "主轨道", 0, true),
    createTrack("audio", "音频", 2),
    createTrack("subtitle", "字幕", 3),
    createTrack("filter", "滤镜", 4),
  ];
}

const mockTracks = createDemoTracks();

//导入到剪辑台
function handleBatchDownload(value: ImportVideoItem[]) {}
</script>

<style lang="scss" scoped>
:deep(.t-dialog__body) {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  position: relative;
}
.workbenchShell {
  --wb-bg: #061311;
  --wb-panel: linear-gradient(180deg, rgba(8, 23, 20, 0.96), rgba(4, 12, 11, 0.98));
  --wb-panel-strong: linear-gradient(180deg, rgba(10, 28, 25, 0.98), rgba(5, 15, 13, 0.98));
  --wb-panel-soft: rgba(10, 34, 30, 0.64);
  --wb-panel-flat: rgba(6, 18, 16, 0.92);
  --wb-control: rgba(230, 255, 251, 0.06);
  --wb-control-hover: rgba(112, 224, 210, 0.12);
  --wb-border: rgba(118, 218, 204, 0.18);
  --wb-border-strong: rgba(118, 218, 204, 0.32);
  --wb-text: rgba(245, 252, 249, 0.94);
  --wb-text-secondary: rgba(219, 238, 232, 0.68);
  --wb-text-muted: rgba(219, 238, 232, 0.42);
  --wb-accent: #74dfd2;
  --wb-accent-2: #9bbcff;
  --wb-hot: #f07182;
  --wb-shadow: 0 18px 46px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  --td-bg-color-container: var(--wb-panel-flat);
  --td-bg-color-container-hover: var(--wb-control-hover);
  --td-bg-color-secondarycontainer: rgba(5, 15, 13, 0.94);
  --td-bg-color-component: rgba(22, 45, 41, 0.72);
  --td-border-level-1-color: var(--wb-border);
  --td-border-level-2-color: var(--wb-border-strong);
  --td-text-color-primary: var(--wb-text);
  --td-text-color-secondary: var(--wb-text-secondary);
  --td-text-color-placeholder: var(--wb-text-muted);
  --td-brand-color: var(--wb-accent);
  --td-brand-color-hover: #91f2e8;
  --td-brand-color-active: #42b9a9;
  --td-brand-color-light: rgba(116, 223, 210, 0.12);
  --td-scrollbar-color: rgba(118, 218, 204, 0.34);
  --td-mask-active: rgba(1, 6, 6, 0.72);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: relative;
  color: var(--wb-text);
  background:
    radial-gradient(circle at 16% 8%, rgba(116, 223, 210, 0.1), transparent 28%),
    radial-gradient(circle at 82% 22%, rgba(155, 188, 255, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(6, 19, 17, 0.98), rgba(4, 11, 10, 0.98));

  .importLoadingMask {
    position: absolute;
    inset: 0;
    background: var(--td-mask-active);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
    .importLoadingContent {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
  }
  .closure {
    position: absolute;
    top: var(--td-comp-paddingTB-xl);
    right: var(--td-comp-paddingLR-xxl);
    z-index: 9999;
    cursor: pointer;
    margin-top: 20px;
    color: var(--wb-text-muted);
    transition: color 0.18s ease;

    &:hover {
      color: var(--wb-text);
    }
  }
  .topMenu {
    padding-bottom: 16px;
    width: fit-content;
    margin-top: 10px;
    .item {
      margin-right: 4px;
      cursor: pointer;
      width: 50px;
      height: 50px;
      color: var(--wb-text-muted);
      border: 1px solid transparent;
      border-radius: 16px;
      transition:
        color 0.18s ease,
        background 0.18s ease,
        border-color 0.18s ease,
        box-shadow 0.18s ease;
      .icon {
        font-size: 24px;
      }
      .title {
        font-size: 10px;
        white-space: nowrap;
      }
      &:hover {
        color: var(--wb-text);
        background: var(--wb-control-hover);
        border-color: var(--wb-border);
      }
    }
    .active {
      background: linear-gradient(135deg, var(--wb-hot), #f39ba8) !important;
      border-radius: 16px;
      color: #ffffff;
      border-color: rgba(255, 255, 255, 0.16);
      box-shadow: 0 12px 26px rgba(240, 113, 130, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.28);
    }
  }
  .content {
    flex: 1;
    overflow: hidden;
    position: relative;
    padding: 0 8px 8px;
    background:
      radial-gradient(circle at 16% 8%, rgba(116, 223, 210, 0.1), transparent 28%),
      radial-gradient(circle at 82% 22%, rgba(155, 188, 255, 0.08), transparent 28%),
      linear-gradient(180deg, rgba(6, 19, 17, 0.78), rgba(4, 11, 10, 0.92));
  }
  .editImage {
    width: 100%;
    height: 75vh;
  }
}
</style>

<style lang="scss">
.workbenchDialog {
  color: rgba(245, 252, 249, 0.94);
  background:
    radial-gradient(circle at 16% 8%, rgba(116, 223, 210, 0.1), transparent 28%),
    radial-gradient(circle at 82% 22%, rgba(155, 188, 255, 0.08), transparent 28%),
    linear-gradient(180deg, rgba(6, 19, 17, 0.98), rgba(4, 11, 10, 0.98)) !important;

  .t-dialog__body,
  .t-dialog__body--fullscreen--without-footer {
    padding: 0 !important;
    background: transparent !important;
  }

  .t-dialog__wrap {
    padding: 0 !important;
    overflow: hidden !important;
  }
}
</style>
