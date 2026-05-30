<template>
  <Page auto-content-height title="支付设置">
    <template #description>
      <div class="mt-2 text-foreground/70">管理会员订阅与积分充值的支付宝、微信支付通道。</div>
    </template>
    <template #extra>
      <t-button variant="outline" :loading="loading" @click="loadConfig">
        <template #icon><t-icon name="refresh" /></template>
        刷新
      </t-button>
    </template>

    <div class="paymentConfig">
      <section class="paymentHero">
        <div class="heroIcon">¥</div>
        <div class="heroCopy">
          <div class="heroTitleRow">
            <h3>支付能力</h3>
            <t-tag :theme="heroStatusTheme" variant="light">
              {{ heroStatusLabel }}
            </t-tag>
          </div>
          <p>默认通道：{{ defaultProviderLabel }} · 已启用 {{ enabledProviderCount }}/2 · 可用 {{ readyProviderCount }}/2</p>
        </div>
        <div class="heroStats">
          <div>
            <span>支付宝</span>
            <strong>{{ alipayStatusLabel }}</strong>
          </div>
          <div>
            <span>微信支付</span>
            <strong>{{ wechatStatusLabel }}</strong>
          </div>
        </div>
      </section>

      <t-alert theme="warning" class="topAlert" message="支付回调必须使用公网可访问地址，生产环境建议配置 HTTPS 域名。" />

      <t-loading :loading="loading">
        <t-form :data="formData" labelAlign="top" class="paymentForm">
          <section class="configSection baseSection">
            <header class="sectionHeader">
              <div>
                <span>Base</span>
                <h2>基础配置</h2>
              </div>
              <p>公网访问地址会用于自动生成支付回调地址。</p>
            </header>
            <div class="fieldGrid">
              <t-form-item label="公网访问地址" name="publicBaseUrl" class="wideField">
                <t-input v-model="formData.publicBaseUrl" placeholder="https://api.example.com" clearable />
              </t-form-item>
              <t-form-item label="默认支付方式" name="defaultProvider">
                <t-select v-model="formData.defaultProvider">
                  <t-option value="alipay" label="支付宝" />
                  <t-option value="wechat" label="微信支付" />
                </t-select>
              </t-form-item>
            </div>
            <div class="callbackPreview">
              <div>
                <span>支付宝通知</span>
                <code>{{ alipayNotifyPreview }}</code>
              </div>
              <div>
                <span>微信通知</span>
                <code>{{ wechatNotifyPreview }}</code>
              </div>
            </div>
          </section>

          <section class="configSection providerSection" :class="{ disabled: !formData.alipay.enabled }">
            <header class="providerHeader">
              <div class="providerIdentity">
                <span class="providerMark alipayMark">支</span>
                <div>
                  <span>Alipay</span>
                  <h2>支付宝</h2>
                </div>
              </div>
              <div class="providerMeta">
                <span>{{ formData.alipay.environment === "production" ? "正式环境" : "沙箱环境" }}</span>
                <span>{{ alipayProductLabel }}</span>
                <strong :class="{ active: alipayReady, warning: formData.alipay.enabled && !alipayReady }">
                  {{ alipayStatusLabel }}
                </strong>
              </div>
            </header>

            <div class="providerNotice" :class="{ disabled: !formData.alipay.enabled, ready: alipayReady }">
              <t-icon :name="alipayReady ? 'check-circle' : formData.alipay.enabled ? 'error-circle' : 'info-circle'" />
              <span>{{ alipayReadinessMessage }}</span>
            </div>

            <div class="formBlock">
              <div class="blockTitle">
                <span>基础身份</span>
                <small>App ID、产品和商户号决定拉起方式与回调校验</small>
              </div>
              <div class="fieldGrid">
                <t-form-item label="启用支付宝" name="alipay.enabled">
                  <t-switch v-model="formData.alipay.enabled" />
                </t-form-item>
                <t-form-item label="环境" name="alipay.environment">
                  <t-select v-model="formData.alipay.environment" :disabled="!formData.alipay.enabled">
                    <t-option value="sandbox" label="沙箱" />
                    <t-option value="production" label="正式" />
                  </t-select>
                </t-form-item>
                <t-form-item label="产品" name="alipay.product">
                  <t-select v-model="formData.alipay.product" :disabled="!formData.alipay.enabled">
                    <t-option value="page" label="电脑网站支付" />
                    <t-option value="wap" label="手机网站支付" />
                  </t-select>
                </t-form-item>
                <t-form-item label="App ID" name="alipay.appId">
                  <t-input v-model="formData.alipay.appId" :disabled="!formData.alipay.enabled" clearable />
                </t-form-item>
                <t-form-item label="Seller ID" name="alipay.sellerId">
                  <t-input v-model="formData.alipay.sellerId" :disabled="!formData.alipay.enabled" placeholder="可选，用于回调校验" clearable />
                </t-form-item>
              </div>
            </div>

            <div class="formBlock">
              <div class="blockTitle">
                <span>回调地址</span>
                <small>留空时根据公网访问地址自动生成</small>
              </div>
              <div class="fieldGrid">
                <t-form-item label="异步通知地址" name="alipay.notifyUrl">
                  <t-input v-model="formData.alipay.notifyUrl" :disabled="!formData.alipay.enabled" placeholder="留空使用公网访问地址自动生成" clearable />
                </t-form-item>
                <t-form-item label="同步返回地址" name="alipay.returnUrl">
                  <t-input v-model="formData.alipay.returnUrl" :disabled="!formData.alipay.enabled" placeholder="留空使用公网访问地址自动生成" clearable />
                </t-form-item>
              </div>
            </div>

            <div class="formBlock secretBlock">
              <div class="blockTitle">
                <span>密钥材料</span>
                <small>留空时沿用已保存密钥，不会覆盖已有配置</small>
              </div>
              <div class="secretGrid">
                <t-form-item label="应用私钥" name="alipay.appPrivateKey">
                  <t-textarea
                    v-model="formData.alipay.appPrivateKey"
                    :disabled="!formData.alipay.enabled"
                    :autosize="{ minRows: 4, maxRows: 8 }"
                    :placeholder="formData.alipay.appPrivateKeyConfigured ? '留空保持原私钥' : 'RSA2 应用私钥'" />
                </t-form-item>
                <t-form-item label="支付宝公钥" name="alipay.alipayPublicKey">
                  <t-textarea
                    v-model="formData.alipay.alipayPublicKey"
                    :disabled="!formData.alipay.enabled"
                    :autosize="{ minRows: 4, maxRows: 8 }"
                    :placeholder="formData.alipay.alipayPublicKeyConfigured ? '留空保持原公钥' : '支付宝 RSA2 公钥'" />
                </t-form-item>
              </div>
            </div>
          </section>

          <section class="configSection providerSection" :class="{ disabled: !formData.wechat.enabled }">
            <header class="providerHeader">
              <div class="providerIdentity">
                <span class="providerMark wechatMark">微</span>
                <div>
                  <span>WeChat Pay</span>
                  <h2>微信支付</h2>
                </div>
              </div>
              <div class="providerMeta">
                <span>{{ wechatModeLabel }}</span>
                <span>{{ wechatSceneLabel }}</span>
                <strong :class="{ active: wechatReady, warning: formData.wechat.enabled && !wechatReady }">
                  {{ wechatStatusLabel }}
                </strong>
              </div>
            </header>

            <div class="providerNotice" :class="{ disabled: !formData.wechat.enabled, ready: wechatReady }">
              <t-icon :name="wechatReady ? 'check-circle' : formData.wechat.enabled ? 'error-circle' : 'info-circle'" />
              <span>{{ wechatReadinessMessage }}</span>
            </div>

            <div class="formBlock">
              <div class="blockTitle">
                <span>接入方式</span>
                <small>商户模式用于自有商户，服务商模式用于子商户收款</small>
              </div>
              <div class="fieldGrid">
                <t-form-item label="启用微信支付" name="wechat.enabled">
                  <t-switch v-model="formData.wechat.enabled" />
                </t-form-item>
                <t-form-item label="接入模式" name="wechat.mode">
                  <t-select v-model="formData.wechat.mode" :disabled="!formData.wechat.enabled">
                    <t-option value="merchant" label="商户模式" />
                    <t-option value="serviceProvider" label="服务商模式" />
                  </t-select>
                </t-form-item>
                <t-form-item label="支付场景" name="wechat.paymentScene">
                  <t-select v-model="formData.wechat.paymentScene" :disabled="!formData.wechat.enabled">
                    <t-option value="h5" label="H5 支付" />
                    <t-option value="native" label="Native 二维码" />
                  </t-select>
                </t-form-item>
                <t-form-item label="通知地址" name="wechat.notifyUrl">
                  <t-input v-model="formData.wechat.notifyUrl" :disabled="!formData.wechat.enabled" placeholder="留空使用公网访问地址自动生成" clearable />
                </t-form-item>
              </div>
            </div>

            <div class="formBlock">
              <div class="blockTitle">
                <span>商户身份</span>
                <small>{{ formData.wechat.mode === "merchant" ? "普通商户支付必填 AppID 与 mchid" : "服务商模式需要服务商与子商户身份" }}</small>
              </div>
              <div v-if="formData.wechat.mode === 'merchant'" class="fieldGrid">
                <t-form-item label="AppID" name="wechat.appid">
                  <t-input v-model="formData.wechat.appid" :disabled="!formData.wechat.enabled" clearable />
                </t-form-item>
                <t-form-item label="商户号 mchid" name="wechat.mchid">
                  <t-input v-model="formData.wechat.mchid" :disabled="!formData.wechat.enabled" clearable />
                </t-form-item>
              </div>

              <div v-else class="fieldGrid">
                <t-form-item label="服务商 AppID" name="wechat.spAppid">
                  <t-input v-model="formData.wechat.spAppid" :disabled="!formData.wechat.enabled" clearable />
                </t-form-item>
                <t-form-item label="服务商商户号 sp_mchid" name="wechat.spMchid">
                  <t-input v-model="formData.wechat.spMchid" :disabled="!formData.wechat.enabled" clearable />
                </t-form-item>
                <t-form-item label="子商户号 sub_mchid" name="wechat.subMchid">
                  <t-input v-model="formData.wechat.subMchid" :disabled="!formData.wechat.enabled" clearable />
                </t-form-item>
                <t-form-item label="子商户 AppID" name="wechat.subAppid">
                  <t-input v-model="formData.wechat.subAppid" :disabled="!formData.wechat.enabled" clearable />
                </t-form-item>
              </div>
            </div>

            <div class="formBlock secretBlock">
              <div class="blockTitle">
                <span>证书与密钥</span>
                <small>APIv3 密钥、商户私钥和微信支付公钥用于签名与回调验签</small>
              </div>
              <div class="fieldGrid">
                <t-form-item label="API 证书序列号" name="wechat.certificateSerialNo">
                  <t-input v-model="formData.wechat.certificateSerialNo" :disabled="!formData.wechat.enabled" clearable />
                </t-form-item>
                <t-form-item label="微信支付公钥 ID" name="wechat.wechatpayPublicKeyId">
                  <t-input v-model="formData.wechat.wechatpayPublicKeyId" :disabled="!formData.wechat.enabled" placeholder="PUB_KEY_ID_..." clearable />
                </t-form-item>
              </div>
              <div class="secretGrid">
                <t-form-item label="APIv3 密钥" name="wechat.apiV3Key">
                  <t-input
                    v-model="formData.wechat.apiV3Key"
                    :disabled="!formData.wechat.enabled"
                    type="password"
                    :placeholder="formData.wechat.apiV3KeyConfigured ? '留空保持原密钥' : '32 字节 APIv3 密钥'"
                    clearable />
                </t-form-item>
                <t-form-item label="APIv2 密钥" name="wechat.apiV2Key">
                  <t-input
                    v-model="formData.wechat.apiV2Key"
                    :disabled="!formData.wechat.enabled"
                    type="password"
                    :placeholder="formData.wechat.apiV2KeyConfigured ? '留空保持原密钥' : '支付分调起需要时填写'"
                    clearable />
                </t-form-item>
                <t-form-item label="商户 API 私钥" name="wechat.privateKey">
                  <t-textarea
                    v-model="formData.wechat.privateKey"
                    :disabled="!formData.wechat.enabled"
                    :autosize="{ minRows: 4, maxRows: 8 }"
                    :placeholder="formData.wechat.privateKeyConfigured ? '留空保持原私钥' : 'apiclient_key.pem 内容'" />
                </t-form-item>
                <t-form-item label="微信支付公钥" name="wechat.wechatpayPublicKey">
                  <t-textarea
                    v-model="formData.wechat.wechatpayPublicKey"
                    :disabled="!formData.wechat.enabled"
                    :autosize="{ minRows: 4, maxRows: 8 }"
                    :placeholder="formData.wechat.wechatpayPublicKeyConfigured ? '留空保持原公钥' : '推荐填写微信支付公钥'" />
                </t-form-item>
                <t-form-item label="平台证书" name="wechat.platformCertificate">
                  <t-textarea
                    v-model="formData.wechat.platformCertificate"
                    :disabled="!formData.wechat.enabled"
                    :autosize="{ minRows: 4, maxRows: 8 }"
                    :placeholder="formData.wechat.platformCertificateConfigured ? '留空保持原证书' : '旧式平台证书，可选'" />
                </t-form-item>
                <t-form-item label="平台证书序列号" name="wechat.platformCertificateSerialNo">
                  <t-input v-model="formData.wechat.platformCertificateSerialNo" :disabled="!formData.wechat.enabled" clearable />
                </t-form-item>
              </div>
            </div>
          </section>

          <div class="actionRow">
            <span class="actionHint">{{ actionHint }}</span>
            <div class="actionButtons">
              <t-button theme="primary" :loading="saving" @click="handleSave">
                <template #icon><t-icon name="save" /></template>
                保存配置
              </t-button>
              <t-button variant="outline" :loading="loading" @click="loadConfig">刷新</t-button>
            </div>
          </div>
        </t-form>
      </t-loading>
    </div>
  </Page>
