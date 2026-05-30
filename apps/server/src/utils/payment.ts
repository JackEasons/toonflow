import axios from "axios";
import type { Request } from "express";
import crypto from "node:crypto";

import { markMembershipOrderPaidByOrderNo } from "@/utils/membership";
import db from "@/utils/db";

const PAYMENT_CONFIG_KEY = "paymentConfig";
const ALIPAY_PRODUCTION_GATEWAY = "https://openapi.alipay.com/gateway.do";
const ALIPAY_SANDBOX_GATEWAY = "https://openapi-sandbox.dl.alipaydev.com/gateway.do";
const WECHATPAY_GATEWAY = "https://api.mch.weixin.qq.com";

type AlipayProduct = "page" | "wap";
type PaymentProvider = "alipay" | "wechat";
type WechatMode = "merchant" | "serviceProvider";
type WechatScene = "h5" | "native";

type PaymentOrder = {
  amountCny?: number | null;
  id: string;
  kind: string;
  orderNo: string;
  planKey?: null | string;
  points?: number | null;
  pointsPackageKey?: null | string;
  userId: string;
};

export type PaymentConfig = {
  alipay: {
    alipayPublicKey: string;
    appId: string;
    appPrivateKey: string;
    enabled: boolean;
    environment: "production" | "sandbox";
    notifyUrl: string;
    product: AlipayProduct;
    returnUrl: string;
    sellerId: string;
    signType: "RSA2";
  };
  defaultProvider: PaymentProvider;
  publicBaseUrl: string;
  wechat: {
    apiV2Key: string;
    apiV3Key: string;
    appid: string;
    certificateSerialNo: string;
    enabled: boolean;
    mchid: string;
    mode: WechatMode;
    notifyUrl: string;
    paymentScene: WechatScene;
    platformCertificate: string;
    platformCertificateSerialNo: string;
    privateKey: string;
    spAppid: string;
    spMchid: string;
    subAppid: string;
    subMchid: string;
    wechatpayPublicKey: string;
    wechatpayPublicKeyId: string;
  };
};

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
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

const SECRET_PATHS = new Set([
  "alipay.appPrivateKey",
  "alipay.alipayPublicKey",
  "wechat.apiV2Key",
  "wechat.apiV3Key",
  "wechat.privateKey",
  "wechat.wechatpayPublicKey",
  "wechat.platformCertificate",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizePem(value: string, label: "PRIVATE KEY" | "PUBLIC KEY" | "CERTIFICATE") {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.includes("-----BEGIN")) return trimmed.replace(/\\n/g, "\n");
  const body = trimmed.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") || trimmed;
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
}

function deepMergePaymentConfig(base: PaymentConfig, patch: unknown, keepSecrets = false, path: string[] = []): any {
  if (!isRecord(base)) return patch === undefined ? base : patch;
  const source = isRecord(patch) ? patch : {};
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(base)) {
    const nextPath = [...path, key];
    const pathKey = nextPath.join(".");
    const nextValue = source[key];
    const baseValue = (base as any)[key];

    if (isRecord(baseValue)) {
      result[key] = deepMergePaymentConfig(baseValue as any, nextValue, keepSecrets, nextPath);
    } else if (keepSecrets && SECRET_PATHS.has(pathKey) && typeof nextValue === "string" && !nextValue.trim()) {
      result[key] = baseValue;
    } else if (nextValue !== undefined && nextValue !== null) {
      result[key] = nextValue;
    }
  }

  return result;
}

function normalizeConfig(value: unknown): PaymentConfig {
  const merged = deepMergePaymentConfig(DEFAULT_PAYMENT_CONFIG, value) as PaymentConfig;
  merged.defaultProvider = merged.defaultProvider === "wechat" ? "wechat" : "alipay";
  merged.alipay.environment = merged.alipay.environment === "production" ? "production" : "sandbox";
  merged.alipay.product = merged.alipay.product === "wap" ? "wap" : "page";
  merged.alipay.signType = "RSA2";
  merged.wechat.mode = merged.wechat.mode === "serviceProvider" ? "serviceProvider" : "merchant";
  merged.wechat.paymentScene = merged.wechat.paymentScene === "native" ? "native" : "h5";
  return merged;
}

