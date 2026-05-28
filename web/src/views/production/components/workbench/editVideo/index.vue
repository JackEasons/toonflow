<template>
  <div class="editVideo">
    <splitpanes class="default-theme content" horizontal :push-other-panes="false">
      <pane size="60">
        <splitpanes :push-other-panes="false">
          <pane size="20" min-size="10">
            <mediaLibrary
              :initial-video-items="initialVideoItems"
              :initial-media-items="initialMediaItems"
              :initial-audio-items="initialAudioItems"
              :initial-image-items="initialImageItems" />
          </pane>
          <pane size="60" min-size="20">
            <div ref="previewWrapperRef" class="previewWrapper">
              <videoPreview ref="videoPreviewRef" :canvas-width="canvasWidth" :canvas-height="canvasHeight" :style="previewStyle" />
            </div>
          </pane>
          <pane size="20" min-size="10">
            <propertyPanel />
          </pane>
        </splitpanes>
      </pane>
      <pane size="40" class="pr">
        <VideoTrack
          class="videoTrack"
          ref="videoTrackRef"
          :operation-buttons="operationButtons"
          :scale-config-buttons="scaleConfigButtons"
          :track-types="trackTypes"
          :clip-configs="clipConfigs"
          :enable-main-track-mode="true"
          :enable-cross-track-drag="true"
          :enable-snap="true"
          :default-scale="1"
          @add-transition="handleAddTransitionFromClick"
          @drop-media="handleDropMedia"
          @transition-added="onTransitionAdded">
          <!-- 自定义操作按钮 -->
          <template #custom-operation-reset>
            <t-button variant="text" size="small" @click="videoTrackRef?.reset()" :title="$t('workbench.production.editVideo.reset')">
              <template #icon><i-refresh size="16" /></template>
              {{ $t("workbench.production.editVideo.reset") }}
            </t-button>
          </template>

          <template #custom-operation-undo>
            <t-button
              variant="text"
              size="small"
              :disabled="!historyStore.canUndo"
              @click="historyStore.undo()"
              :title="$t('workbench.production.editVideo.undo')">
              <template #icon><i-undo size="16" /></template>
              {{ $t("workbench.production.editVideo.undo") }}
            </t-button>
          </template>

          <template #custom-operation-redo>
            <t-button
              variant="text"
              size="small"
              :disabled="!historyStore.canRedo"
              @click="historyStore.redo()"
              :title="$t('workbench.production.editVideo.redo')">
              <template #icon><i-redo size="16" /></template>
              {{ $t("workbench.production.editVideo.redo") }}
            </t-button>
          </template>

          <template #custom-operation-split>
            <t-button
              variant="text"
              size="small"
              :disabled="tracksStore.selectedClipIds.size === 0"
              @click="handleSplit"
              :title="$t('workbench.production.editVideo.split')">
              <template #icon><i-cutting-one size="16" /></template>
              {{ $t("workbench.production.editVideo.split") }}
            </t-button>
          </template>

          <template #custom-operation-delete>
            <t-button variant="text" size="small" @click="handleDeleteClips" :title="$t('workbench.production.editVideo.delete')">
              <template #icon><i-delete size="16" /></template>
              {{ $t("workbench.production.editVideo.delete") }}
            </t-button>
          </template>
          <!-- <template #custom-operation-import>
            <t-button variant="text" size="small" @click="handleImport" :title="$t('workbench.production.editVideo.importProject')">
              <template #icon><i-folder-open size="16" /></template>
              {{ $t("workbench.production.editVideo.import") }}
            </t-button>
          </template> -->
          <template #scale-append>
            <t-button theme="danger" @click="handleExport" :loading="isExporting" :title="$t('workbench.production.editVideo.exportProject')">
              <template #icon><i-export size="16" style="margin-right: 4px" /></template>
              {{ isExporting ? $t("workbench.production.editVideo.rendering") : $t("workbench.production.editVideo.exportVideo") }}
            </t-button>
          </template>
        </VideoTrack>
      </pane>
    </splitpanes>
  </div>
</template>

<script setup lang="ts">
import mediaLibrary from "./mediaLibrary.vue";
import videoPreview from "./videoPreview.vue";
import propertyPanel from "./propertyPanel.vue";
import { Splitpanes, Pane } from "splitpanes";
import "vue-clip-track/style.css";
import {
  VideoTrack,
  useTracksStore,
  usePlaybackStore,
  useHistoryStore,
  generateId,
  normalizeTime,
  type OperationButton,
  type ScaleConfigButton,
  type TrackTypeConfig,
  type Track,
  type Clip,
  type MediaClip,
} from "vue-clip-track";

