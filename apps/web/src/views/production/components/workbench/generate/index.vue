<template>
  <div class="index fc">
    <div class="referenceImage">
      <div class="uploadBtn">
        <imageSelect :mode="modelParmas.mode as VideoMode" v-model="imageList" :storyboard-list="storyboardList" />
      </div>
    </div>
    <div class="modelSelect">
      <modeMenu v-model="modelParmas" :modeOptions="modeOptions" :trackId="currentTrack?.id" :modeList="modeList" @modeChange="modeChange" />
    </div>
    <div class="generate ac">
      <div class="prompt" v-if="currentTrack">
        <t-card :title="'#' + (activeTrackIndex + 1) + $t('workbench.generate.generateText')" header-bordered class="videoPrompt">
          <template #actions>
            <t-button size="small" class="genTextbtn" :loading="activeTrackGenTextLoading || singlePromptQuoteLoading" :disabled="singlePromptGenerateDisabled" @click="genText">
              {{ singlePromptGenerateLabel }}
            </t-button>
          </template>
          <div class="promptData fc">
            <div class="promptInput" @focusout="handlePromptBlur">
              <promptEditor v-model="currentTrack.prompt" :references="references" reference-token="参考" :placeholder="$t('workbench.generate.promptPlaceholder')" />
            </div>
          </div>
        </t-card>
      </div>
      <div class="video">
        <videoCard
          v-if="currentTrack"
          :active-track-index="activeTrackIndex"
          :generate-disabled="singleVideoGenerateDisabled"
          :generate-label="singleVideoGenerateLabel"
          :quote-loading="singleVideoQuoteLoading"
          v-model:current-track="currentTrack"
          @refresh="getGenerateData"
          @generate="generateVideo" />
      </div>
    </div>
    <div class="track">
      <newTrack
        v-model:activeTrackIndex="activeTrackIndex"
        v-model:genTextLoadingMap="genTextLoadingMap"
        v-model="trackList"
        :image-list="imageList"
        @change="trackChange"
        :modelParmas="modelParmas"
        :clampDuration="clampDuration"
        @getData="getGenerateData" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from "vue";
import { DialogPlugin } from "tdesign-vue-next";
import { storeToRefs } from "pinia";
import type { Ref } from "vue";
import newTrack from "./components/track.vue";
import imageSelect from "./components/imageSelect.vue";
import modeMenu from "./components/modeMenu.vue";
import videoCard from "./components/video.vue";
import "#/views/production/components/workbench/type/type";
import axios from "#/utils/axios";
import projectStore from "#/stores/project";
import promptEditor from "#/components/promptEditor.vue";
import imageListCacheStore from "#/stores/imageListCache";
import {
  buildPromptSourceInfoForMode,
  buildVideoReferenceInfoForMode,
  orderUploadItemsForMode,
  type PromptSourceInfo,
} from "./utils/videoUploadSources";
import {
  getFirstEnabledVideoModeValue,
  isVideoModeOptionDisabled,
  withVideoModePolicy,
  type VideoModeOption,
} from "#/utils/videoModePolicy";

const { project } = storeToRefs(projectStore());
const episodesId = inject<Ref<number>>("episodesId")!;
const activeTrackIndex = ref(0);
const cacheStore = imageListCacheStore();
const { getCache, setCache, removeCache, initCacheFromTrackList, warmUpUrls } = cacheStore;
const { urlMap } = storeToRefs(cacheStore);

const modeOptions = ref<VideoModel>({
  name: "",
  modelName: "",
  durationResolutionMap: [],
  audio: false,
  type: "video",
  mode: [],
}); // 当前模型配置

const trackList = ref<TrackItem[]>([]); // 轨道列表

const modelParmas = ref<ModelSetting>({
  mode: "",
  model: "",
  resolution: "480p",
  duration: 8,
  audio: false,
});

interface BillingQuote {
  availablePoints: number;
  enough: boolean;
  requiredPoints: number;
}

const storyboardList = ref<StoryboardItem[]>([]); // 分镜列表

