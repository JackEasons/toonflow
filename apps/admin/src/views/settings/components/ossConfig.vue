<template>
  <Page auto-content-height title="OSS配置">
    <template #description>
      <div class="mt-2 text-foreground/70">
        管理后台文件存储方式，配置阿里云 OSS 后新文件会写入远程对象存储。
      </div>
    </template>
    <template #extra>
      <t-button variant="outline" :loading="loading" @click="loadConfig">
        <template #icon><t-icon name="refresh" /></template>
        刷新
      </t-button>
    </template>

    <div class="ossConfig">
      <section class="statusPanel">
        <div class="statusIcon">
          <t-icon name="cloud-upload" />
        </div>
        <div class="statusContent">
          <div class="statusTitleRow">
            <h3>对象存储</h3>
            <t-tag :theme="runtimeModeTheme" variant="light">{{ runtimeModeLabel }}</t-tag>
            <t-tag theme="default" variant="light-outline">{{ runtimeProviderLabel }}</t-tag>
          </div>
          <div class="statusDescription" :title="runtimeDescription">{{ runtimeDescription }}</div>
          <div class="statusMeta">最后读取：{{ lastLoadedLabel }}</div>
        </div>
      </section>

      <t-loading :loading="loading">
        <t-form :data="formData" labelAlign="top" class="ossForm">
          <section class="modePanel">
            <div class="sectionHeader">
              <div>
                <h4>存储模式</h4>
                <p>启用阿里云 OSS 后，新写入的文件会走远程对象存储。</p>
              </div>
              <t-radio-group v-model="storageMode" variant="default-filled">
                <t-radio-button value="local">本地存储</t-radio-button>
                <t-radio-button value="aliyun">阿里云 OSS</t-radio-button>
              </t-radio-group>
            </div>

            <div class="modeCards">
              <button
                type="button"
                class="modeCard"
                :class="{ active: storageMode === 'local' }"
                @click="storageMode = 'local'">
                <span class="modeName">本地存储</span>
                <span class="modeDesc">文件继续保存到服务器本地目录</span>
              </button>
              <button
                type="button"
                class="modeCard"
                :class="{ active: storageMode === 'aliyun' }"
                @click="storageMode = 'aliyun'">
                <span class="modeName">阿里云 OSS</span>
                <span class="modeDesc">配置通过后，上传和生成文件会写入 OSS</span>
              </button>
            </div>
          </section>

          <t-card :bordered="true" class="configCard">
            <div class="cardHeader">
              <div>
                <h4>阿里云 OSS 配置</h4>
                <p>保存后立即刷新服务端存储适配器，无需重启服务。</p>
              </div>
              <div class="cardTags">
                <t-tag :theme="readinessTheme" variant="light">{{ readinessLabel }}</t-tag>
                <t-tag :theme="secretStateTheme" variant="light">{{ secretStateLabel }}</t-tag>
              </div>
            </div>

            <div v-if="!formData.enabled" class="localNotice">
              当前选择本地存储。OSS 字段会保留在表单中，但保存配置需要先切换到阿里云 OSS。
            </div>
            <div v-else class="readinessPanel" :class="{ ready: canSubmitOss }">
              <div class="readinessTitle">
                <t-icon :name="canSubmitOss ? 'check-circle' : 'error-circle'" />
                <span>{{ readinessMessage }}</span>
              </div>
              <div v-if="missingRequiredFields.length" class="missingTags">
                <t-tag
                  v-for="field in missingRequiredFields"
                  :key="field.key"
                  theme="warning"
                  variant="light-outline">
                  {{ field.label }}
                </t-tag>
              </div>
            </div>

            <div class="formBlock">
              <div class="blockTitle">
                <span>连接信息</span>
                <small>Region、Bucket 和 Endpoint 决定实际写入位置</small>
              </div>
              <div class="fieldGrid">
                <t-form-item label="Region" name="region">
                  <t-input v-model="formData.region" :disabled="!formData.enabled" placeholder="oss-cn-hangzhou" />
                </t-form-item>
                <t-form-item label="Bucket" name="bucket">
                  <t-input v-model="formData.bucket" :disabled="!formData.enabled" placeholder="dramastudio-assets" />
                </t-form-item>
                <t-form-item label="Endpoint" name="endpoint">
                  <t-input
                    v-model="formData.endpoint"
                    :disabled="!formData.enabled"
                    placeholder="https://oss-cn-hangzhou.aliyuncs.com" />
                </t-form-item>
                <t-form-item label="HTTPS" name="secure">
                  <div class="switchField">
                    <t-switch v-model="formData.secure" :disabled="!formData.enabled" />
                    <span>{{ formData.secure ? "使用 HTTPS 访问 Endpoint" : "使用 HTTP 访问 Endpoint" }}</span>
                  </div>
                </t-form-item>
              </div>
            </div>

            <div class="formBlock">
              <div class="blockTitle">
                <span>访问密钥</span>
                <small>Secret 留空时会沿用已保存的密钥</small>
              </div>
              <div class="fieldGrid">
                <t-form-item label="AccessKey ID" name="accessKeyId">
                  <t-input v-model="formData.accessKeyId" :disabled="!formData.enabled" clearable />
                </t-form-item>
                <t-form-item label="AccessKey Secret" name="accessKeySecret">
                  <t-input
                    v-model="formData.accessKeySecret"
                    :disabled="!formData.enabled"
                    type="password"
                    :placeholder="formData.secretConfigured ? '留空保持原密钥' : '请输入 AccessKey Secret'"
                    clearable />
                </t-form-item>
              </div>
            </div>

            <div class="formBlock">
              <div class="blockTitle">
                <span>路径与访问</span>
                <small>可选项，用于隔离环境目录或接入 CDN 域名</small>
              </div>
              <div class="fieldGrid">
                <t-form-item label="存储前缀" name="rootPrefix">
                  <t-input
                    v-model="formData.rootPrefix"
                    :disabled="!formData.enabled"
                    placeholder="可选，例如 dramastudio/prod"
                    clearable />
                </t-form-item>
                <t-form-item label="公开访问域名" name="publicBaseUrl">
                  <t-input
                    v-model="formData.publicBaseUrl"
                    :disabled="!formData.enabled"
                    placeholder="可选，例如 https://cdn.example.com"
                    clearable />
                </t-form-item>
              </div>
            </div>
          </t-card>

          <div class="actionRow">
            <span class="actionHint">{{ actionHint }}</span>
            <div class="actionButtons">
              <t-button theme="primary" :loading="saving" :disabled="!canSubmitOss" @click="handleSave()">
                <template #icon><t-icon name="save" /></template>
                保存配置
              </t-button>
              <t-button variant="outline" :loading="testing" :disabled="!canSubmitOss" @click="handleTest">
                <template #icon><t-icon name="link" /></template>
                测试连接
              </t-button>
              <t-button theme="warning" variant="outline" :loading="saving" @click="handleUseLocal">
                切回本地存储
              </t-button>
            </div>
          </div>
        </t-form>
      </t-loading>
    </div>
  </Page>