import type { MediaItem, AudioItem } from "./utils/mediaData";
import { getDefaultDuration, findOrCreateTrackWithSpace } from "./utils/trackHelper";
import { loadVideoClipThumbnails, loadAudioClipWaveform, loadInitialAudioWaveforms } from "./utils/mediaLoader";
import { findAdjacentClipsAtTime, addTransitionBetweenClips } from "./utils/transitionHelper";

const props = withDefaults(
  defineProps<{
    initialTracks?: Track[];
    initialVideoItems?: MediaItem[];
    initialMediaItems?: MediaItem[];
    initialAudioItems?: AudioItem[];
    initialImageItems?: MediaItem[];
    canvasWidth?: number;
    canvasHeight?: number;
  }>(),
  {
    initialTracks: () => [],
    initialMediaItems: () => [],
    initialAudioItems: () => [],
    initialImageItems: () => [],
    canvasWidth: 1920,
    canvasHeight: 1080,
  },
);

const aspectRatio = computed(() => props.canvasWidth / props.canvasHeight);

// 预览区域自适应尺寸
const previewWrapperRef = ref<HTMLElement>();
const wrapperSize = reactive({ width: 0, height: 0 });
let resizeObserver: ResizeObserver | null = null;

const previewStyle = computed(() => {
  const { width: cw, height: ch } = wrapperSize;
  if (cw <= 0 || ch <= 0) return {};
  const ratio = aspectRatio.value;
  if (cw / ch > ratio) {
    return { height: ch + "px", width: Math.floor(ch * ratio) + "px" };
  }
  return { width: cw + "px", height: Math.floor(cw / ratio) + "px" };
});

const tracksStore = useTracksStore();
const playbackStore = usePlaybackStore();
const historyStore = useHistoryStore();

const operationButtons = ref<OperationButton[]>([
  { type: "custom", key: "reset" },
  { type: "custom", key: "undo" },
  { type: "custom", key: "redo" },
  { type: "custom", key: "split" },
  { type: "custom", key: "delete" },
  { type: "custom", key: "import" },
]);

const scaleConfigButtons = ref<ScaleConfigButton[]>(["snap"]);

const trackTypes = ref<TrackTypeConfig>({
  video: { max: 5 },
  image: { max: 3 },
  audio: { max: 3 },
  subtitle: { max: 2 },
  text: { max: 2 },
  sticker: { max: 2 },
  filter: { max: 1 },
  effect: { max: 2 },
});

const clipConfigs = ref({
  video: {
    backgroundColor: "linear-gradient(45deg, #1b8f86 0%, #426fd6 100%)",
    borderColor: "rgba(116, 223, 210, 0.42)",
    height: 60,
    selected: {
      borderColor: "#74dfd2",
      boxShadow: "0 0 0 3px rgba(116, 223, 210, 0.22)",
    },
  },
  audio: {
    backgroundColor: "linear-gradient(45deg, #42b9a9 0%, #76a7ff 100%)",
    height: 36,
    selected: {
      borderColor: "#9bbcff",
    },
  },
  image: {
    backgroundColor: "linear-gradient(45deg, #53c592 0%, #38d5c7 100%)",
    borderColor: "#74dfd2",
    height: 60,
    selected: {
      borderColor: "#f07182",
      boxShadow: "0 0 0 3px rgba(240, 113, 130, 0.22)",
    },
  },
});

const videoTrackRef = ref();
const videoPreviewRef = ref<InstanceType<typeof videoPreview>>();
const isExporting = ref(false);

async function handleExport() {
  if (!videoPreviewRef.value) return;
  if (isExporting.value) return;
  isExporting.value = true;
  try {
    await videoPreviewRef.value.exportVideo();
    window.$message.success($t("workbench.production.editVideo.exportSuccess"));
  } catch (error: any) {
    if (error.name === "AbortError") return; // 用户取消保存
    window.$message.error(error.message || $t("workbench.production.editVideo.exportFailed"));
  } finally {
    isExporting.value = false;
  }
}