const imageList = computed({
  get(): UploadItem[] {
    // 触发对 urlMap 的依赖追踪，当 warmUpUrls 更新 urlMap 后自动重新计算
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    urlMap.value;
    const trackId = currentTrack.value?.id;
    const pid = project.value?.id;
    const sid = episodesId.value;
    // 优先从缓存读取
    if (pid != null && sid != null && trackId != null) {
      const cached = getCache(pid, sid, trackId);

      if (cached?.length) {
        return orderUploadItemsForMode(cached, modelParmas.value.mode);
      }
    }
    const medias = currentTrack.value?.medias;
    if (!medias?.length) return [];

    return orderUploadItemsForMode(medias as UploadItem[], modelParmas.value.mode);
  },
  set(val: UploadItem[]) {
    if (currentTrack.value) {
      currentTrack.value.medias = val as any;
      // 同步写入缓存
      const pid = project.value?.id;
      const sid = episodesId.value;
      const trackId = currentTrack.value.id;
      if (pid != null && sid != null && trackId != null) {
        setCache(pid, sid, trackId, val);
      }
    }
  },
});

function modeChange(newVal: string) {
  if (isVideoModeOptionDisabled(newVal)) return;
  if (newVal == modelParmas.value.mode) return;
  if ((imageList.value.length || currentTrack.value?.prompt) && modelParmas.value.mode) {
    const dialog = DialogPlugin.confirm({
      header: $t("workbench.generate.modeChange"),
      body: $t("workbench.generate.modeChangeConfirm"),
      confirmBtn: $t("settings.generate.modelChnageSure"),
      cancelBtn: $t("settings.memory.msg.cancel"),
      onConfirm: async () => {
        imageList.value = [];
        currentTrack.value.prompt = "";
        dialog.destroy();
        modelParmas.value.mode = newVal;
      },
    });
  } else if (newVal) {
    modelParmas.value.mode = newVal;
  }
}
const modeList = computed<VideoModeOption[]>(() => {
  const modeLabelMap: Record<string, string> = {
    singleImage: "单图",
    startEndRequired: "首尾帧",
    endFrameOptional: "尾帧可选",
    startFrameOptional: "首帧可选",
    text: "文本生视频",
    videoReference: "视频",
    imageReference: "图片",
    audioReference: "音频",
    textReference: "文本",
  };
  function parseRefLabel(m: string): string {
    const match = m.match(/^(videoReference|imageReference|audioReference|textReference):(\d+)$/);
    if (match) {
      const base = modeLabelMap[match[1]] || match[1];
      return `${base} ×${match[2]}`;
    }
    return modeLabelMap[m] || m;
  }
  return modeOptions.value.mode
    ? modeOptions.value.mode
        .map((mode) =>
          Array.isArray(mode)
            ? { value: JSON.stringify(mode), label: mode.map((m) => parseRefLabel(m)).join(" + ") + "参考" }
            : { value: mode, label: modeLabelMap[mode] || mode },
        )
        .map(withVideoModePolicy)
    : [];
});
const currentTrack = computed({
  get() {
    return trackList.value[activeTrackIndex.value];
  },
  set(val) {
    trackList.value[activeTrackIndex.value] = val;
  },
});

const singleVideoQuote = ref<BillingQuote | null>(null);
const singleVideoQuoteError = ref("");
const singleVideoQuoteLoading = ref(false);
let singleVideoQuoteSeq = 0;
const singlePromptQuote = ref<BillingQuote | null>(null);
const singlePromptQuoteError = ref("");
const singlePromptQuoteLoading = ref(false);
let singlePromptQuoteSeq = 0;

function formatBillingPoints(value?: number) {
  const points = Math.max(0, Number(value || 0));
  return Number.isInteger(points) ? String(points) : points.toFixed(2);
}

const singleVideoGenerateLabel = computed(() => {
  const base = $t("workbench.generate.generate");
  if (!modelParmas.value.model) return `${base} · 选择模型`;
  if (singleVideoQuoteError.value) return `${base} · 报价不可用`;
  const points = singleVideoQuote.value?.requiredPoints || 0;
  return points > 0 ? `${base} · ${formatBillingPoints(points)}积分` : base;
});

const singleVideoGenerateDisabled = computed(() => {
  return !modelParmas.value.model || Boolean(singleVideoQuoteError.value) || Boolean(singleVideoQuote.value && !singleVideoQuote.value.enough);
});

