/**
 * Toonflow AI供应商适配 - 火键API
 * @version 1.0
 */

// ============================================================
// 类型定义
// ============================================================

type VideoMode =
  | "singleImage"
  | "startEndRequired"
  | "endFrameOptional"
  | "startFrameOptional"
  | "text"
  | (`videoReference:${number}` | `imageReference:${number}` | `audioReference:${number}`)[];

interface TextModel {
  name: string;
  modelName: string;
  type: "text";
  think: boolean;
}

interface ImageModel {
  name: string;
  modelName: string;
  type: "image";
  mode: ("text" | "singleImage" | "multiReference")[];
  associationSkills?: string;
}

interface VideoModel {
  name: string;
  modelName: string;
  type: "video";
  mode: VideoMode[];
  associationSkills?: string;
  audio: "optional" | false | true;
  durationResolutionMap: { duration: number[]; resolution: string[] }[];
}

interface TTSModel {
  name: string;
  modelName: string;
  type: "tts";
  voices: { title: string; voice: string }[];
}

interface VendorConfig {
  id: string;
  version: string;
  name: string;
  author: string;
  description?: string;
  icon?: string;
  inputs: { key: string; label: string; type: "text" | "password" | "url"; required: boolean; placeholder?: string }[];
  inputValues: Record<string, string>;
  models: (TextModel | ImageModel | VideoModel | TTSModel)[];
}

type ReferenceList =
  | { type: "image"; sourceType: "base64"; base64: string }
  | { type: "audio"; sourceType: "base64"; base64: string }
  | { type: "video"; sourceType: "base64"; base64: string };

interface ImageConfig {
  prompt: string;
  referenceList?: Extract<ReferenceList, { type: "image" }>[];
  size: "1K" | "2K" | "4K";
  aspectRatio: `${number}:${number}`;
}

interface VideoConfig {
  duration: number;
  resolution: string;
  aspectRatio: "16:9" | "9:16";
  prompt: string;
  referenceList?: ReferenceList[];
  audio?: boolean;
  mode: VideoMode[];
}

interface TTSConfig {
  text: string;
  voice: string;
  speechRate: number;
  pitchRate: number;
  volume: number;
  referenceList?: Extract<ReferenceList, { type: "audio" }>[];
}

interface PollResult {
  completed: boolean;
  data?: string;
  error?: string;
}

// ============================================================
// 全局声明
// ============================================================

declare const axios: any;
declare const logger: (msg: string) => void;
declare const jsonwebtoken: any;
declare const zipImage: (base64: string, size: number) => Promise<string>;
declare const zipImageResolution: (base64: string, w: number, h: number) => Promise<string>;
declare const mergeImages: (base64Arr: string[], maxSize?: string) => Promise<string>;
declare const urlToBase64: (url: string) => Promise<string>;
declare const pollTask: (fn: () => Promise<PollResult>, interval?: number, timeout?: number) => Promise<PollResult>;
declare const createOpenAI: any;
declare const createDeepSeek: any;
declare const createZhipu: any;
declare const createQwen: any;
declare const createAnthropic: any;
declare const createOpenAICompatible: any;
declare const createXai: any;
declare const createMinimax: any;
declare const createGoogleGenerativeAI: any;
declare const FormData: any;
declare const Buffer: any;
declare const exports: {
  vendor: VendorConfig;
  textRequest: (m: TextModel, t: boolean, tl: 0 | 1 | 2 | 3) => any;
  imageRequest: (c: ImageConfig, m: ImageModel) => Promise<string>;
  videoRequest: (c: VideoConfig, m: VideoModel) => Promise<string>;
  ttsRequest: (c: TTSConfig, m: TTSModel) => Promise<string>;
  checkForUpdates?: () => Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }>;
  updateVendor?: () => Promise<string>;
};

// ============================================================
// 供应商配置
// ============================================================