</template>

<script setup lang="ts">
import { Page } from '@super/common-ui';
import { computed, onMounted, ref } from 'vue';

import axios from '#/utils/axios';

type PaymentForm = {
  alipay: {
    alipayPublicKey: string;
    alipayPublicKeyConfigured?: boolean;
    appId: string;
    appPrivateKey: string;
    appPrivateKeyConfigured?: boolean;
    enabled: boolean;
    environment: "production" | "sandbox";
    notifyUrl: string;
    product: "page" | "wap";
    returnUrl: string;
    sellerId: string;
    signType: "RSA2";
  };
  defaultProvider: "alipay" | "wechat";
  publicBaseUrl: string;
  wechat: {
    apiV2Key: string;
    apiV2KeyConfigured?: boolean;
    apiV3Key: string;
    apiV3KeyConfigured?: boolean;
    appid: string;
    certificateSerialNo: string;
    enabled: boolean;
    mchid: string;
    mode: "merchant" | "serviceProvider";
    notifyUrl: string;
    paymentScene: "h5" | "native";
    platformCertificate: string;
    platformCertificateConfigured?: boolean;
    platformCertificateSerialNo: string;
    privateKey: string;
    privateKeyConfigured?: boolean;
    spAppid: string;
    spMchid: string;
    subAppid: string;
    subMchid: string;
    wechatpayPublicKey: string;
    wechatpayPublicKeyConfigured?: boolean;
    wechatpayPublicKeyId: string;
  };
};