const singlePromptGenerateLabel = computed(() => {
  const base = $t("workbench.generate.generateText");
  if (singlePromptQuoteError.value) return `${base} · 报价不可用`;
  const points = singlePromptQuote.value?.requiredPoints || 0;
  return points > 0 ? `${base} · ${formatBillingPoints(points)}积分` : base;
});

const singlePromptGenerateDisabled = computed(() => {
  return !currentTrack.value?.id || singlePromptQuoteLoading.value || Boolean(singlePromptQuoteError.value) || Boolean(singlePromptQuote.value && !singlePromptQuote.value.enough);
});

function getBillingErrorMessage(error: unknown) {
  return (error as any)?.message || "获取积分报价失败";
}

async function refreshSingleVideoQuote() {
  const model = modelParmas.value.model;
  if (!model) {
    singleVideoQuote.value = null;
    singleVideoQuoteError.value = "";
    return;
  }
  const seq = ++singleVideoQuoteSeq;
  singleVideoQuoteLoading.value = true;
  try {
    const { data } = await axios.post("/billing/quote", {
      calls: [
        {
          audio: Boolean(modelParmas.value.audio),
          count: 1,
          duration: modelParmas.value.duration,
          model,
          modelType: "video",
          resolution: modelParmas.value.resolution,
          taskType: "video_generation",
        },
      ],
    });
    if (seq === singleVideoQuoteSeq) {
      singleVideoQuote.value = data;
      singleVideoQuoteError.value = "";
    }
  } catch (error) {
    if (seq === singleVideoQuoteSeq) {
      singleVideoQuote.value = null;
      singleVideoQuoteError.value = getBillingErrorMessage(error);
    }
  } finally {
    if (seq === singleVideoQuoteSeq) singleVideoQuoteLoading.value = false;
  }
}

async function refreshSinglePromptQuote() {
  if (!currentTrack.value?.id) {
    singlePromptQuote.value = null;
    singlePromptQuoteError.value = "";
    return;
  }
  const seq = ++singlePromptQuoteSeq;
  singlePromptQuoteLoading.value = true;
  try {
    const { data } = await axios.post("/billing/quote", {
      calls: [
        {
          count: 1,
          model: "universalAi",
          modelType: "text",
          taskType: "video_prompt_generation",
        },
      ],
    });
    if (seq === singlePromptQuoteSeq) {
      singlePromptQuote.value = data;
      singlePromptQuoteError.value = "";
    }
  } catch (error) {
    if (seq === singlePromptQuoteSeq) {
      singlePromptQuote.value = null;
      singlePromptQuoteError.value = getBillingErrorMessage(error);
    }
  } finally {
    if (seq === singlePromptQuoteSeq) singlePromptQuoteLoading.value = false;
  }
}