const vendor: VendorConfig = {
  id: "esdli",
  version: "1.1",
  author: "Toonflow",
  name: "火键API",
  description:
    "火键API 中转站适配。文档地址：https://esdli.apifox.cn/ 。默认请求地址为 https://api.esdli.com，文本接口兼容 OpenAI Chat Completions。",
  inputs: [
    { key: "apiKey", label: "API密钥", type: "password", required: true, placeholder: "Bearer sk-... 或 sk-..." },
    { key: "baseUrl", label: "请求地址", type: "url", required: true, placeholder: "https://api.esdli.com 或 https://api.esdli.com/v1" },
    { key: "enhancePrompt", label: "视频提示词增强", type: "text", required: false, placeholder: "true 或 false，默认 true" },
  ],
  inputValues: {
    apiKey: "",
    baseUrl: "https://api.esdli.com",
    enhancePrompt: "true",
  },
  models: [
    // 官方 pricing_new 文本/对话模型，并保留 Apifox 文档中的常用别名
    { name: "claude-opus-4-8", modelName: "claude-opus-4-8", type: "text", think: false },
    { name: "gemini-3.5-flash", modelName: "gemini-3.5-flash", type: "text", think: false },
    { name: "qwen3.7-max", modelName: "qwen3.7-max", type: "text", think: false },
    { name: "gemini-3.1-flash-lite", modelName: "gemini-3.1-flash-lite", type: "text", think: false },
    { name: "gpt-chat-latest", modelName: "gpt-chat-latest", type: "text", think: false },
    { name: "grok-4.2-fast", modelName: "grok-4.2-fast", type: "text", think: false },
    { name: "claude-opus-4-7", modelName: "claude-opus-4-7", type: "text", think: false },
    { name: "doubao-seed-2-0-lite-260428", modelName: "doubao-seed-2-0-lite-260428", type: "text", think: false },
    { name: "doubao-seed-2-0-mini-260428", modelName: "doubao-seed-2-0-mini-260428", type: "text", think: false },
    { name: "gpt-5.5-pro", modelName: "gpt-5.5-pro", type: "text", think: true },
    { name: "qwen3.6-max-preview", modelName: "qwen3.6-max-preview", type: "text", think: false },
    { name: "deepseek-v4-flash", modelName: "deepseek-v4-flash", type: "text", think: false },
    { name: "deepseek-v4-pro", modelName: "deepseek-v4-pro", type: "text", think: true },
    { name: "gpt-5.5", modelName: "gpt-5.5", type: "text", think: true },
    { name: "grok-4-20-non-reasoning", modelName: "grok-4-20-non-reasoning", type: "text", think: false },
    { name: "grok-4-20-reasoning", modelName: "grok-4-20-reasoning", type: "text", think: true },
    { name: "gpt-5.4-mini", modelName: "gpt-5.4-mini", type: "text", think: true },
    { name: "gpt-5.4-mini-2026-03-17", modelName: "gpt-5.4-mini-2026-03-17", type: "text", think: true },
    { name: "gpt-5.4-nano", modelName: "gpt-5.4-nano", type: "text", think: true },
    { name: "gpt-5.4-nano-2026-03-17", modelName: "gpt-5.4-nano-2026-03-17", type: "text", think: true },
    { name: "mimo-v2.5", modelName: "mimo-v2.5", type: "text", think: false },
    { name: "mimo-v2.5-pro", modelName: "mimo-v2.5-pro", type: "text", think: false },
    { name: "qwen3.6-27b", modelName: "qwen3.6-27b", type: "text", think: false },
    { name: "qwen3.6-35b-a3b", modelName: "qwen3.6-35b-a3b", type: "text", think: false },
    { name: "doubao-seed-2-0-code-preview-260215", modelName: "doubao-seed-2-0-code-preview-260215", type: "text", think: true },
    { name: "doubao-seed-2-0-lite-260215", modelName: "doubao-seed-2-0-lite-260215", type: "text", think: false },
    { name: "doubao-seed-2-0-mini-260215", modelName: "doubao-seed-2-0-mini-260215", type: "text", think: false },
    { name: "doubao-seed-2-0-pro-260215", modelName: "doubao-seed-2-0-pro-260215", type: "text", think: false },
    { name: "gemini-3.1-pro-preview", modelName: "gemini-3.1-pro-preview", type: "text", think: true },
    { name: "gpt-5.4", modelName: "gpt-5.4", type: "text", think: true },
    { name: "MiniMax-M2.7", modelName: "MiniMax-M2.7", type: "text", think: false },
    { name: "gpt-5.4-pro", modelName: "gpt-5.4-pro", type: "text", think: true },
    { name: "gpt-5.4-pro-2026-03-05", modelName: "gpt-5.4-pro-2026-03-05", type: "text", think: true },
    { name: "gpt-5.3-chat-latest", modelName: "gpt-5.3-chat-latest", type: "text", think: true },
    { name: "qwen3.6-plus", modelName: "qwen3.6-plus", type: "text", think: false },
    { name: "qwen3.6-plus-2026-04-02", modelName: "qwen3.6-plus-2026-04-02", type: "text", think: false },
    { name: "claude-sonnet-4-6", modelName: "claude-sonnet-4-6", type: "text", think: false },
    { name: "gpt-5.3-codex-spark", modelName: "gpt-5.3-codex-spark", type: "text", think: true },
    { name: "claude-opus-4-6", modelName: "claude-opus-4-6", type: "text", think: false },
    { name: "gpt-5.2", modelName: "gpt-5.2", type: "text", think: true },
    { name: "gpt-5.2-chat", modelName: "gpt-5.2-chat", type: "text", think: true },
    { name: "gpt-5.2-chat-latest", modelName: "gpt-5.2-chat-latest", type: "text", think: true },
    { name: "gpt-5.2-pro", modelName: "gpt-5.2-pro", type: "text", think: true },
    { name: "claude-opus-4-5-20251101", modelName: "claude-opus-4-5-20251101", type: "text", think: false },
    { name: "gemini-3-pro-preview", modelName: "gemini-3-pro-preview", type: "text", think: true },
    { name: "gpt-5.1", modelName: "gpt-5.1", type: "text", think: true },
    { name: "gpt-5.1-2025-11-13", modelName: "gpt-5.1-2025-11-13", type: "text", think: true },
    { name: "gpt-5.3-codex", modelName: "gpt-5.3-codex", type: "text", think: true },
    { name: "grok-4.2", modelName: "grok-4.2", type: "text", think: true },
    { name: "MiniMax-M2.5", modelName: "MiniMax-M2.5", type: "text", think: false },
    { name: "glm-4.7", modelName: "glm-4.7", type: "text", think: true },
    { name: "glm-5.1", modelName: "glm-5.1", type: "text", think: true },
    { name: "claude-haiku-4-5-20251001", modelName: "claude-haiku-4-5-20251001", type: "text", think: true },
    { name: "deepseek-v3.2", modelName: "deepseek-v3.2", type: "text", think: false },
    { name: "gemini-3-flash-preview", modelName: "gemini-3-flash-preview", type: "text", think: false },
    { name: "kimi-k2.5", modelName: "kimi-k2.5", type: "text", think: false },
    { name: "claude-sonnet-4-5-20250929", modelName: "claude-sonnet-4-5-20250929", type: "text", think: false },
    { name: "doubao-seed-1-8-251228", modelName: "doubao-seed-1-8-251228", type: "text", think: false },
    { name: "glm-5", modelName: "glm-5", type: "text", think: false },
    { name: "gemini-3-pro-preview-11-2025", modelName: "gemini-3-pro-preview-11-2025", type: "text", think: true },
    { name: "qwen3.5-397b-a17b", modelName: "qwen3.5-397b-a17b", type: "text", think: true },
    { name: "qwen3.5-plus", modelName: "qwen3.5-plus", type: "text", think: true },
    { name: "qwen3.5-plus-2026-02-15", modelName: "qwen3.5-plus-2026-02-15", type: "text", think: true },
    { name: "qwen-plus", modelName: "qwen-plus", type: "text", think: false },
    { name: "qwen-plus-2025-12-01", modelName: "qwen-plus-2025-12-01", type: "text", think: false },
    { name: "qwen3-max-2026-01-23", modelName: "qwen3-max-2026-01-23", type: "text", think: true },
    { name: "claude-opus-4-1-20250805", modelName: "claude-opus-4-1-20250805", type: "text", think: false },
    { name: "claude-opus-4-20250514", modelName: "claude-opus-4-20250514", type: "text", think: false },
    { name: "claude-sonnet-4-20250514", modelName: "claude-sonnet-4-20250514", type: "text", think: false },
    { name: "gemini-2.5-pro", modelName: "gemini-2.5-pro", type: "text", think: true },
    { name: "gpt-5", modelName: "gpt-5", type: "text", think: true },
    { name: "gpt-5-2025-08-07", modelName: "gpt-5-2025-08-07", type: "text", think: true },
    { name: "gpt-5-codex", modelName: "gpt-5-codex", type: "text", think: true },
    { name: "gpt-5-mini-2025-08-07", modelName: "gpt-5-mini-2025-08-07", type: "text", think: true },
    { name: "gpt-5-nano-2025-08-07", modelName: "gpt-5-nano-2025-08-07", type: "text", think: true },
    { name: "gpt-5-pro", modelName: "gpt-5-pro", type: "text", think: true },
    { name: "gpt-5-search-api", modelName: "gpt-5-search-api", type: "text", think: true },
    { name: "gpt-5-search-api-2025-10-14", modelName: "gpt-5-search-api-2025-10-14", type: "text", think: true },
    { name: "gpt-5.2-codex", modelName: "gpt-5.2-codex", type: "text", think: true },
    { name: "minimax-m2.1", modelName: "minimax-m2.1", type: "text", think: false },
    { name: "gpt-5.1-all", modelName: "gpt-5.1-all", type: "text", think: true },
    { name: "gpt-5.1-chat", modelName: "gpt-5.1-chat", type: "text", think: true },
    { name: "gpt-5.1-chat-latest", modelName: "gpt-5.1-chat-latest", type: "text", think: true },
    { name: "gpt-5.1-codex-max", modelName: "gpt-5.1-codex-max", type: "text", think: true },
    { name: "gpt-5.1-thinking-all", modelName: "gpt-5.1-thinking-all", type: "text", think: true },
    { name: "gpt-5.2-all", modelName: "gpt-5.2-all", type: "text", think: true },
    { name: "qwen-plus-character", modelName: "qwen-plus-character", type: "text", think: false },
    { name: "deepseek-v3.2-fast", modelName: "deepseek-v3.2-fast", type: "text", think: false },
    { name: "gemini-2.5-flash", modelName: "gemini-2.5-flash", type: "text", think: false },
    { name: "glm-4.6", modelName: "glm-4.6", type: "text", think: false },
    { name: "gpt-5-chat-latest", modelName: "gpt-5-chat-latest", type: "text", think: true },
    { name: "gpt-5-mini", modelName: "gpt-5-mini", type: "text", think: true },
    { name: "gpt-5-nano", modelName: "gpt-5-nano", type: "text", think: true },
    { name: "gpt-5.1-codex", modelName: "gpt-5.1-codex", type: "text", think: true },
    { name: "kimi-k2-250905", modelName: "kimi-k2-250905", type: "text", think: false },
    { name: "qwen3-vl-30b-a3b-instruct", modelName: "qwen3-vl-30b-a3b-instruct", type: "text", think: false },
    { name: "qwen3-vl-30b-a3b-thinking", modelName: "qwen3-vl-30b-a3b-thinking", type: "text", think: true },
    { name: "qwen3-vl-32b-instruct", modelName: "qwen3-vl-32b-instruct", type: "text", think: false },
    { name: "qwen3-vl-32b-thinking", modelName: "qwen3-vl-32b-thinking", type: "text", think: true },
    { name: "qwen3.5-122b-a10b", modelName: "qwen3.5-122b-a10b", type: "text", think: true },
    { name: "qwen3.5-27b", modelName: "qwen3.5-27b", type: "text", think: false },
    { name: "qwen3.5-35b-a3b", modelName: "qwen3.5-35b-a3b", type: "text", think: false },
    { name: "deepseek-v3.1-fast", modelName: "deepseek-v3.1-fast", type: "text", think: false },
    { name: "glm-4", modelName: "glm-4", type: "text", think: false },
    { name: "glm-4.5", modelName: "glm-4.5", type: "text", think: true },
    { name: "gpt-5-all", modelName: "gpt-5-all", type: "text", think: true },
    { name: "gpt-5-pro-all", modelName: "gpt-5-pro-all", type: "text", think: true },
    { name: "gpt-5-thinking-all", modelName: "gpt-5-thinking-all", type: "text", think: true },
    { name: "gpt-5.1-codex-mini", modelName: "gpt-5.1-codex-mini", type: "text", think: true },
    { name: "grok-4.1", modelName: "grok-4.1", type: "text", think: false },
    { name: "o1-pro", modelName: "o1-pro", type: "text", think: true },
    { name: "o1-pro-2025-03-19", modelName: "o1-pro-2025-03-19", type: "text", think: true },
    { name: "qwen2.5-coder-32b-instruct", modelName: "qwen2.5-coder-32b-instruct", type: "text", think: false },
    { name: "qwen2.5-math-7b-instruct", modelName: "qwen2.5-math-7b-instruct", type: "text", think: false },
    { name: "qwen3-30b-a3b-think", modelName: "qwen3-30b-a3b-think", type: "text", think: true },
    { name: "qwen3-30b-a3b-thinking-2507", modelName: "qwen3-30b-a3b-thinking-2507", type: "text", think: true },
    { name: "qwen3-coder", modelName: "qwen3-coder", type: "text", think: true },
    { name: "qwen3-coder-flash", modelName: "qwen3-coder-flash", type: "text", think: false },
    { name: "qwen3-max", modelName: "qwen3-max", type: "text", think: false },
    { name: "qwen3-vl-235b-a22b-instruct", modelName: "qwen3-vl-235b-a22b-instruct", type: "text", think: false },
    { name: "grok-4-1-fast-non-reasoning", modelName: "grok-4-1-fast-non-reasoning", type: "text", think: false },
    { name: "MiniMax-M2", modelName: "MiniMax-M2", type: "text", think: false },
    { name: "grok-4", modelName: "grok-4", type: "text", think: false },
    { name: "grok-4-1-fast-reasoning", modelName: "grok-4-1-fast-reasoning", type: "text", think: true },
    { name: "grok-4-fast", modelName: "grok-4-fast", type: "text", think: false },
    { name: "grok-4-fast-non-reasoning", modelName: "grok-4-fast-non-reasoning", type: "text", think: false },
    { name: "grok-4.1-fast", modelName: "grok-4.1-fast", type: "text", think: false },
    { name: "qwen2.5-coder-14b-instruct", modelName: "qwen2.5-coder-14b-instruct", type: "text", think: false },
    { name: "qwen3-30b-a3b-instruct-2507", modelName: "qwen3-30b-a3b-instruct-2507", type: "text", think: false },
    { name: "qwen3-coder-480b-a35b-instruct", modelName: "qwen3-coder-480b-a35b-instruct", type: "text", think: true },
    { name: "qwen3-next-80b-a3b-instruct", modelName: "qwen3-next-80b-a3b-instruct", type: "text", think: false },
    { name: "qwen3-vl-8b-instruct", modelName: "qwen3-vl-8b-instruct", type: "text", think: false },
    { name: "qwen3-vl-8b-thinking", modelName: "qwen3-vl-8b-thinking", type: "text", think: true },
    { name: "qwen3-vl-plus", modelName: "qwen3-vl-plus", type: "text", think: false },
    { name: "deepseek-v3-1-think-250821", modelName: "deepseek-v3-1-think-250821", type: "text", think: true },
    { name: "deepseek-v3.1", modelName: "deepseek-v3.1", type: "text", think: true },
    { name: "deepseek-v3.2-exp", modelName: "deepseek-v3.2-exp", type: "text", think: false },
    { name: "doubao-seed-1-6-250615", modelName: "doubao-seed-1-6-250615", type: "text", think: true },
    { name: "doubao-seed-1-6-251015", modelName: "doubao-seed-1-6-251015", type: "text", think: true },
    { name: "doubao-seed-1-6-flash-250828", modelName: "doubao-seed-1-6-flash-250828", type: "text", think: true },
    { name: "doubao-seed-1-6-thinking-250615", modelName: "doubao-seed-1-6-thinking-250615", type: "text", think: true },
    { name: "doubao-seed-1-6-thinking-250715", modelName: "doubao-seed-1-6-thinking-250715", type: "text", think: true },
    { name: "gemini-2.5-flash-preview-09-2025", modelName: "gemini-2.5-flash-preview-09-2025", type: "text", think: false },
    { name: "gemini-flash-lite-latest", modelName: "gemini-flash-lite-latest", type: "text", think: false },
    { name: "grok-4-fast-reasoning", modelName: "grok-4-fast-reasoning", type: "text", think: true },
    { name: "kimi-k2", modelName: "kimi-k2", type: "text", think: false },
    { name: "kimi-k2-0711-preview", modelName: "kimi-k2-0711-preview", type: "text", think: false },
    { name: "kimi-k2-0905", modelName: "kimi-k2-0905", type: "text", think: false },
    { name: "qwen-plus-latest", modelName: "qwen-plus-latest", type: "text", think: false },
    { name: "qwen3-235b-a22b-instruct-2507", modelName: "qwen3-235b-a22b-instruct-2507", type: "text", think: false },
    { name: "qwen3-coder-30b-a3b-instruct", modelName: "qwen3-coder-30b-a3b-instruct", type: "text", think: true },
    { name: "qwen3-coder-plus", modelName: "qwen3-coder-plus", type: "text", think: true },
    { name: "qwen3-vl-235b-a22b-thinking", modelName: "qwen3-vl-235b-a22b-thinking", type: "text", think: true },
    { name: "qwen3-vl-flash", modelName: "qwen3-vl-flash", type: "text", think: false },
    { name: "ERNIE-Functions-8K", modelName: "ERNIE-Functions-8K", type: "text", think: false },
    { name: "deepseek-v3-1", modelName: "deepseek-v3-1", type: "text", think: false },
    { name: "deepseek-chat", modelName: "deepseek-chat", type: "text", think: false },
    { name: "deepseek-r1", modelName: "deepseek-r1", type: "text", think: true },
    { name: "deepseek-r1-0528", modelName: "deepseek-r1-0528", type: "text", think: true },
    { name: "doubao-seed-1-6-vision-250815", modelName: "doubao-seed-1-6-vision-250815", type: "text", think: false },
    { name: "ERNIE-3.5-8K", modelName: "ERNIE-3.5-8K", type: "text", think: false },
    { name: "ERNIE-4.0-8K", modelName: "ERNIE-4.0-8K", type: "text", think: false },
    { name: "ERNIE-Character-8K", modelName: "ERNIE-Character-8K", type: "text", think: false },
    { name: "ERNIE-Lite-8K", modelName: "ERNIE-Lite-8K", type: "text", think: false },
    { name: "ERNIE-Speed-128K", modelName: "ERNIE-Speed-128K", type: "text", think: false },
    { name: "ERNIE-Speed-8K", modelName: "ERNIE-Speed-8K", type: "text", think: false },
    { name: "ERNIE-Tiny-8K", modelName: "ERNIE-Tiny-8K", type: "text", think: false },
    { name: "gemini-2.0-flash", modelName: "gemini-2.0-flash", type: "text", think: false },
    { name: "gemini-2.5-flash-all", modelName: "gemini-2.5-flash-all", type: "text", think: false },
    { name: "gemini-2.5-flash-lite", modelName: "gemini-2.5-flash-lite", type: "text", think: false },
    { name: "gemini-2.5-flash-lite-preview-06-17", modelName: "gemini-2.5-flash-lite-preview-06-17", type: "text", think: false },
    { name: "gemini-flash-latest", modelName: "gemini-flash-latest", type: "text", think: false },
    { name: "grok-3", modelName: "grok-3", type: "text", think: false },
    { name: "grok-3-deepsearch", modelName: "grok-3-deepsearch", type: "text", think: true },
    { name: "grok-3-mini", modelName: "grok-3-mini", type: "text", think: false },
    { name: "grok-3-reasoner", modelName: "grok-3-reasoner", type: "text", think: true },
    { name: "grok-3-reasoning", modelName: "grok-3-reasoning", type: "text", think: true },
    { name: "deepseek-v3-1-250821", modelName: "deepseek-v3-1-250821", type: "text", think: true },
    { name: "deepseek-reasoner", modelName: "deepseek-reasoner", type: "text", think: true },
    { name: "gemini-2.5-pro-all", modelName: "gemini-2.5-pro-all", type: "text", think: false },
    { name: "gemma-7b-it", modelName: "gemma-7b-it", type: "text", think: false },
    { name: "kimi-k2-instruct", modelName: "kimi-k2-instruct", type: "text", think: false },
    { name: "claude-3-5-haiku-20241022", modelName: "claude-3-5-haiku-20241022", type: "text", think: false },
    { name: "claude-3-5-sonnet-20241022", modelName: "claude-3-5-sonnet-20241022", type: "text", think: false },
    { name: "claude-3-7-sonnet-20250219", modelName: "claude-3-7-sonnet-20250219", type: "text", think: true },
    { name: "claude-3-7-sonnet-latest", modelName: "claude-3-7-sonnet-latest", type: "text", think: true },
    { name: "claude-3-haiku-20240307", modelName: "claude-3-haiku-20240307", type: "text", think: false },
    { name: "claude-3-opus-20240229", modelName: "claude-3-opus-20240229", type: "text", think: false },
    { name: "codex-mini-2025-05-16", modelName: "codex-mini-2025-05-16", type: "text", think: true },
    { name: "davinci-002", modelName: "davinci-002", type: "text", think: false },
    { name: "deepseek-r1-2025-01-20", modelName: "deepseek-r1-2025-01-20", type: "text", think: true },
    { name: "deepseek-r1-250120", modelName: "deepseek-r1-250120", type: "text", think: true },
    { name: "deepseek-r1-250528", modelName: "deepseek-r1-250528", type: "text", think: true },
    { name: "deepseek-r1-distill-llama-70b", modelName: "deepseek-r1-distill-llama-70b", type: "text", think: true },
    { name: "deepseek-r1-distill-qwen-32b", modelName: "deepseek-r1-distill-qwen-32b", type: "text", think: true },
    { name: "deepseek-r1-distill-qwen-7b", modelName: "deepseek-r1-distill-qwen-7b", type: "text", think: true },
    { name: "deepseek-r1-searching", modelName: "deepseek-r1-searching", type: "text", think: true },
    { name: "deepseek-v3", modelName: "deepseek-v3", type: "text", think: false },
    { name: "deepseek-v3-0324", modelName: "deepseek-v3-0324", type: "text", think: false },
    { name: "deepseek-v3-250324", modelName: "deepseek-v3-250324", type: "text", think: false },
    { name: "deepseek-v3-fast", modelName: "deepseek-v3-fast", type: "text", think: false },
    { name: "Dolphin3.0-R1-Mistral-24B", modelName: "Dolphin3.0-R1-Mistral-24B", type: "text", think: false },
    { name: "gemini-2.5-flash-lite-preview-09-2025", modelName: "gemini-2.5-flash-lite-preview-09-2025", type: "text", think: false },
    { name: "glm-3-turbo", modelName: "glm-3-turbo", type: "text", think: false },
    { name: "glm-4-air", modelName: "glm-4-air", type: "text", think: false },
    { name: "glm-4-airx", modelName: "glm-4-airx", type: "text", think: false },
    { name: "glm-4-flash", modelName: "glm-4-flash", type: "text", think: false },
    { name: "glm-4-long", modelName: "glm-4-long", type: "text", think: false },
    { name: "glm-4.5-air", modelName: "glm-4.5-air", type: "text", think: true },
    { name: "glm-4.5-airx", modelName: "glm-4.5-airx", type: "text", think: true },
    { name: "glm-4.5-flash", modelName: "glm-4.5-flash", type: "text", think: true },
    { name: "glm-4.5-x", modelName: "glm-4.5-x", type: "text", think: true },
    { name: "gpt-3.5-turbo", modelName: "gpt-3.5-turbo", type: "text", think: false },
    { name: "gpt-3.5-turbo-0125", modelName: "gpt-3.5-turbo-0125", type: "text", think: false },
    { name: "gpt-3.5-turbo-1106", modelName: "gpt-3.5-turbo-1106", type: "text", think: false },
    { name: "gpt-3.5-turbo-16k", modelName: "gpt-3.5-turbo-16k", type: "text", think: false },
    { name: "gpt-4", modelName: "gpt-4", type: "text", think: false },
    { name: "gpt-4-0613", modelName: "gpt-4-0613", type: "text", think: false },
    { name: "gpt-4-1106-preview", modelName: "gpt-4-1106-preview", type: "text", think: false },
    { name: "gpt-4-32k", modelName: "gpt-4-32k", type: "text", think: false },
    { name: "gpt-4-32k-0613", modelName: "gpt-4-32k-0613", type: "text", think: false },
    { name: "gpt-4-all", modelName: "gpt-4-all", type: "text", think: false },
    { name: "gpt-4-gizmo-*", modelName: "gpt-4-gizmo-*", type: "text", think: false },
    { name: "gpt-4-turbo", modelName: "gpt-4-turbo", type: "text", think: false },
    { name: "gpt-4-turbo-2024-04-09", modelName: "gpt-4-turbo-2024-04-09", type: "text", think: false },
    { name: "gpt-4-turbo-preview", modelName: "gpt-4-turbo-preview", type: "text", think: false },
    { name: "gpt-4.1", modelName: "gpt-4.1", type: "text", think: false },
    { name: "gpt-4.1-2025-04-14", modelName: "gpt-4.1-2025-04-14", type: "text", think: false },
    { name: "gpt-4.1-mini", modelName: "gpt-4.1-mini", type: "text", think: false },
    { name: "gpt-4.1-mini-2025-04-14", modelName: "gpt-4.1-mini-2025-04-14", type: "text", think: false },
    { name: "gpt-4.1-nano", modelName: "gpt-4.1-nano", type: "text", think: false },
    { name: "gpt-4.1-nano-2025-04-14", modelName: "gpt-4.1-nano-2025-04-14", type: "text", think: false },
    { name: "gpt-4o", modelName: "gpt-4o", type: "text", think: false },
    { name: "gpt-4o-2024-05-13", modelName: "gpt-4o-2024-05-13", type: "text", think: false },
    { name: "gpt-4o-2024-08-06", modelName: "gpt-4o-2024-08-06", type: "text", think: false },
    { name: "gpt-4o-2024-11-20", modelName: "gpt-4o-2024-11-20", type: "text", think: false },
    { name: "gpt-4o-all", modelName: "gpt-4o-all", type: "text", think: false },
    { name: "gpt-4o-mini", modelName: "gpt-4o-mini", type: "text", think: false },
    { name: "gpt-4o-mini-2024-07-18", modelName: "gpt-4o-mini-2024-07-18", type: "text", think: false },
    { name: "gpt-4o-mini-search-preview", modelName: "gpt-4o-mini-search-preview", type: "text", think: false },
    { name: "gpt-4o-mini-search-preview-2025-03-11", modelName: "gpt-4o-mini-search-preview-2025-03-11", type: "text", think: false },
    { name: "gpt-4o-search-preview", modelName: "gpt-4o-search-preview", type: "text", think: false },
    { name: "gpt-4o-search-preview-2025-03-11", modelName: "gpt-4o-search-preview-2025-03-11", type: "text", think: false },
    { name: "gpt-oss-120b", modelName: "gpt-oss-120b", type: "text", think: false },
    { name: "gpt-oss-20b", modelName: "gpt-oss-20b", type: "text", think: false },
    { name: "grok-4.3", modelName: "grok-4.3", type: "text", think: true },
    { name: "kimi-k2.6", modelName: "kimi-k2.6", type: "text", think: false },
    { name: "llama-2-13b", modelName: "llama-2-13b", type: "text", think: false },
    { name: "llama-2-70b", modelName: "llama-2-70b", type: "text", think: false },
    { name: "llama-2-7b", modelName: "llama-2-7b", type: "text", think: false },
    { name: "llama-3-70b", modelName: "llama-3-70b", type: "text", think: false },
    { name: "llama-3-8b", modelName: "llama-3-8b", type: "text", think: false },
    { name: "llama-3-sonar-large-32k-chat", modelName: "llama-3-sonar-large-32k-chat", type: "text", think: false },
    { name: "llama-3-sonar-small-32k-chat", modelName: "llama-3-sonar-small-32k-chat", type: "text", think: false },
    { name: "llama-3.1-405b", modelName: "llama-3.1-405b", type: "text", think: false },
    { name: "llama-3.1-405b-instruct", modelName: "llama-3.1-405b-instruct", type: "text", think: false },
    { name: "llama-3.1-70b", modelName: "llama-3.1-70b", type: "text", think: false },
    { name: "llama-3.1-70b-instruct", modelName: "llama-3.1-70b-instruct", type: "text", think: false },
    { name: "llama-3.1-8b", modelName: "llama-3.1-8b", type: "text", think: false },
    { name: "llama-3.2-11b-vision-instruct", modelName: "llama-3.2-11b-vision-instruct", type: "text", think: false },
    { name: "llama-3.2-1b-instruct", modelName: "llama-3.2-1b-instruct", type: "text", think: false },
    { name: "llama-3.2-3b-instruct", modelName: "llama-3.2-3b-instruct", type: "text", think: false },
    { name: "llama-3.2-90b-vision-instruct", modelName: "llama-3.2-90b-vision-instruct", type: "text", think: false },
    { name: "llama-3.3-70b-instruct", modelName: "llama-3.3-70b-instruct", type: "text", think: false },
    { name: "MAI-DS-R1", modelName: "MAI-DS-R1", type: "text", think: true },
    { name: "meta-llama/llama-4-maverick", modelName: "meta-llama/llama-4-maverick", type: "text", think: false },
    { name: "meta-llama/llama-4-scout", modelName: "meta-llama/llama-4-scout", type: "text", think: false },
    { name: "mimo-v2-pro", modelName: "mimo-v2-pro", type: "text", think: false },
    { name: "mistral-large-latest", modelName: "mistral-large-latest", type: "text", think: false },
    { name: "mistral-small-latest", modelName: "mistral-small-latest", type: "text", think: false },
    { name: "moonshot-v1-128k", modelName: "moonshot-v1-128k", type: "text", think: false },
    { name: "moonshot-v1-32k", modelName: "moonshot-v1-32k", type: "text", think: false },
    { name: "moonshot-v1-8k", modelName: "moonshot-v1-8k", type: "text", think: false },
    { name: "o1", modelName: "o1", type: "text", think: true },
    { name: "o1-2024-12-17", modelName: "o1-2024-12-17", type: "text", think: true },
    { name: "o1-all", modelName: "o1-all", type: "text", think: true },
    { name: "o1-mini-all", modelName: "o1-mini-all", type: "text", think: true },
    { name: "o1-pro-all", modelName: "o1-pro-all", type: "text", think: true },
    { name: "o3", modelName: "o3", type: "text", think: true },
    { name: "o3-2025-04-16", modelName: "o3-2025-04-16", type: "text", think: true },
    { name: "o3-all", modelName: "o3-all", type: "text", think: true },
    { name: "o3-deep-research", modelName: "o3-deep-research", type: "text", think: true },
    { name: "o3-deep-research-2025-06-26", modelName: "o3-deep-research-2025-06-26", type: "text", think: true },
    { name: "o3-mini", modelName: "o3-mini", type: "text", think: true },
    { name: "o3-mini-2025-01-31", modelName: "o3-mini-2025-01-31", type: "text", think: true },
    { name: "o3-mini-all", modelName: "o3-mini-all", type: "text", think: true },
    { name: "o3-mini-high-all", modelName: "o3-mini-high-all", type: "text", think: true },
    { name: "o3-pro", modelName: "o3-pro", type: "text", think: true },
    { name: "o3-pro-2025-06-10", modelName: "o3-pro-2025-06-10", type: "text", think: true },
    { name: "o3-pro-all", modelName: "o3-pro-all", type: "text", think: true },
    { name: "o4-mini", modelName: "o4-mini", type: "text", think: true },
    { name: "o4-mini-2025-04-16", modelName: "o4-mini-2025-04-16", type: "text", think: true },
    { name: "o4-mini-all", modelName: "o4-mini-all", type: "text", think: true },
    { name: "o4-mini-deep-research", modelName: "o4-mini-deep-research", type: "text", think: true },
    { name: "o4-mini-deep-research-2025-06-26", modelName: "o4-mini-deep-research-2025-06-26", type: "text", think: true },
    { name: "qvq-max", modelName: "qvq-max", type: "text", think: true },
    { name: "qvq-max-latest", modelName: "qvq-max-latest", type: "text", think: true },
    { name: "qwen-flash", modelName: "qwen-flash", type: "text", think: false },
    { name: "qwen-max", modelName: "qwen-max", type: "text", think: false },
    { name: "qwen-max-latest", modelName: "qwen-max-latest", type: "text", think: false },
    { name: "qwen-turbo", modelName: "qwen-turbo", type: "text", think: false },
    { name: "qwen-turbo-2025-07-15", modelName: "qwen-turbo-2025-07-15", type: "text", think: false },
    { name: "qwen-vl-max", modelName: "qwen-vl-max", type: "text", think: false },
    { name: "qwen-vl-max-2025-08-13", modelName: "qwen-vl-max-2025-08-13", type: "text", think: false },
    { name: "qwen-vl-max-latest", modelName: "qwen-vl-max-latest", type: "text", think: false },
    { name: "qwen2-vl-72b-instruct", modelName: "qwen2-vl-72b-instruct", type: "text", think: false },
    { name: "qwen2-vl-7b-instruct", modelName: "qwen2-vl-7b-instruct", type: "text", think: false },
    { name: "qwen2.5-14b-instruct", modelName: "qwen2.5-14b-instruct", type: "text", think: false },
    { name: "qwen2.5-14b-instruct-1m", modelName: "qwen2.5-14b-instruct-1m", type: "text", think: false },
    { name: "qwen2.5-32b-instruct", modelName: "qwen2.5-32b-instruct", type: "text", think: false },
    { name: "qwen2.5-3b-instruct", modelName: "qwen2.5-3b-instruct", type: "text", think: false },
    { name: "qwen2.5-72b-instruct", modelName: "qwen2.5-72b-instruct", type: "text", think: false },
    { name: "qwen2.5-7b-instruct", modelName: "qwen2.5-7b-instruct", type: "text", think: false },
    { name: "qwen2.5-7b-instruct-1m", modelName: "qwen2.5-7b-instruct-1m", type: "text", think: false },
    { name: "qwen2.5-coder-7b-instruct", modelName: "qwen2.5-coder-7b-instruct", type: "text", think: false },
    { name: "qwen2.5-math-72b-instruct", modelName: "qwen2.5-math-72b-instruct", type: "text", think: false },
    { name: "qwen2.5-vl-32b-instruct", modelName: "qwen2.5-vl-32b-instruct", type: "text", think: false },
    { name: "qwen2.5-vl-3b-instruct", modelName: "qwen2.5-vl-3b-instruct", type: "text", think: false },
    { name: "qwen2.5-vl-72b-instruct", modelName: "qwen2.5-vl-72b-instruct", type: "text", think: false },
    { name: "qwen2.5-vl-7b-instruct", modelName: "qwen2.5-vl-7b-instruct", type: "text", think: false },
    { name: "qwen3-0.6b", modelName: "qwen3-0.6b", type: "text", think: false },
    { name: "qwen3-1.7b", modelName: "qwen3-1.7b", type: "text", think: false },
    { name: "qwen3-14b", modelName: "qwen3-14b", type: "text", think: false },
    { name: "qwen3-235b-a22b", modelName: "qwen3-235b-a22b", type: "text", think: false },
    { name: "qwen3-30b-a3b", modelName: "qwen3-30b-a3b", type: "text", think: false },
    { name: "qwen3-32b", modelName: "qwen3-32b", type: "text", think: false },
    { name: "qwen3-4b", modelName: "qwen3-4b", type: "text", think: false },
    { name: "qwen3-8b", modelName: "qwen3-8b", type: "text", think: false },
    { name: "qwen3-max-preview", modelName: "qwen3-max-preview", type: "text", think: false },
    { name: "qwen3-max-preview-n", modelName: "qwen3-max-preview-n", type: "text", think: false },
    { name: "qwen3-next-80b-a3b-thinking", modelName: "qwen3-next-80b-a3b-thinking", type: "text", think: true },
    { name: "qwq-32b", modelName: "qwq-32b", type: "text", think: true },
    { name: "qwq-32b-preview", modelName: "qwq-32b-preview", type: "text", think: true },
    { name: "qwq-72b-preview", modelName: "qwq-72b-preview", type: "text", think: true },
    { name: "qwq-plus", modelName: "qwq-plus", type: "text", think: true },
    { name: "qwq-plus-2025-03-05", modelName: "qwq-plus-2025-03-05", type: "text", think: true },
    { name: "SparkDesk-v1.1", modelName: "SparkDesk-v1.1", type: "text", think: false },
    { name: "SparkDesk-v2.1", modelName: "SparkDesk-v2.1", type: "text", think: false },
    { name: "SparkDesk-v3.1", modelName: "SparkDesk-v3.1", type: "text", think: false },
    { name: "SparkDesk-v3.5", modelName: "SparkDesk-v3.5", type: "text", think: false },
    { name: "claude-sonnet-4-5", modelName: "claude-sonnet-4-5", type: "text", think: false },
    { name: "qwen-mt-turbo", modelName: "qwen-mt-turbo", type: "text", think: false },
    // 官方 pricing_new 图像模型（当前适配器支持 /v1/images/generations 与 /v1/images/edits 兼容入口）
    { name: "gpt-image-2", modelName: "gpt-image-2", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { name: "qwen-image-2.0-2026-03-03", modelName: "qwen-image-2.0-2026-03-03", type: "image", mode: ["text"] },
    { name: "wan2.7-image-pro", modelName: "wan2.7-image-pro", type: "image", mode: ["text"] },
    { name: "grok-imagine-image", modelName: "grok-imagine-image", type: "image", mode: ["text"] },
    { name: "grok-imagine-image-pro", modelName: "grok-imagine-image-pro", type: "image", mode: ["text"] },
    { name: "doubao-seedream-5-0-260128", modelName: "doubao-seedream-5-0-260128", type: "image", mode: ["text"] },
    { name: "gpt-image-1.5", modelName: "gpt-image-1.5", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { name: "gpt-image-2-all", modelName: "gpt-image-2-all", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { name: "gpt-image-1.5-all", modelName: "gpt-image-1.5-all", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { name: "gpt-image-1", modelName: "gpt-image-1", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { name: "gpt-image-1-mini", modelName: "gpt-image-1-mini", type: "image", mode: ["text", "singleImage", "multiReference"] },
    { name: "qwen-image-edit-2509", modelName: "qwen-image-edit-2509", type: "image", mode: ["text"] },
    { name: "qwen-image-max", modelName: "qwen-image-max", type: "image", mode: ["text"] },
    { name: "qwen-image-max-2025-12-30", modelName: "qwen-image-max-2025-12-30", type: "image", mode: ["text"] },
    { name: "z-image-turbo", modelName: "z-image-turbo", type: "image", mode: ["text"] },
    { name: "doubao-seedream-4-0-250828", modelName: "doubao-seedream-4-0-250828", type: "image", mode: ["text"] },
    { name: "doubao-seedream-4-5-251128", modelName: "doubao-seedream-4-5-251128", type: "image", mode: ["text"] },
    { name: "flux-1.1-pro", modelName: "flux-1.1-pro", type: "image", mode: ["text"] },
    { name: "doubao-seedream-3-0-t2i-250415", modelName: "doubao-seedream-3-0-t2i-250415", type: "image", mode: ["text"] },
    { name: "flux.1-kontext-pro", modelName: "flux.1-kontext-pro", type: "image", mode: ["text"] },
    { name: "dall-e-3", modelName: "dall-e-3", type: "image", mode: ["text"] },
    // 官方 pricing_new 视频模型（当前适配器支持 /v1/video/create 统一格式入口）
    {
      name: "omni-flash",
      modelName: "omni-flash",
      type: "video",
      mode: ["text", "singleImage", "startEndRequired", "endFrameOptional"],
      audio: true,
      durationResolutionMap: [{ duration: [4, 6, 8], resolution: ["720p", "1080p"] }],
    },
    {
      name: "veo3.1-4k",
      modelName: "veo3.1-4k",
      type: "video",
      mode: ["text", "singleImage", "startEndRequired", "endFrameOptional"],
      audio: true,
      durationResolutionMap: [{ duration: [8], resolution: ["4K"] }],
    },
    {
      name: "veo3.1-components-4k",
      modelName: "veo3.1-components-4k",
      type: "video",
      mode: ["text", "singleImage", "startEndRequired", "endFrameOptional"],
      audio: true,
      durationResolutionMap: [{ duration: [8], resolution: ["4K"] }],
    },
    {
      name: "veo3.1",
      modelName: "veo3.1",
      type: "video",
      mode: ["text", "singleImage", "startEndRequired", "endFrameOptional"],
      audio: true,
      durationResolutionMap: [{ duration: [4, 6, 8], resolution: ["720p", "1080p"] }],
    },
    {
      name: "veo3.1-pro",
      modelName: "veo3.1-pro",
      type: "video",
      mode: ["text", "singleImage", "startEndRequired", "endFrameOptional"],
      audio: true,
      durationResolutionMap: [{ duration: [4, 6, 8], resolution: ["720p", "1080p"] }],
    },
    {
      name: "veo3.1-pro-4k",
      modelName: "veo3.1-pro-4k",
      type: "video",
      mode: ["text", "singleImage", "startEndRequired", "endFrameOptional"],
      audio: true,
      durationResolutionMap: [{ duration: [8], resolution: ["4K"] }],
    },
    {
      name: "veo3.1-components",
      modelName: "veo3.1-components",
      type: "video",
      mode: ["text", "singleImage", "startEndRequired", "endFrameOptional"],
      audio: true,
      durationResolutionMap: [{ duration: [4, 6, 8], resolution: ["720p", "1080p"] }],
    },
    {
      name: "sora-2-pro",
      modelName: "sora-2-pro",
      type: "video",
      mode: ["text", "singleImage", "startEndRequired", "endFrameOptional"],
      audio: true,
      durationResolutionMap: [{ duration: [4, 8, 10], resolution: ["720p", "1080p"] }],
    },
    {
      name: "veo3.1-fast",
      modelName: "veo3.1-fast",
      type: "video",
      mode: ["text", "singleImage", "startEndRequired", "endFrameOptional"],
      audio: true,
      durationResolutionMap: [{ duration: [4, 6, 8], resolution: ["720p", "1080p"] }],
    },
  ],
};

// ============================================================
// 辅助工具
// ============================================================

const getApiKey = () => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  return vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");
};

const getAuthorization = () => `Bearer ${getApiKey()}`;

const getApiBaseUrl = () => {
  const rawBaseUrl = (vendor.inputValues.baseUrl || "https://api.esdli.com").trim().replace(/\/+$/, "");
  const withoutEndpoint = rawBaseUrl.replace(/\/chat\/completions$/i, "").replace(/\/images\/(generations|edits)$/i, "");
  if (withoutEndpoint.endsWith("/v1")) return withoutEndpoint;
  return `${withoutEndpoint}/v1`;
};

const joinUrl = (base: string, path: string) => `${base.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;

const getJsonHeaders = () => ({
  Authorization: getAuthorization(),
  "Content-Type": "application/json",
  Accept: "application/json",
});

const readByPath = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
};

const pickFirstPath = (obj: any, paths: string[]): any => {
  for (const path of paths) {
    const value = readByPath(obj, path);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

const extractResult = (data: any): string | undefined => {
  const arrayData = Array.isArray(data?.data) ? data.data[0] : undefined;
  const candidates = [
    arrayData?.b64_json,
    arrayData?.url,
    arrayData?.video_url,
    arrayData?.audio_url,
    data?.b64_json,
    data?.url,
    data?.video_url,
    data?.audio_url,
    data?.output_url,
    data?.result_url,
    data?.data?.b64_json,
    data?.data?.url,
    data?.data?.video_url,
    data?.data?.audio_url,
    data?.data?.output_url,
    data?.data?.result_url,
    data?.detail?.video_url,
    data?.detail?.upsample_video_url,
    data?.upsample_video_url,
    data?.output?.url,
  ];
  return candidates.find((item) => typeof item === "string" && item.length > 0);
};

const extractError = (data: any): string | undefined => {
  return pickFirstPath(data, [
    "error.message",
    "message",
    "msg",
    "detail.error_message",
    "detail.video_generation_error",
    "data.error.message",
    "data.message",
  ]);
};

const getTaskStatus = (data: any) => {
  return String(pickFirstPath(data, ["status", "data.status", "detail.status", "state", "data.state"]) || "").toLowerCase();
};

const normalizeBase64 = (value: string) => value.replace(/^data:[^;]+;base64,/, "");

const getFileMeta = (completeBase64: string, defaultName: string) => {
  const match = completeBase64.match(/^data:([^;]+);base64,/);
  const mimeType = match?.[1] || "image/png";
  const extensionMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return {
    mimeType,
    filename: `${defaultName}.${extensionMap[mimeType] || "png"}`,
  };
};

const getImageSize = (config: ImageConfig, modelName: string) => {
  const aspectRatio = config.aspectRatio === "16:9" || config.aspectRatio === "9:16" ? config.aspectRatio : "1:1";
  if (modelName === "dall-e-3") {
    if (aspectRatio === "16:9") return "1792x1024";
    if (aspectRatio === "9:16") return "1024x1792";
    return "1024x1024";
  }
  if (modelName === "qwen-image-max" || modelName === "z-image-turbo") return "1024x1024";
  if (aspectRatio === "16:9") return "1536x1024";
  if (aspectRatio === "9:16") return "1024x1536";
  return "1024x1024";
};

const getImageQuality = (size: ImageConfig["size"]) => {
  const qualityMap: Record<ImageConfig["size"], string> = {
    "1K": "low",
    "2K": "medium",
    "4K": "high",
  };
  return qualityMap[size] || "medium";
};

const ensureImageBase64 = async (value: string) => {
  if (value.startsWith("data:")) return value;
  if (value.startsWith("http")) return await urlToBase64(value);
  return `data:image/png;base64,${value}`;
};

const throwAxiosError = (error: any, action: string): never => {
  const data = error?.response?.data;
  const message = extractError(data) || error?.message || "未知错误";
  throw new Error(`${action}失败：${message}`);
};

// ============================================================
// 适配器函数
// ============================================================

const textRequest = (model: TextModel, think: boolean, thinkLevel: 0 | 1 | 2 | 3) => {
  const apiKey = getApiKey();
  const effortMap: Record<0 | 1 | 2 | 3, "low" | "low" | "medium" | "high"> = {
    0: "low",
    1: "low",
    2: "medium",
    3: "high",
  };
  const enableThinking = model.think && think && thinkLevel !== 0;
  const extraBody: Record<string, any> = {};

  if (enableThinking) {
    extraBody.reasoning_effort = effortMap[thinkLevel];
    extraBody.extra_body = { enable_thinking: true };
  }

  return createOpenAI({
    baseURL: getApiBaseUrl(),
    apiKey,
    ...(Object.keys(extraBody).length > 0 ? { extraBody } : {}),
  }).chat(model.modelName);
};

const imageRequest = async (config: ImageConfig, model: ImageModel): Promise<string> => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const imageRefs = (config.referenceList || []).map((ref) => ref.base64).filter(Boolean);

  try {
    if (imageRefs.length > 0 && model.modelName.startsWith("gpt-image-")) {
      const formData = new FormData();
      formData.append("model", model.modelName);
      formData.append("prompt", config.prompt);
      formData.append("n", "1");
      formData.append("size", getImageSize(config, model.modelName));
      formData.append("quality", getImageQuality(config.size));

      for (const [index, image] of imageRefs.entries()) {
        const { filename } = getFileMeta(image, `reference-${index + 1}`);
        formData.append("image", Buffer.from(normalizeBase64(image), "base64"), filename);
      }

      logger(`火键API图片编辑任务：${model.modelName}，参考图 ${imageRefs.length} 张`);
      const response = await axios.post(joinUrl(getApiBaseUrl(), "/images/edits"), formData, {
        headers: {
          Authorization: getAuthorization(),
          ...(typeof formData.getHeaders === "function" ? formData.getHeaders() : {}),
        },
      });
      const result = extractResult(response.data);
      if (!result) throw new Error(`接口未返回图片结果：${JSON.stringify(response.data).slice(0, 500)}`);
      return await ensureImageBase64(result);
    }

    const body: Record<string, any> = {
      model: model.modelName,
      prompt: config.prompt,
      n: 1,
      size: getImageSize(config, model.modelName),
    };
    if (model.modelName.startsWith("gpt-image-")) body.quality = getImageQuality(config.size);
    if (model.modelName === "dall-e-3") {
      body.quality = config.size === "1K" ? "standard" : "hd";
      body.style = "vivid";
      body.response_format = "url";
    }

    logger(`火键API图片生成任务：${model.modelName}`);
    const response = await axios.post(joinUrl(getApiBaseUrl(), "/images/generations"), body, { headers: getJsonHeaders() });
    const result = extractResult(response.data);
    if (!result) throw new Error(`接口未返回图片结果：${JSON.stringify(response.data).slice(0, 500)}`);
    return await ensureImageBase64(result);
  } catch (error: any) {
    throwAxiosError(error, "图片生成");
  }
};

const videoRequest = async (config: VideoConfig, model: VideoModel): Promise<string> => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const imageRefs = (config.referenceList || []).filter((ref) => ref.type === "image").map((ref) => ref.base64).filter(Boolean);
  const body: Record<string, any> = {
    model: model.modelName,
    prompt: config.prompt,
    duration: config.duration,
    aspect_ratio: config.aspectRatio,
    enhance_prompt: vendor.inputValues.enhancePrompt !== "false",
  };

  if (config.resolution && config.resolution !== "720p") {
    body.enable_upsample = true;
    body.resolution = config.resolution;
  }
  if (typeof config.audio === "boolean") body.audio = config.audio;
  if (imageRefs.length > 0) body.images = imageRefs.slice(0, 2);

  try {
    logger(`火键API视频任务提交：${model.modelName}`);
    const createResponse = await axios.post(joinUrl(getApiBaseUrl(), "/video/create"), body, { headers: getJsonHeaders() });
    const taskId = createResponse.data?.id || createResponse.data?.task_id || createResponse.data?.data?.id;
    if (!taskId) throw new Error(`未获取到视频任务ID：${JSON.stringify(createResponse.data).slice(0, 500)}`);

    const pollResult = await pollTask(
      async () => {
        const queryResponse = await axios.get(joinUrl(getApiBaseUrl(), `/video/query?id=${encodeURIComponent(taskId)}`), {
          headers: getJsonHeaders(),
        });
        const status = getTaskStatus(queryResponse.data);
        logger(`火键API视频任务状态：${status || "unknown"}`);

        if (["completed", "success", "succeeded", "done"].includes(status)) {
          const videoUrl = extractResult(queryResponse.data);
          if (!videoUrl) return { completed: true, error: "视频任务完成但未返回视频地址" };
          return { completed: true, data: videoUrl };
        }
        if (["failed", "failure", "error", "cancelled", "canceled"].includes(status)) {
          return { completed: true, error: extractError(queryResponse.data) || "视频生成失败" };
        }
        return { completed: false };
      },
      5000,
      1200000,
    );

    if (pollResult.error) throw new Error(pollResult.error);
    if (!pollResult.data) throw new Error("视频生成失败：轮询未返回数据");
    return await urlToBase64(pollResult.data);
  } catch (error: any) {
    throwAxiosError(error, "视频生成");
  }
};

const ttsRequest = async (config: TTSConfig, model: TTSModel): Promise<string> => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  try {
    const response = await axios.post(
      joinUrl(getApiBaseUrl(), "/audio/speech"),
      {
        model: model.modelName,
        input: config.text,
        voice: config.voice || "alloy",
        response_format: "mp3",
        speed: Math.max(0.25, Math.min(4, Number(config.speechRate) || 1)),
      },
      {
        headers: getJsonHeaders(),
        responseType: "arraybuffer",
      },
    );

    const contentType = response.headers?.["content-type"] || "audio/mpeg";
    const buffer = Buffer.from(response.data);
    if (contentType.includes("application/json")) {
      const json = JSON.parse(buffer.toString("utf8"));
      const result = extractResult(json);
      if (!result) throw new Error(`接口未返回音频结果：${JSON.stringify(json).slice(0, 500)}`);
      if (result.startsWith("http")) return await urlToBase64(result);
      if (result.startsWith("data:")) return result;
      return `data:audio/mpeg;base64,${result}`;
    }
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch (error: any) {
    throwAxiosError(error, "语音生成");
  }
};

const checkForUpdates = async (): Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }> => {
  return { hasUpdate: false, latestVersion: vendor.version, notice: "当前版本基于火键API Apifox 文档生成。" };
};

const updateVendor = async (): Promise<string> => {
  return "";
};

// ============================================================
// 导出
// ============================================================

exports.vendor = vendor;
exports.textRequest = textRequest;
exports.imageRequest = imageRequest;
exports.videoRequest = videoRequest;
exports.ttsRequest = ttsRequest;
exports.checkForUpdates = checkForUpdates;
exports.updateVendor = updateVendor;

export {};