function handleSplit() {
  const selectedIds = Array.from(tracksStore.selectedClipIds);
  if (selectedIds.length === 0) return;
  const currentTime = playbackStore.currentTime;
  selectedIds.forEach((id) => {
    const clip = tracksStore.getClip(id);
    if (!clip || currentTime <= clip.startTime || currentTime >= clip.endTime) return;
    tracksStore.splitClip(id, currentTime);
  });
  historyStore.pushSnapshot($t("workbench.production.editVideo.splitClip"));
}

function handleDeleteClips() {
  const selectedIds = Array.from(tracksStore.selectedClipIds);
  if (selectedIds.length === 0) return;
  tracksStore.removeClips(selectedIds);
  historyStore.pushSnapshot($t("workbench.production.editVideo.deleteClip"));
}

// 处理从资源库拖拽媒体到轨道
async function handleDropMedia(mediaData: any, trackId: string, startTime: number) {
  try {
    if (mediaData.type === "transition") {
      handleDropTransition(mediaData, trackId, startTime);
      return;
    }

    const duration = getDefaultDuration(mediaData.type, mediaData);
    const { track } = findOrCreateTrackWithSpace(tracksStore, mediaData.type, startTime, duration, trackId);
    if (!track) return;

    let clip: Partial<Clip> = {
      id: generateId("clip-"),
      trackId: track.id,
      startTime: normalizeTime(startTime),
      selected: false,
    };

    if (mediaData.type === "video") {
      const sourceUrl = mediaData.sourceUrl || mediaData.url || mediaData.id;
      clip = {
        ...clip,
        type: "video",
        name: mediaData.name,
        endTime: normalizeTime(startTime + duration),
        sourceUrl,
        originalDuration: duration,
        trimStart: 0,
        trimEnd: duration,
        playbackRate: 1,
        thumbnails: mediaData.thumbnails || [],
      } as Partial<MediaClip>;

      tracksStore.addClip(track.id, clip as Clip);
      historyStore.pushSnapshot($t("workbench.production.editVideo.addClip", { name: mediaData.name }));

      if (!mediaData.thumbnails || mediaData.thumbnails.length === 0) {
        loadVideoClipThumbnails(tracksStore, clip.id!, sourceUrl);
      }
      return;
    } else if (mediaData.type === "image") {
      const sourceUrl = mediaData.sourceUrl || mediaData.url || mediaData.id;
      clip = {
        ...clip,
        type: "image" as any,
        name: mediaData.name,
        endTime: normalizeTime(startTime + duration),
        sourceUrl,
        originalDuration: duration,
        trimStart: 0,
        trimEnd: duration,
        playbackRate: 1,
        thumbnails: mediaData.thumbnail ? [mediaData.thumbnail] : [],
      };

      tracksStore.addClip(track.id, clip as Clip);
      historyStore.pushSnapshot($t("workbench.production.editVideo.addClip", { name: mediaData.name }));
      return;
    } else if (mediaData.type === "audio") {
      const sourceUrl = mediaData.sourceUrl || mediaData.url || mediaData.id;
      clip = {
        ...clip,
        type: "audio",
        name: mediaData.name,
        endTime: normalizeTime(startTime + duration),
        sourceUrl,
        originalDuration: duration,
        trimStart: 0,
        trimEnd: duration,
        playbackRate: 1,
        volume: 1,
        waveformData: mediaData.waveformData || [],
      } as Partial<MediaClip>;

      tracksStore.addClip(track.id, clip as Clip);
      historyStore.pushSnapshot($t("workbench.production.editVideo.addClip", { name: mediaData.name }));

      if (!mediaData.waveformData || mediaData.waveformData.length === 0) {
        loadAudioClipWaveform(tracksStore, clip.id!, sourceUrl);
      }
      return;
    } else if (mediaData.type === "subtitle") {
      clip = {
        ...clip,
        type: "subtitle",
        name: mediaData.name,
        endTime: normalizeTime(startTime + duration),
        text: $t("workbench.production.editVideo.sampleSubtitle"),
      };
    } else if (mediaData.type === "text") {
      clip = {
        ...clip,
        type: "text",
        name: mediaData.name,
        endTime: normalizeTime(startTime + duration),
        text: $t("workbench.production.editVideo.customText"),
      };
    } else if (mediaData.type === "sticker") {
      clip = { ...clip, type: "sticker", name: mediaData.name, endTime: normalizeTime(startTime + duration), sourceUrl: mediaData.id };
    } else if (mediaData.type === "filter") {
      clip = {
        ...clip,
        type: "filter",
        name: mediaData.name,
        endTime: normalizeTime(startTime + duration),
        filterType: mediaData.filterType || mediaData.id,
        filterValue: mediaData.filterValue ?? 1,
      };
    } else if (mediaData.type === "effect") {
      clip = {
        ...clip,
        type: "effect",
        name: mediaData.name,
        endTime: normalizeTime(startTime + duration),
        effectType: mediaData.effectType || mediaData.id,
        effectDuration: duration,
      };
    }

    tracksStore.addClip(track.id, clip as Clip);
    historyStore.pushSnapshot($t("workbench.production.editVideo.addClip", { name: mediaData.name }));
  } catch (error: any) {
    alert(error.message);
  }
}

