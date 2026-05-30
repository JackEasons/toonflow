import type { App } from 'vue';

import { $t as coreT } from '#/locales';

import { MessagePlugin } from 'tdesign-vue-next';

import zhCN from './zh-CN.json';

type LocaleNode = Record<string, any>;

function readPath(source: LocaleNode, path: string) {
  if (typeof source[path] === 'string') return source[path];
  return path.split('.').reduce<any>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return current[key];
  }, source);
}

function formatText(text: string, params?: unknown) {
  if (!params || typeof params !== 'object') return text;
  return text.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = (params as Record<string, unknown>)[key];
    return value == null ? `{${key}}` : String(value);
  });
}

export function settingsCompatT(key: string, ...args: any[]) {
  const value = readPath(zhCN as LocaleNode, key);
  if (typeof value === 'string') {
    return formatText(value, args[0]);
  }
  return args.length > 0 ? coreT(key, args[0]) : coreT(key);
}

export function setupSettingsCompat(app: App) {
  window.$message = MessagePlugin;
  window.$t = settingsCompatT;
  app.config.globalProperties.$t = settingsCompatT;
}