const defaultForm: PaymentForm = {
  publicBaseUrl: "",
  defaultProvider: "alipay",
  alipay: {
    enabled: false,
    environment: "sandbox",
    product: "page",
    appId: "",
    appPrivateKey: "",
    alipayPublicKey: "",
    sellerId: "",
    notifyUrl: "",
    returnUrl: "",
    signType: "RSA2",
  },
  wechat: {
    enabled: false,
    mode: "merchant",
    paymentScene: "h5",
    appid: "",
    mchid: "",
    spAppid: "",
    spMchid: "",
    subAppid: "",
    subMchid: "",
    apiV2Key: "",
    apiV3Key: "",
    privateKey: "",
    certificateSerialNo: "",
    wechatpayPublicKey: "",
    wechatpayPublicKeyId: "",
    platformCertificate: "",
    platformCertificateSerialNo: "",
    notifyUrl: "",
  },
};

const formData = ref<PaymentForm>(structuredClone(defaultForm));
const loading = ref(false);
const saving = ref(false);

const enabledProviderCount = computed(() => Number(formData.value.alipay.enabled) + Number(formData.value.wechat.enabled));
const defaultProviderLabel = computed(() => (formData.value.defaultProvider === "wechat" ? "微信支付" : "支付宝"));
const alipayProductLabel = computed(() => (formData.value.alipay.product === "wap" ? "手机网站支付" : "电脑网站支付"));
const wechatModeLabel = computed(() => (formData.value.wechat.mode === "serviceProvider" ? "服务商模式" : "商户模式"));
const wechatSceneLabel = computed(() => (formData.value.wechat.paymentScene === "native" ? "Native 二维码" : "H5 支付"));
const alipayMissingFields = computed(() => {
  if (!formData.value.alipay.enabled) {
    return [];
  }

  const missing: string[] = [];
  if (!formData.value.alipay.appId.trim()) {
    missing.push("App ID");
  }
  if (!hasSecretValue(formData.value.alipay.appPrivateKey, formData.value.alipay.appPrivateKeyConfigured)) {
    missing.push("应用私钥");
  }
  if (!hasSecretValue(formData.value.alipay.alipayPublicKey, formData.value.alipay.alipayPublicKeyConfigured)) {
    missing.push("支付宝公钥");
  }
  return missing;
});
const wechatMissingFields = computed(() => {
  if (!formData.value.wechat.enabled) {
    return [];
  }

  const missing: string[] = [];
  if (formData.value.wechat.mode === "serviceProvider") {
    if (!formData.value.wechat.spAppid.trim()) {
      missing.push("服务商 AppID");
    }
    if (!formData.value.wechat.spMchid.trim()) {
      missing.push("服务商商户号");
    }
    if (!formData.value.wechat.subMchid.trim()) {
      missing.push("子商户号");
    }
  } else {
    if (!formData.value.wechat.appid.trim()) {
      missing.push("AppID");
    }
    if (!formData.value.wechat.mchid.trim()) {
      missing.push("商户号");
    }
  }
  if (!formData.value.wechat.certificateSerialNo.trim()) {
    missing.push("API 证书序列号");
  }
  if (!hasSecretValue(formData.value.wechat.apiV3Key, formData.value.wechat.apiV3KeyConfigured)) {
    missing.push("APIv3 密钥");
  }
  if (!hasSecretValue(formData.value.wechat.privateKey, formData.value.wechat.privateKeyConfigured)) {
    missing.push("商户 API 私钥");
  }
  const hasWechatPublicKey =
    formData.value.wechat.wechatpayPublicKeyId.trim().length > 0 &&
    hasSecretValue(formData.value.wechat.wechatpayPublicKey, formData.value.wechat.wechatpayPublicKeyConfigured);
  const hasPlatformCertificate = hasSecretValue(formData.value.wechat.platformCertificate, formData.value.wechat.platformCertificateConfigured);
  if (!hasWechatPublicKey && !hasPlatformCertificate) {
    missing.push("微信支付公钥/平台证书");
  }
  if (hasPlatformCertificate && !formData.value.wechat.platformCertificateSerialNo.trim()) {
    missing.push("平台证书序列号");
  }
  return missing;
});
const alipayReady = computed(() => formData.value.alipay.enabled && alipayMissingFields.value.length === 0);
const wechatReady = computed(() => formData.value.wechat.enabled && wechatMissingFields.value.length === 0);
const readyProviderCount = computed(() => Number(alipayReady.value) + Number(wechatReady.value));
const heroStatusLabel = computed(() => {
  if (readyProviderCount.value > 0) {
    return "可用";
  }
  return enabledProviderCount.value > 0 ? "待补全" : "未配置";
});
const heroStatusTheme = computed(() => {
  if (readyProviderCount.value > 0) {
    return "success";
  }
  return enabledProviderCount.value > 0 ? "warning" : "default";
});
const alipayStatusLabel = computed(() => {
  if (!formData.value.alipay.enabled) {
    return "未启用";
  }
  return alipayReady.value ? "可用" : "待补全";
});
const wechatStatusLabel = computed(() => {
  if (!formData.value.wechat.enabled) {
    return "未启用";
  }
  return wechatReady.value ? "可用" : "待补全";
});
const alipayReadinessMessage = computed(() => {
  if (!formData.value.alipay.enabled) {
    return "支付宝未启用，用户端不会展示支付宝支付入口。";
  }
  if (alipayReady.value) {
    return "支付宝基础信息和密钥材料完整，可以保存并用于下单。";
  }
  return `支付宝还需要补全：${alipayMissingFields.value.join("、")}`;
});
const wechatReadinessMessage = computed(() => {
  if (!formData.value.wechat.enabled) {
    return "微信支付未启用，用户端不会展示微信支付入口。";
  }
  if (wechatReady.value) {
    return "微信支付基础信息和证书密钥完整，可以保存并用于下单。";
  }
  return `微信支付还需要补全：${wechatMissingFields.value.join("、")}`;
});
const actionHint = computed(() => {
  if (enabledProviderCount.value === 0) {
    return "至少启用一个支付通道后，用户端才会展示支付入口。";
  }
  const missingMessages = [
    ...alipayMissingFields.value.map((field) => `支付宝 ${field}`),
    ...wechatMissingFields.value.map((field) => `微信 ${field}`),
  ];
  if (missingMessages.length > 0) {
    return `当前启用通道还有 ${missingMessages.length} 项待补全。`;
  }
  return "保存后用户端会员订阅与积分充值会使用当前支付配置。";
});