export async function getPaymentConfig(): Promise<PaymentConfig> {
  const row = await db("o_setting").where("key", PAYMENT_CONFIG_KEY).first();
  if (!row?.value) return DEFAULT_PAYMENT_CONFIG;
  try {
    return normalizeConfig(JSON.parse(String(row.value)));
  } catch {
    return DEFAULT_PAYMENT_CONFIG;
  }
}

export async function savePaymentConfig(input: unknown) {
  const current = await getPaymentConfig();
  const next = normalizeConfig(deepMergePaymentConfig(current, input, true));
  const payload = JSON.stringify(next);
  const exists = await db("o_setting").where("key", PAYMENT_CONFIG_KEY).first();
  if (exists) await db("o_setting").where("key", PAYMENT_CONFIG_KEY).update({ value: payload });
  else await db("o_setting").insert({ key: PAYMENT_CONFIG_KEY, value: payload });
  return next;
}

export function maskPaymentConfig(config: PaymentConfig) {
  const masked = JSON.parse(JSON.stringify(config)) as PaymentConfig & Record<string, any>;
  for (const path of SECRET_PATHS) {
    const [group, key] = path.split(".");
    masked[group][`${key}Configured`] = Boolean(masked[group][key]);
    masked[group][key] = "";
  }
  return masked;
}

export function getEnabledPaymentOptions(config: PaymentConfig) {
  const providers: Array<{ label: string; value: PaymentProvider }> = [];
  if (config.alipay.enabled) providers.push({ label: "支付宝", value: "alipay" });
  if (config.wechat.enabled) providers.push({ label: "微信支付", value: "wechat" });
  const defaultProvider = providers.some((item) => item.value === config.defaultProvider) ? config.defaultProvider : providers[0]?.value || "alipay";
  return { defaultProvider, providers };
}

function nowAlipayTimestamp() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function amountYuan(value: unknown) {
  return Number(value || 0).toFixed(2);
}

function amountFen(value: unknown) {
  return Math.round(Number(value || 0) * 100);
}