watch(
  () => [modelParmas.value.model, modelParmas.value.duration, modelParmas.value.resolution, modelParmas.value.audio],
  () => refreshSingleVideoQuote(),
  { immediate: true },
);
watch(
  () => currentTrack.value?.id,
  () => refreshSinglePromptQuote(),
  { immediate: true },
);
/** 当前轨道是否正在生成提示词 */
const activeTrackGenTextLoading = computed(() => {
  const trackId = trackList.value[activeTrackIndex.value]?.id;
  return trackId != null ? !!genTextLoadingMap.value[trackId] : false;
});
/** 将时长限制在模型支持的范围内 */
function clampDuration(trackDuration: number): number {
  const drMap = modeOptions.value?.durationResolutionMap;
  if (Array.isArray(drMap) && drMap.length > 0 && drMap[0].duration?.length) {
    const durations = drMap[0].duration;
    return Math.max(Math.min(...durations), Math.min(trackDuration, Math.max(...durations)));
  }
  return trackDuration;
}
watch(
  () => modelParmas.value.model,
  (val) => {
    if (!val) {
      modeOptions.value = {
        name: "",
        modelName: "",
        durationResolutionMap: [],
        audio: false,
        type: "video",
        mode: [],
      };
      modelParmas.value.mode = "";
      return;
    }
    axios
      .post("/modelSelect/getModelDetail", { modelId: val })
      .then(({ data }) => {
        modeOptions.value = data;
        modelParmas.value.audio = data.audio === true || data.audio === "true" || data.audio == "optional";
        const drMap = data.durationResolutionMap;
        if (Array.isArray(drMap) && drMap.length > 0) {
          if (drMap[0].resolution?.length) modelParmas.value.resolution = drMap[0].resolution[0];
          if (drMap[0].duration?.length) modelParmas.value.duration = clampDuration(modelParmas.value.duration);
        }

        const selectableModes = data.mode.filter((m: VideoMode) => !isVideoModeOptionDisabled(modeToKey(m)));
        const currentParsed = parseMode(modelParmas.value.mode);
        const modeMatched =
          currentParsed !== null &&
          selectableModes.some((m: VideoMode) => {
            if (Array.isArray(m) && Array.isArray(currentParsed)) {
              return JSON.stringify(m) === JSON.stringify(currentParsed);
            }
            return m == currentParsed;
          });
        if (!modeMatched) {
          const newMode = getFirstEnabledVideoModeValue(selectableModes.map((m: VideoMode) => withVideoModePolicy({ value: modeToKey(m), label: "" })));
          if (isVideoModeOptionDisabled(modelParmas.value.mode)) {
            modelParmas.value.mode = newMode;
          } else if (newMode) {
            modeChange(newMode);
          } else {
            modelParmas.value.mode = "";
          }
        }
      })
      .catch((error) => {
        modeOptions.value = {
          name: "",
          modelName: "",
          durationResolutionMap: [],
          audio: false,
          type: "video",
          mode: [],
        };
        modelParmas.value.mode = "";
        window.$message.error(getBillingErrorMessage(error));
      });
  },
);
function parseMode(value: string): VideoMode | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as ReferenceType[];
  } catch {
    return value as Exclude<VideoMode, ReferenceType[]>;
  }
  return value as Exclude<VideoMode, ReferenceType[]>;
}

function modeToKey(mode: VideoMode): string {
  return Array.isArray(mode) ? JSON.stringify(mode) : mode;
}
/** uploadBox 作为 promptEditor 的引用预览 */
const references = computed(() => {
  function getFileTypeByExt(src: string | undefined): "image" | "video" | "audio" {
    const ext = src?.split(".").pop()?.toLowerCase() ?? "";
    if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return "video";
    if (["mp3", "wav", "ogg", "aac", "flac", "m4a"].includes(ext)) return "audio";
    return "image";
  }

  const referenceItems = currentTrack.value?.promptReferences?.length ? currentTrack.value.promptReferences : imageList.value;
  return referenceItems.map((item) => {
    const name =
      (item as any).name ||
      (item as any).label ||
      ((item as any).sources === "storyboard" && (item as any).index != null ? `分镜图${Number((item as any).index) + 1}` : "");
    if (!item.src) {
      return {
        name,
        type: "text" as const,
        src: item.prompt ?? "",
      };
    }
    return {
      name,
      type: (item.fileType || getFileTypeByExt(item.src)) as "image" | "video" | "audio",
      src: item.src,
    };
  });
});

async function getGenerateData() {
  const { data } = await axios.post("/production/workbench/getGenerateData", {
    projectId: project.value?.id,
    scriptId: episodesId.value ?? 0,
  });

  storyboardList.value = data.storyboardList;
  // 优先使用本地缓存，没有缓存则用后端数据并写入缓存
  const pid = project.value?.id;
  const sid = episodesId.value;
  if (pid != null && sid != null) {
    // 先将没有缓存的轨道写入缓存（保留已有本地编辑）
    initCacheFromTrackList(pid, sid, data.trackList);
    // 批量向后端请求文件路径对应的完整 URL
    await warmUpUrls(pid, sid);
    // 将本地缓存回写到 trackList，确保优先使用缓存数据（src 已解析为完整 URL）
    data.trackList.forEach((track: TrackItem) => {
      if (track.id == null) return;
      const cached = getCache(pid, sid, track.id);
      if (cached?.length) {
        track.medias = cached as unknown as TrackMedia[];
      }
    });
    // 整体赋值触发响应式
    trackList.value = [...data.trackList];
  }

  modelParmas.value.duration = clampDuration(data.trackList?.[activeTrackIndex.value]?.duration);
}
/** 提示词失焦时保存到后端 */
function handlePromptBlur() {
  const trackId = trackList.value[activeTrackIndex.value]?.id;
  if (trackId == null) return;
  axios.post("/production/workbench/updateVideoPrompt", { id: trackId, prompt: currentTrack.value?.prompt });
}
const genTextLoadingMap = ref<Record<number, boolean>>({}); // trackId -> 是否正在生成提示词