</template>

<script setup lang="ts">
import { Page } from '@super/common-ui';
import { computed, onMounted, reactive, ref } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';

import { requestClient } from '#/api/request';

interface OssConfigForm {
  enabled: boolean;
  provider: "aliyun";
  region: string;
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  accessKeySecret: string;
  secure: boolean;
  rootPrefix: string;
  publicBaseUrl: string;
  secretConfigured: boolean;
}

interface OssRuntimeStatus {
  provider: string;
  remoteEnabled: boolean;
  description: string;
}

type StorageMode = "local" | "aliyun";
type RequiredField = {
  key: keyof OssConfigForm;
  label: string;
};

const loading = ref(false);
const saving = ref(false);
const testing = ref(false);
const runtime = ref<OssRuntimeStatus | null>(null);
const lastLoadedAt = ref("");

const formData = reactive<OssConfigForm>({
  enabled: false,
  provider: "aliyun",
  region: "",
  bucket: "",
  endpoint: "",
  accessKeyId: "",
  accessKeySecret: "",
  secure: true,
  rootPrefix: "",
  publicBaseUrl: "",
  secretConfigured: false,
});

const storageMode = computed<StorageMode>({
  get: () => (formData.enabled ? "aliyun" : "local"),
  set: (value) => {
    formData.enabled = value === "aliyun";
  },
});

const runtimeModeLabel = computed(() => (runtime.value?.remoteEnabled ? "远程存储" : "本地存储"));
const runtimeModeTheme = computed(() => (runtime.value?.remoteEnabled ? "primary" : "default"));

const runtimeProviderLabel = computed(() => {
  if (!runtime.value) {
    return "读取中";
  }
  if (runtime.value.provider === "aliyun") {
    return "阿里云 OSS";
  }
  if (runtime.value.provider === "minio") {
    return "MinIO";
  }
  return "本地";
});