function cleanSubject(value: string) {
  return value.replace(/[\/=&]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "DramaStudio 订单";
}

function orderSubject(order: PaymentOrder) {
  if (order.kind === "plan") return cleanSubject(`DramaStudio 会员订阅 ${order.planKey || order.orderNo}`);
  return cleanSubject(`DramaStudio 积分包 ${order.points || ""} 积分`);
}

function requestBaseUrl(req?: Request, config?: PaymentConfig) {
  const configured = config?.publicBaseUrl?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (!req) return "";
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = forwardedProto || req.protocol || "http";
  return `${proto}://${req.get("host")}`;
}

function callbackUrl(req: Request | undefined, config: PaymentConfig, configured: string, pathname: string) {
  if (configured.trim()) return configured.trim();
  const baseUrl = requestBaseUrl(req, config);
  if (!baseUrl) throw new Error("请先在支付设置中配置公网访问地址");
  return `${baseUrl}${pathname}`;
}

function encodeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function alipayGateway(config: PaymentConfig) {
  return config.alipay.environment === "production" ? ALIPAY_PRODUCTION_GATEWAY : ALIPAY_SANDBOX_GATEWAY;
}

function alipaySignContent(params: Record<string, string>) {
  return Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type" && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

function signAlipay(params: Record<string, string>, privateKey: string) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(alipaySignContent(params), "utf8");
  signer.end();
  return signer.sign(normalizePem(privateKey, "PRIVATE KEY"), "base64");
}

function verifyAlipay(params: Record<string, string>, publicKey: string) {
  const signature = params.sign;
  if (!signature) return false;
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(alipaySignContent(params), "utf8");
  verifier.end();
  return verifier.verify(normalizePem(publicKey, "PUBLIC KEY"), signature, "base64");
}

function buildAlipayForm(params: Record<string, string>, gateway: string) {
  const inputs = Object.entries(params)
    .map(([key, value]) => `<input type="hidden" name="${encodeHtml(key)}" value="${encodeHtml(value)}" />`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>正在跳转支付宝</title></head><body><form id="alipaySubmit" method="post" action="${encodeHtml(gateway)}">${inputs}</form><script>document.getElementById("alipaySubmit").submit();</script></body></html>`;
}

async function createAlipayPayment(config: PaymentConfig, order: PaymentOrder, req?: Request) {
  if (!config.alipay.appId || !config.alipay.appPrivateKey || !config.alipay.alipayPublicKey) {
    throw new Error("支付宝支付参数未配置完整");
  }

  const method = config.alipay.product === "wap" ? "alipay.trade.wap.pay" : "alipay.trade.page.pay";
  const productCode = config.alipay.product === "wap" ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY";
  const params: Record<string, string> = {
    app_id: config.alipay.appId,
    method,
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: nowAlipayTimestamp(),
    version: "1.0",
    notify_url: callbackUrl(req, config, config.alipay.notifyUrl, "/api/payment/alipay/notify"),
    return_url: callbackUrl(req, config, config.alipay.returnUrl, "/api/payment/alipay/return"),
    biz_content: JSON.stringify({
      out_trade_no: order.orderNo,
      total_amount: amountYuan(order.amountCny),
      subject: orderSubject(order),
      product_code: productCode,
      passback_params: encodeURIComponent(JSON.stringify({ orderId: order.id, userId: order.userId })),
    }),
  };
  params.sign = signAlipay(params, config.alipay.appPrivateKey);
  return {
    provider: "alipay",
    type: "alipay_form",
    formHtml: buildAlipayForm(params, alipayGateway(config)),
    orderNo: order.orderNo,
  };
}

function getClientIp(req?: Request) {
  if (!req) return "127.0.0.1";
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.ip || req.socket.remoteAddress || "127.0.0.1";
}

function wechatMchid(config: PaymentConfig) {
  return config.wechat.mode === "serviceProvider" ? config.wechat.spMchid : config.wechat.mchid;
}

function wechatVerifier(config: PaymentConfig) {
  if (config.wechat.wechatpayPublicKey) {
    return {
      serial: config.wechat.wechatpayPublicKeyId,
      key: normalizePem(config.wechat.wechatpayPublicKey, "PUBLIC KEY"),
    };
  }
  if (config.wechat.platformCertificate) {
    return {
      serial: config.wechat.platformCertificateSerialNo,
      key: normalizePem(config.wechat.platformCertificate, "CERTIFICATE"),
    };
  }
  return null;
}

function signWechatMessage(message: string, privateKey: string) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(message, "utf8");
  signer.end();
  return signer.sign(normalizePem(privateKey, "PRIVATE KEY"), "base64");
}

function verifyWechatMessage(message: string, signature: string, publicKey: string) {
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(message, "utf8");
  verifier.end();
  return verifier.verify(publicKey, signature, "base64");
}

function assertWechatConfig(config: PaymentConfig) {
  const wechat = config.wechat;
  const mchid = wechatMchid(config);
  if (!mchid || !wechat.privateKey || !wechat.certificateSerialNo || !wechat.apiV3Key) {
    throw new Error("微信支付商户号、证书序列号、APIv3密钥或私钥未配置完整");
  }
  if (wechat.mode === "merchant" && !wechat.appid) throw new Error("微信支付商户模式 appid 未配置");
  if (wechat.mode === "serviceProvider" && (!wechat.spAppid || !wechat.spMchid || !wechat.subMchid)) {
    throw new Error("微信支付服务商模式参数未配置完整");
  }
  if (!wechatVerifier(config)) throw new Error("微信支付公钥或平台证书未配置，无法验签");
}

async function wechatRequest(config: PaymentConfig, method: "GET" | "POST", path: string, body?: Record<string, unknown>) {
  assertWechatConfig(config);
  const bodyText = body ? JSON.stringify(body) : "";
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyText}\n`;
  const signature = signWechatMessage(message, config.wechat.privateKey);
  const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${wechatMchid(config)}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.wechat.certificateSerialNo}"`;

  const response = await axios.request<string>({
    baseURL: WECHATPAY_GATEWAY,
    url: path,
    method,
    data: bodyText || undefined,
    headers: {
      Accept: "application/json",
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    transformResponse: [(data) => data],
  });

  const rawBody = typeof response.data === "string" ? response.data : JSON.stringify(response.data || "");
  const verifier = wechatVerifier(config);
  const responseSerial = String(response.headers["wechatpay-serial"] || "");
  const responseSignature = String(response.headers["wechatpay-signature"] || "");
  const responseTimestamp = String(response.headers["wechatpay-timestamp"] || "");
  const responseNonce = String(response.headers["wechatpay-nonce"] || "");
  if (!verifier || !responseSignature || !responseTimestamp || !responseNonce) throw new Error("微信支付响应缺少验签信息");
  if (verifier.serial && responseSerial && responseSerial !== verifier.serial) throw new Error("微信支付响应证书序列号不匹配");
  const verifyMessage = `${responseTimestamp}\n${responseNonce}\n${rawBody}\n`;
  if (!verifyWechatMessage(verifyMessage, responseSignature, verifier.key)) throw new Error("微信支付响应验签失败");
  return rawBody ? JSON.parse(rawBody) : {};
}

async function createWechatPayment(config: PaymentConfig, order: PaymentOrder, req?: Request) {
  const wechat = config.wechat;
  const scene = wechat.paymentScene;
  const notifyUrl = callbackUrl(req, config, wechat.notifyUrl, "/api/payment/wechat/notify");
  const amount = { total: amountFen(order.amountCny), currency: "CNY" };
  const description = orderSubject(order);

  const body: Record<string, unknown> =
    wechat.mode === "serviceProvider"
      ? {
          sp_appid: wechat.spAppid,
          sp_mchid: wechat.spMchid,
          sub_mchid: wechat.subMchid,
          ...(wechat.subAppid ? { sub_appid: wechat.subAppid } : {}),
          description,
          out_trade_no: order.orderNo,
          notify_url: notifyUrl,
          amount,
        }
      : {
          appid: wechat.appid,
          mchid: wechat.mchid,
          description,
          out_trade_no: order.orderNo,
          notify_url: notifyUrl,
          amount,
        };

  if (scene === "h5") {
    body.scene_info = {
      payer_client_ip: getClientIp(req),
      h5_info: { type: "Wap" },
    };
  }

  const path =
    wechat.mode === "serviceProvider" ? `/v3/pay/partner/transactions/${scene}` : `/v3/pay/transactions/${scene}`;
  const result = await wechatRequest(config, "POST", path, body);
  return {
    provider: "wechat",
    type: scene === "native" ? "wechat_native" : "wechat_h5",
    orderNo: order.orderNo,
    codeUrl: result.code_url || "",
    h5Url: result.h5_url || "",
  };
}

export async function createPaymentForOrder(order: PaymentOrder, provider: PaymentProvider | undefined, req?: Request) {
  const config = await getPaymentConfig();
  const selected = provider || getEnabledPaymentOptions(config).defaultProvider;
  if (Number(order.amountCny || 0) <= 0) {
    return { provider: "free", type: "none", orderNo: order.orderNo };
  }
  if (selected === "alipay") {
    if (!config.alipay.enabled) throw new Error("支付宝支付未启用");
    return createAlipayPayment(config, order, req);
  }
  if (!config.wechat.enabled) throw new Error("微信支付未启用");
  return createWechatPayment(config, order, req);
}

function bodyToStringMap(body: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, value == null ? "" : String(value)]));
}