/** 单个轨道生成提示词 */
async function genText() {
  if (currentTrack.value.id == null || genTextLoadingMap.value[currentTrack.value.id]) return;
  if (singlePromptQuoteError.value) {
    window.$message.warning(singlePromptQuoteError.value);
    return;
  }
  if (singlePromptQuote.value && !singlePromptQuote.value.enough) {
    window.$message.warning(`积分不足，需要 ${formatBillingPoints(singlePromptQuote.value.requiredPoints)} 积分，当前可用 ${formatBillingPoints(singlePromptQuote.value.availablePoints)} 积分`);
    return;
  }
  const currentTrackId = currentTrack.value.id;
  const changeTrack = currentTrack.value;
  const info: PromptSourceInfo = buildPromptSourceInfoForMode(modelParmas.value.mode === "text" ? changeTrack.medias : imageList.value, modelParmas.value.mode);
  genTextLoadingMap.value[currentTrackId] = true;
  try {
    const { data } = await axios.post("/production/workbench/generateVideoPrompt", {
      projectId: project.value?.id,
      trackId: currentTrackId,
      info: info,
      model: modelParmas.value.model,
      mode: modelParmas.value.mode,
    });
    changeTrack.prompt = data;
  } catch (e) {
    window.$message.error((e as Error)?.message ?? "提示词生成失败");
  } finally {
    genTextLoadingMap.value[currentTrackId] = false;
  }
}
function trackChange(prevIndex?: number) {
  // 切换前：将旧轨道的 imageList 保存到缓存
  if (prevIndex != null) {
    const prevTrack = trackList.value[prevIndex];
    const pid = project.value?.id;
    const sid = episodesId.value;
    if (pid != null && sid != null && prevTrack?.id != null) {
      setCache(pid, sid, prevTrack.id, prevTrack.medias as unknown as UploadItem[]);
    }
  }
  // 切换后：从缓存恢复当前轨道的 imageList
  const pid = project.value?.id;
  const sid = episodesId.value;
  const curTrack = trackList.value[activeTrackIndex.value];
  if (pid != null && sid != null && curTrack?.id != null) {
    const cached = getCache(pid, sid, curTrack.id);
    if (cached) {
      curTrack.medias = cached as unknown as TrackMedia[];
    }
  }
  // imageList 是基于 currentTrack.medias 的计算属性，切换轨道后自动切换数据
  if (modelParmas.value.mode == "singleImage" && imageList.value.length > 1) {
    imageList.value = orderUploadItemsForMode(imageList.value, modelParmas.value.mode).slice(0, 1);
  }
  modelParmas.value.duration = clampDuration(trackList.value?.[activeTrackIndex.value]?.duration);
}
/** 监听当前轨道的 medias 变化，实时同步到缓存 */
watch(
  () => currentTrack.value?.medias,
  (medias) => {
    if (!medias) return;
    const pid = project.value?.id;
    const sid = episodesId.value;
    const trackId = currentTrack.value?.id;
    if (pid != null && sid != null && trackId != null) {
      setCache(pid, sid, trackId, medias as unknown as UploadItem[]);
    }
  },
  { deep: true },
);