const runtimeDescription = computed(() => {
  if (!runtime.value) {
    return "正在读取当前存储状态";
  }
  return runtime.value.description || "未返回存储位置";
});

const lastLoadedLabel = computed(() => lastLoadedAt.value || "尚未读取");
const secretStateLabel = computed(() => (formData.secretConfigured ? "密钥已保存" : "未保存密钥"));
const secretStateTheme = computed(() => (formData.secretConfigured ? "success" : "default"));

const missingRequiredFields = computed<RequiredField[]>(() => {
  if (!formData.enabled) {
    return [];
  }

  const fields: RequiredField[] = [
    { key: "region", label: "Region" },
    { key: "bucket", label: "Bucket" },
    { key: "endpoint", label: "Endpoint" },
    { key: "accessKeyId", label: "AccessKey ID" },
  ];

  if (!formData.secretConfigured) {
    fields.push({ key: "accessKeySecret", label: "AccessKey Secret" });
  }

  return fields.filter((field) => !String(formData[field.key] ?? "").trim());
});

const canSubmitOss = computed(() => formData.enabled && missingRequiredFields.value.length === 0);
const readinessLabel = computed(() => {
  if (!formData.enabled) {
    return "本地模式";
  }
  return canSubmitOss.value ? "可保存" : "待补全";
});
const readinessTheme = computed(() => {
  if (!formData.enabled) {
    return "default";
  }
  return canSubmitOss.value ? "success" : "warning";
});
const readinessMessage = computed(() => {
  if (canSubmitOss.value) {
    return "必填项已完整，可以测试连接或保存配置。";
  }
  return `还需要补全 ${missingRequiredFields.value.length} 个必填项。`;
});

const actionHint = computed(() => {
  if (!formData.enabled) {
    return "切换到阿里云 OSS 后可以保存或测试连接。";
  }
  if (missingRequiredFields.value.length > 0) {
    return `请先补全：${missingRequiredFields.value.map((field) => field.label).join("、")}`;
  }
  return "建议先测试连接，再保存到服务端配置。";
});

function applyConfig(config: Partial<OssConfigForm>) {
  Object.assign(formData, {
    enabled: false,
    provider: "aliyun",
    region: "",
    bucket: "",
    endpoint: "",
    accessKeyId: "",
    accessKeySecret: "",
    secure: true,
    rootPrefix: "",
    publicBaseUrl: "",
    secretConfigured: false,
    ...config,
  });
}