export async function handleAlipayNotify(body: Record<string, unknown>) {
  const config = await getPaymentConfig();
  const params = bodyToStringMap(body);
  if (!verifyAlipay(params, config.alipay.alipayPublicKey)) throw new Error("支付宝异步通知验签失败");
  if (params.app_id !== config.alipay.appId) throw new Error("支付宝 app_id 不匹配");
  if (config.alipay.sellerId && params.seller_id !== config.alipay.sellerId) throw new Error("支付宝 seller_id 不匹配");
  if (!["TRADE_SUCCESS", "TRADE_FINISHED"].includes(params.trade_status)) return false;

  await markMembershipOrderPaidByOrderNo({
    orderNo: params.out_trade_no,
    amountCny: Number(params.total_amount || 0),
    paymentMethod: "alipay",
    externalTradeNo: params.trade_no,
    metadata: {
      alipayNotifyId: params.notify_id,
      alipayTradeStatus: params.trade_status,
      buyerId: params.buyer_id || params.buyer_open_id || "",
    },
  });
  return true;
}

async function queryAlipayOrder(config: PaymentConfig, orderNo: string) {
  const params: Record<string, string> = {
    app_id: config.alipay.appId,
    method: "alipay.trade.query",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: nowAlipayTimestamp(),
    version: "1.0",
    biz_content: JSON.stringify({ out_trade_no: orderNo }),
  };
  params.sign = signAlipay(params, config.alipay.appPrivateKey);
  const search = new URLSearchParams(params);
  const response = await axios.get(`${alipayGateway(config)}?${search.toString()}`);
  return response.data?.alipay_trade_query_response || {};
}