// 处理转场拖拽
function handleDropTransition(transitionData: any, trackId: string, dropTime: number) {
  const track = tracksStore.tracks.find((t) => t.id === trackId);
  if (!track) return;

  const clips = track.clips.filter((c) => c.type !== "transition").sort((a, b) => a.startTime - b.startTime);
  if (clips.length === 0) {
    window.$message.warning($t("workbench.production.editVideo.transitionBetweenClips"));
    return;
  }

  const result = findAdjacentClipsAtTime(clips, dropTime);
  if (!result) {
    window.$message.warning($t("workbench.production.editVideo.transitionBetweenClips"));
    return;
  }

  applyTransition(result.beforeClip.id, result.afterClip.id, transitionData.subType);
}

function handleAddTransitionFromClick(beforeClipId: string, afterClipId: string) {
  applyTransition(beforeClipId, afterClipId, "fade");
}

// 添加转场并触发后续事件
function applyTransition(beforeClipId: string, afterClipId: string, transitionType: string = "fade") {
  const result = addTransitionBetweenClips(tracksStore, historyStore, beforeClipId, afterClipId, transitionType);
  if (result) {
    if (videoTrackRef.value) {
      videoTrackRef.value.emitTransitionAdded(result.transitionClip, result.beforeClip.id, result.afterClip.id);
    }
  }
}

function onTransitionAdded(transitionClip: any, beforeClipId: string, afterClipId: string) {
  window.$message.success($t("workbench.production.editVideo.transitionAdded", { name: transitionClip.name }));
  playbackStore.seekTo(transitionClip.startTime);
}

// 初始化轨道数据
function initializeTracks() {
  tracksStore.reset();

  if (props.initialTracks.length > 0) {
    props.initialTracks.forEach((track) => {
      tracksStore.addTrack(track);
    });
  }

  playbackStore.setDuration(60 * 5);
  playbackStore.seekTo(0);
  historyStore.initialize();
  loadInitialAudioWaveforms(tracksStore);
}

onMounted(() => {
  initializeTracks();

  if (previewWrapperRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        wrapperSize.width = entry.contentRect.width;
        wrapperSize.height = entry.contentRect.height;
      }
    });
    resizeObserver.observe(previewWrapperRef.value);
  }
});

onUnmounted(() => {
  playbackStore.pause();
  resizeObserver?.disconnect();
});
</script>