onMounted(() => {
  modelParmas.value.model = project.value?.videoModel || "";
  modelParmas.value.mode = project.value?.mode || "";
  getGenerateData();
  if (hasGenerateVideoIds.value && hasGenerateVideoIds.value.length) {
    startPoll();
  }
});
/** 单个轨道生成视频 */
async function generateVideo() {
  if (!modelParmas.value.model) {
    window.$message.warning("请先选择模型");
    return;
  }
  if (singleVideoQuoteError.value) {
    window.$message.warning(singleVideoQuoteError.value);
    return;
  }
  if (singleVideoQuote.value && !singleVideoQuote.value.enough) {
    window.$message.warning(`积分不足，需要 ${formatBillingPoints(singleVideoQuote.value.requiredPoints)} 积分，当前可用 ${formatBillingPoints(singleVideoQuote.value.availablePoints)} 积分`);
    return;
  }
  const dlg = DialogPlugin.confirm({
    header: $t("workbench.generate.generateConfirm"),
    body:
      (singleVideoQuote.value?.requiredPoints || 0) > 0
        ? `${$t("workbench.generate.generateConfirmBody")}\n预计消耗 ${formatBillingPoints(singleVideoQuote.value?.requiredPoints)} 积分。`
        : $t("workbench.generate.generateConfirmBody"),
    onConfirm: async () => {
      dlg.destroy();
      try {
        const { data } = await axios.post("/production/workbench/generateVideo", {
          projectId: project.value?.id,
          scriptId: episodesId.value,
          uploadData:
            modelParmas.value.mode === "text"
              ? []
              : buildVideoReferenceInfoForMode(imageList.value, modelParmas.value.mode),
          prompt: currentTrack.value.prompt,
          model: modelParmas.value.model,
          mode: modelParmas.value.mode,
          resolution: modelParmas.value.resolution,
          duration: modelParmas.value.duration,
          audio: modelParmas.value.audio,
          trackId: currentTrack.value.id,
        });
        window.$message.success($t("workbench.generate.generateStarted"));
        currentTrack.value.videoList.push({
          id: data,
          state: "生成中",
          src: "",
        });
      } catch (e) {
        window.$message.error((e as any)?.message ?? "视频发起生成请求失败");
      } finally {
      }
    },
    onCancel: () => dlg.destroy(),
  });
}
let pollTimer: NodeJS.Timeout | null = null;

function startPoll() {
  if (pollTimer !== null) return;
  pollTimer = setInterval(() => getVideoList(), 3000);
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
const hasGenerateVideoIds = computed(() => {
  return trackList.value
    .map((track) => {
      return track.videoList.filter((i) => i.state == "生成中").map((i) => i.id);
    })
    .flatMap((i) => i);
});

/** 查询所有视频列表，并检测生成完成/失败状态 */
async function getVideoList() {
  const { data } = await axios.post("/production/workbench/checkVideoStateList", {
    projectId: project.value?.id,
    scriptId: episodesId.value ?? 0,
    videoIds: hasGenerateVideoIds.value,
  });
  if (data && data.length) {
    data.forEach((item: { id: number; state: "生成中" | "未生成" | "已完成" | "生成失败"; src?: string; lastFramePath?: string; lastFrameSrc?: string; errorReason?: string }) => {
      for (const track of trackList.value) {
        const findData = track.videoList.find((i) => i.id == item.id);
        if (findData) {
          findData.state = item.state;
          findData.src = item?.src ?? "";
          findData.lastFramePath = item?.lastFramePath ?? "";
          findData.lastFrameSrc = item?.lastFrameSrc ?? "";
          findData.errorReason = item?.errorReason ?? "";
          break;
        }
      }
    });
  }
}
watch(
  () => hasGenerateVideoIds.value,
  (newVal) => {
    if (newVal && newVal.length > 0) {
      startPoll();
    } else {
      stopPoll();
    }
  },
);

onUnmounted(() => {
  stopPoll();
});
</script>

<style lang="scss" scoped>
.index {
  height: calc(100vh - 120px);
  gap: 16px;
  overflow-y: auto;
  .referenceImage {
  }
  .modelSelect {
  }
  .generate {
    flex: 1;
    min-height: 0;
    width: 100%;
    gap: 5px;
    .prompt {
      width: 50%;
      height: 100%;
      min-height: 0;
      .videoPrompt {
        width: 100%;
        height: 100%;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        :deep(.t-loading__parent) {
          flex: 1 1 0;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        :deep(.t-card__body) {
          flex: 1;
          height: 100%;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .promptData {
          width: 100%;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          .promptInput {
            flex: 1;
            min-height: 0;
            overflow: hidden;
            :deep(.textareaWrapper) {
              min-height: 0;
              overflow: hidden;
            }
            :deep(.promptEditor) {
              min-height: 0;
              overflow-y: auto;
              overscroll-behavior: contain;
              scrollbar-gutter: stable;
            }
          }
        }
      }
    }
    .video {
      width: 50%;
      height: 100%;
      min-height: 0;
    }
  }
  .track {
  }
}
</style>