async function loadConfig() {
  loading.value = true;
  try {
    const res = await requestClient.get<{ config: OssConfigForm; runtime: OssRuntimeStatus }>("/setting/ossConfig/getConfig");
    applyConfig(res.config || {});
    runtime.value = res.runtime || null;
    lastLoadedAt.value = new Date().toLocaleTimeString("zh-CN", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } finally {
    loading.value = false;
  }
}

function buildPayload(enabled = formData.enabled) {
  return {
    enabled,
    provider: formData.provider,
    region: formData.region,
    bucket: formData.bucket,
    endpoint: formData.endpoint,
    accessKeyId: formData.accessKeyId,
    accessKeySecret: formData.accessKeySecret,
    secure: formData.secure,
    rootPrefix: formData.rootPrefix,
    publicBaseUrl: formData.publicBaseUrl,
  };
}

function ensureConfigReady() {
  if (!canSubmitOss.value) {
    MessagePlugin.warning(actionHint.value);
    return false;
  }
  return true;
}

async function handleSave(options: { validate?: boolean } = {}) {
  if (options.validate !== false && !ensureConfigReady()) {
    return;
  }

  saving.value = true;
  try {
    const res = await requestClient.post<{ runtime: OssRuntimeStatus }>("/setting/ossConfig/saveConfig", buildPayload());
    runtime.value = res.runtime || null;
    formData.accessKeySecret = "";
    if (formData.enabled) {
      formData.secretConfigured = true;
    }
    MessagePlugin.success("OSS 配置已保存");
  } finally {
    saving.value = false;
  }
}

async function handleUseLocal() {
  formData.enabled = false;
  await handleSave({ validate: false });
}

async function handleTest() {
  if (!ensureConfigReady()) {
    return;
  }

  testing.value = true;
  try {
    await requestClient.post("/setting/ossConfig/testConfig", buildPayload(true));
    MessagePlugin.success("连接测试成功");
  } finally {
    testing.value = false;
  }
}

onMounted(() => {
  loadConfig();
});
</script>

<style lang="scss" scoped>
.ossConfig {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .statusPanel {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 20px;
    border: 1px solid var(--td-component-border);
    border-radius: 8px;
    background: linear-gradient(135deg, var(--td-bg-color-container), var(--td-bg-color-secondarycontainer));
  }

  .statusIcon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    border-radius: 8px;
    color: var(--td-brand-color);
    background: var(--td-brand-color-light);
    font-size: 24px;
  }

  .statusContent {
    min-width: 0;
    flex: 1;
  }

  .statusTitleRow {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    h3 {
      margin: 0;
      color: var(--td-text-color-primary);
      font-size: 18px;
      font-weight: 600;
    }
  }

  .statusDescription {
    max-width: 100%;
    overflow: hidden;
    color: var(--td-text-color-secondary);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 13px;
    line-height: 20px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .statusMeta {
    margin-top: 6px;
    color: var(--td-text-color-placeholder);
    font-size: 12px;
    line-height: 18px;
  }

  .ossForm {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modePanel,
  .configCard {
    border-radius: 8px;
  }

  .modePanel {
    padding: 18px 20px;
    border: 1px solid var(--td-component-border);
    background: var(--td-bg-color-container);
  }

  .sectionHeader,
  .cardHeader {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;

    h4 {
      margin: 0;
      color: var(--td-text-color-primary);
      font-size: 16px;
      font-weight: 600;
    }

    p {
      margin: 6px 0 0;
      color: var(--td-text-color-secondary);
      font-size: 13px;
      line-height: 20px;
    }
  }

  .modeCards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 16px;
  }

  .modeCard {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 88px;
    padding: 16px;
    border: 1px solid var(--td-component-border);
    border-radius: 8px;
    color: inherit;
    background: var(--td-bg-color-container);
    cursor: pointer;
    text-align: left;
    transition:
      border-color 0.2s ease,
      background-color 0.2s ease,
      box-shadow 0.2s ease;

    &:hover,
    &.active {
      border-color: var(--td-brand-color);
      background: var(--td-brand-color-light);
    }

    &.active {
      box-shadow: inset 0 0 0 1px var(--td-brand-color);
    }
  }

  .modeName {
    color: var(--td-text-color-primary);
    font-size: 15px;
    font-weight: 600;
  }

  .modeDesc {
    color: var(--td-text-color-secondary);
    font-size: 13px;
    line-height: 20px;
  }

  .configCard {
    :deep(.t-card__body) {
      padding: 20px;
    }
  }

  .cardTags {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }

  .localNotice {
    margin-top: 16px;
    padding: 12px 14px;
    border: 1px solid var(--td-warning-color-light);
    border-radius: 8px;
    color: var(--td-warning-color);
    background: var(--td-warning-color-light);
    font-size: 13px;
    line-height: 20px;
  }

  .readinessPanel {
    margin-top: 16px;
    padding: 12px 14px;
    border: 1px solid var(--td-warning-color-light);
    border-radius: 8px;
    background: var(--td-warning-color-light);

    &.ready {
      border-color: var(--td-success-color-light);
      background: var(--td-success-color-light);
    }
  }

  .readinessTitle {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--td-text-color-primary);
    font-size: 13px;
    line-height: 20px;
  }

  .missingTags {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    flex-wrap: wrap;
  }

  .formBlock {
    padding-top: 20px;
  }

  .blockTitle {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 14px;

    span {
      color: var(--td-text-color-primary);
      font-size: 14px;
      font-weight: 600;
    }

    small {
      color: var(--td-text-color-placeholder);
      font-size: 12px;
    }
  }

  .fieldGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 20px;
  }

  .switchField {
    display: flex;
    align-items: center;
    min-height: 32px;
    gap: 10px;
    color: var(--td-text-color-secondary);
    font-size: 13px;
  }

  .actionRow {
    position: sticky;
    bottom: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 0 2px;
    background: var(--td-bg-color-page);
  }

  .actionHint {
    color: var(--td-text-color-secondary);
    font-size: 13px;
    line-height: 20px;
  }

  .actionButtons {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }
}

@media (max-width: 860px) {
  .ossConfig {
    .statusPanel,
    .sectionHeader,
    .cardHeader,
    .actionRow {
      align-items: stretch;
      flex-direction: column;
    }

    .statusTitleRow {
      flex-wrap: wrap;
    }

    .modeCards,
    .fieldGrid {
      grid-template-columns: 1fr;
    }

    .blockTitle {
      align-items: flex-start;
      flex-direction: column;
      gap: 4px;
    }

    .actionButtons {
      justify-content: flex-start;
    }
  }
}
</style>