export async function handleAlipayReturn(query: Record<string, unknown>) {
  const config = await getPaymentConfig();
  const params = bodyToStringMap(query);
  if (!verifyAlipay(params, config.alipay.alipayPublicKey)) throw new Error("支付宝同步返回验签失败");
  const result = await queryAlipayOrder(config, params.out_trade_no);
  if (["TRADE_SUCCESS", "TRADE_FINISHED"].includes(result.trade_status)) {
    await markMembershipOrderPaidByOrderNo({
      orderNo: params.out_trade_no,
      amountCny: Number(result.total_amount || 0),
      paymentMethod: "alipay",
      externalTradeNo: result.trade_no,
      metadata: {
        alipayTradeStatus: result.trade_status,
        settledByReturnQuery: true,
      },
    });
  }
  return result;
}

function decryptWechatResource(config: PaymentConfig, resource: any) {
  const key = Buffer.from(config.wechat.apiV3Key, "utf8");
  if (key.length !== 32) throw new Error("微信支付 APIv3 密钥必须是 32 字节");
  const encrypted = Buffer.from(String(resource.ciphertext || ""), "base64");
  const authTag = encrypted.subarray(encrypted.length - 16);
  const cipherText = encrypted.subarray(0, encrypted.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(String(resource.nonce || ""), "utf8"));
  decipher.setAuthTag(authTag);
  if (resource.associated_data) decipher.setAAD(Buffer.from(String(resource.associated_data), "utf8"));
  const decoded = Buffer.concat([decipher.update(cipherText), decipher.final()]).toString("utf8");
  return JSON.parse(decoded);
}

export async function handleWechatNotify(rawBody: string, headers: Record<string, unknown>) {
  const config = await getPaymentConfig();
  const verifier = wechatVerifier(config);
  if (!verifier) throw new Error("微信支付验签公钥未配置");

  const timestamp = String(headers["wechatpay-timestamp"] || "");
  const nonce = String(headers["wechatpay-nonce"] || "");
  const signature = String(headers["wechatpay-signature"] || "");
  const serial = String(headers["wechatpay-serial"] || "");
  if (verifier.serial && serial && serial !== verifier.serial) throw new Error("微信支付回调证书序列号不匹配");
  if (!verifyWechatMessage(`${timestamp}\n${nonce}\n${rawBody}\n`, signature, verifier.key)) throw new Error("微信支付回调验签失败");

  const payload = JSON.parse(rawBody || "{}");
  const resource = decryptWechatResource(config, payload.resource);
  if (resource.trade_state !== "SUCCESS") return false;

  if (config.wechat.mode === "merchant" && resource.mchid && resource.mchid !== config.wechat.mchid) throw new Error("微信支付商户号不匹配");
  if (config.wechat.mode === "serviceProvider" && resource.sub_mchid && resource.sub_mchid !== config.wechat.subMchid) {
    throw new Error("微信支付子商户号不匹配");
  }

  await markMembershipOrderPaidByOrderNo({
    orderNo: resource.out_trade_no,
    amountCny: Number(resource.amount?.total || 0) / 100,
    paymentMethod: "wechat",
    externalTradeNo: resource.transaction_id,
    metadata: {
      wechatEventId: payload.id,
      wechatTradeState: resource.trade_state,
      payerOpenid: resource.payer?.openid || "",
    },
  });
  return true;
}