<style lang="scss" scoped>
.editVideo {
  .content {
    height: calc(100vh - var(--td-comp-paddingTB-xl) * 2 - 50px - 16px);
    gap: 10px;
  }

  .previewWrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: var(--wb-panel, var(--td-bg-color-secondarycontainer));
    border: 1px solid var(--wb-border-strong, var(--td-border-level-1-color));
    border-radius: 10px;
    box-shadow: var(--wb-shadow, none);
    backdrop-filter: blur(10px) saturate(118%);
  }
  .videoTrack {
    height: 100%;
    border: 1px solid var(--wb-border-strong, var(--td-border-level-1-color));
    border-radius: 10px;
    overflow: hidden;
    background: var(--wb-panel, var(--td-bg-color-secondarycontainer));
    box-shadow: var(--wb-shadow, none);
  }
}
:deep(.ruler__cursor-handle) {
  &:hover {
    filter: none !important;
  }
}
:deep(.splitpanes__pane) {
  background-color: transparent !important;
}
:deep(.splitpanes__splitter) {
  border: none !important;
  margin: 0px !important;
}
:deep(.tools-bar__select) {
  display: none !important;
}
:deep(.video-track) {
  --theme-hue: 174;
  --theme-saturation: 64%;
  --theme-lightness: 66%;
  --color-primary: var(--wb-accent, #74dfd2);
  --color-primary-hover: #91f2e8;
  --color-primary-active: #42b9a9;
  --color-bg-dark: rgba(4, 12, 11, 0.92);
  --color-bg-medium: rgba(8, 20, 18, 0.9);
  --color-bg-light: rgba(22, 45, 41, 0.72);
  --color-bg-lighter: rgba(34, 67, 61, 0.82);
  --color-bg-elevated: rgba(7, 18, 16, 0.88);
  --color-border: var(--wb-border, rgba(118, 218, 204, 0.16));
  --color-border-light: rgba(118, 218, 204, 0.24);
  --color-border-strong: var(--wb-border-strong, rgba(118, 218, 204, 0.32));
  --color-text-primary: var(--wb-text, var(--td-text-color-primary));
  --color-text-secondary: var(--wb-text-secondary, var(--td-text-color-secondary));
  --color-text-tertiary: var(--wb-text-muted, var(--td-text-color-placeholder));
  --shadow-sm: 0 6px 16px rgba(0, 0, 0, 0.22);
  --shadow-md: 0 10px 24px rgba(0, 0, 0, 0.28);
  --shadow-lg: 0 16px 34px rgba(0, 0, 0, 0.36);
  background: transparent;

  .ruler {
    background: rgba(5, 13, 12, 0.92);
    border-bottom-color: var(--wb-border, rgba(118, 218, 204, 0.16));

    .ruler__placeholder {
      background: rgba(5, 13, 12, 0.92);
      border-right: 1px solid var(--wb-border, rgba(118, 218, 204, 0.16));
    }

    .ruler__mark {
      background: rgba(118, 218, 204, 0.16);
    }

    .ruler__mark--major {
      background: rgba(118, 218, 204, 0.28);
    }

    .ruler__cursor-line {
      background: var(--wb-accent, #74dfd2);
      box-shadow: 0 0 12px rgba(116, 223, 210, 0.32);
    }
  }
  .track-control {
    background: rgba(6, 17, 15, 0.94);
    border-right-color: var(--wb-border, rgba(118, 218, 204, 0.16));

    .track-control__badge {
      color: #051311;
      background: linear-gradient(135deg, var(--wb-accent, #74dfd2), var(--wb-accent-2, #9bbcff));
    }

    .track-control__btn:hover {
      background: rgba(118, 218, 204, 0.12);
    }
  }
  .tools-bar {
    background: rgba(6, 17, 15, 0.94);
    border-bottom-color: var(--wb-border, rgba(118, 218, 204, 0.16));
  }
  .tools-bar__time {
    background: rgba(230, 255, 251, 0.055);
    border-color: var(--wb-border, rgba(118, 218, 204, 0.16));
  }
  .tools-bar__btn {
    background: rgba(230, 255, 251, 0.045);
    border-color: rgba(118, 218, 204, 0.12);
    &:hover {
      background: rgba(118, 218, 204, 0.12);
      box-shadow: none;
    }
  }

  .tools-bar__btn--play,
  .tools-bar__btn--active {
    color: #051311;
    background: linear-gradient(135deg, var(--wb-hot, #f07182), #f39ba8);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .video-track__body,
  .tracks,
  .tracks__table,
  .tracks__scroll-container {
    background: rgba(5, 13, 12, 0.72);
  }

  .tracks__track {
    background: rgba(12, 28, 25, 0.54);
    border-bottom-color: rgba(118, 218, 204, 0.1);
  }

  .tracks__track:nth-child(even) {
    background: rgba(18, 39, 35, 0.5);
  }

  .tracks__track-control-cell,
  .tracks__track-area-cell {
    border-color: rgba(118, 218, 204, 0.1);
  }

  .track-area__content {
    background-image:
      linear-gradient(90deg, rgba(118, 218, 204, 0.045) 1px, transparent 1px),
      linear-gradient(rgba(118, 218, 204, 0.03) 1px, transparent 1px);
    background-size:
      54px 100%,
      100% 44px;
  }

  .clip {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
  }

  .clip--selected {
    box-shadow: 0 0 0 2px rgba(116, 223, 210, 0.28), 0 12px 24px rgba(0, 0, 0, 0.3);
  }

  .tracks__scrollbar {
    background: rgba(5, 13, 12, 0.92);
    border-top: 1px solid var(--wb-border, rgba(118, 218, 204, 0.16));
  }
}
</style>