function hasSecretValue(value: string, configured = false) {
  return configured || value.trim().length > 0;
}

function buildCallbackPreview(path: string) {
  const baseUrl = formData.value.publicBaseUrl.trim().replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}${path}` : `当前访问域名${path}`;
}

const alipayNotifyPreview = computed(() => formData.value.alipay.notifyUrl.trim() || buildCallbackPreview("/api/payment/alipay/notify"));
const wechatNotifyPreview = computed(() => formData.value.wechat.notifyUrl.trim() || buildCallbackPreview("/api/payment/wechat/notify"));

function applyConfig(payload: any) {
  const config = payload?.config ?? {};
  formData.value = {
    ...structuredClone(defaultForm),
    ...config,
    alipay: {
      ...defaultForm.alipay,
      ...(config.alipay ?? {}),
      appPrivateKey: "",
      alipayPublicKey: "",
    },
    wechat: {
      ...defaultForm.wechat,
      ...(config.wechat ?? {}),
      apiV2Key: "",
      apiV3Key: "",
      privateKey: "",
      wechatpayPublicKey: "",
      platformCertificate: "",
    },
  };
}

async function loadConfig() {
  loading.value = true;
  try {
    const res: any = await axios.get("/setting/paymentConfig/getPaymentConfig");
    applyConfig(res.data);
  } catch (error: any) {
    window.$message.error(error?.message || "获取支付配置失败");
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  try {
    const res: any = await axios.post("/setting/paymentConfig/savePaymentConfig", formData.value);
    applyConfig(res.data);
    window.$message.success(res.message || "支付配置已保存");
  } catch (error: any) {
    window.$message.error(error?.message || "保存支付配置失败");
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadConfig();
});
</script>

<style lang="scss" scoped>
.paymentConfig {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: auto !important;
  min-height: 0;
  max-height: none;
  overflow: visible;

  .paymentHero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 20px;
    border: 1px solid var(--td-component-border);
    border-radius: 8px;
    background: linear-gradient(135deg, var(--td-bg-color-container), var(--td-bg-color-secondarycontainer));
  }

  .heroIcon {
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
    font-weight: 700;
  }

  .heroCopy {
    min-width: 0;
    flex: 1;
  }

  .heroTitleRow {
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

  .heroCopy p {
    margin: 0;
    color: var(--td-text-color-secondary);
    font-size: 13px;
    line-height: 20px;
  }

  .heroStats {
    display: grid;
    min-width: 240px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .heroStats > div {
    min-width: 0;
    padding: 12px 14px;
    border: 1px solid var(--td-component-border);
    border-radius: 8px;
    background: var(--td-bg-color-container);

    span,
    strong {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    span {
      color: var(--td-text-color-placeholder);
      font-size: 12px;
      line-height: 18px;
    }

    strong {
      margin-top: 4px;
      color: var(--td-text-color-primary);
      font-size: 14px;
      font-weight: 600;
      line-height: 22px;
    }
  }

  .paymentForm {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 72px;
  }

  .configSection {
    padding: 20px;
    border: 1px solid var(--td-component-border);
    border-radius: 8px;
    background: var(--td-bg-color-container);
  }

  .sectionHeader,
  .providerHeader {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 18px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--td-component-stroke);

    h2 {
      margin: 2px 0 0;
      color: var(--td-text-color-primary);
      font-size: 16px;
      font-weight: 600;
      line-height: 1.3;
    }

    span,
    p {
      color: var(--td-text-color-secondary);
      font-size: 12px;
      font-weight: 600;
      line-height: 1.5;
    }

    p {
      max-width: 360px;
      margin: 0;
      text-align: right;
    }
  }

  .providerSection {
    transition:
      border-color 0.2s ease,
      opacity 0.2s ease;

    &.disabled {
      border-color: var(--td-component-border);
    }
  }

  .providerNotice {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding: 10px 12px;
    border: 1px solid var(--td-warning-color-light);
    border-radius: 8px;
    background: var(--td-warning-color-light);
    color: var(--td-warning-color);
    font-size: 13px;
    line-height: 20px;

    &.disabled {
      border-color: var(--td-component-border);
      background: var(--td-bg-color-secondarycontainer);
      color: var(--td-text-color-secondary);
    }

    &.ready {
      border-color: var(--td-success-color-light);
      background: var(--td-success-color-light);
      color: var(--td-success-color);
    }
  }

  .providerIdentity {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 12px;
  }

  .providerMark {
    display: inline-flex;
    width: 40px;
    height: 40px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    color: #fff;
    font-size: 18px;
    font-weight: 700;
  }

  .alipayMark {
    background: #1677ff;
  }

  .wechatMark {
    background: #07c160;
  }

  .providerMeta {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;

    span,
    strong {
      display: inline-flex;
      align-items: center;
      height: 26px;
      padding: 0 10px;
      border-radius: 999px;
      background: var(--td-bg-color-secondarycontainer);
      color: var(--td-text-color-secondary);
      font-size: 12px;
      font-weight: 700;
      line-height: 1;
    }

    strong {
      background: var(--td-bg-color-secondarycontainer);
      color: var(--td-text-color-placeholder);

      &.active {
        background: var(--td-success-color-light);
        color: var(--td-success-color);
      }

      &.warning {
        background: var(--td-warning-color-light);
        color: var(--td-warning-color);
      }
    }
  }

  .formBlock {
    & + .formBlock {
      margin-top: 18px;
    }
  }

  .blockTitle {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 12px;

    span {
      color: var(--td-text-color-primary);
      font-size: 14px;
      font-weight: 600;
      line-height: 20px;
    }

    small {
      color: var(--td-text-color-placeholder);
      font-size: 12px;
      line-height: 18px;
    }
  }

  .fieldGrid,
  .secretGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 20px;
  }

  .wideField {
    grid-column: span 2;
  }

  .secretGrid {
    margin-top: 12px;
    padding-top: 16px;
    border-top: 1px dashed var(--td-component-stroke);
  }

  .callbackPreview {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 4px;

    > div {
      min-width: 0;
      padding: 12px 14px;
      border: 1px solid var(--td-component-border);
      border-radius: 8px;
      background: var(--td-bg-color-secondarycontainer);
    }

    span {
      display: block;
      margin-bottom: 6px;
      color: var(--td-text-color-secondary);
      font-size: 12px;
      font-weight: 700;
    }

    code {
      display: block;
      overflow: hidden;
      color: var(--td-text-color-primary);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .actionRow {
    position: sticky;
    bottom: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin: 0 -16px -16px;
    padding: 12px 16px;
    border-top: 1px solid var(--td-component-stroke);
    background: var(--ds-settings-footer-bg, var(--td-bg-color-page));
    box-shadow: var(--ds-settings-footer-shadow, 0 -8px 24px rgb(0 0 0 / 8%));
    backdrop-filter: blur(10px);
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
  .paymentConfig {
    .paymentHero {
      flex-direction: column;
      padding: 18px;
    }

    .heroStats {
      width: 100%;
      min-width: 0;
    }

    .sectionHeader,
    .providerHeader,
    .actionRow {
      align-items: stretch;
      flex-direction: column;

      p {
        text-align: left;
      }
    }

    .fieldGrid,
    .secretGrid,
    .callbackPreview {
      grid-template-columns: 1fr;
    }

    .wideField {
      grid-column: span 1;
    }

    .actionButtons {
      justify-content: flex-start;
    }

    .blockTitle {
      align-items: flex-start;
      flex-direction: column;
      gap: 4px;
    }
  }
}
</style>
