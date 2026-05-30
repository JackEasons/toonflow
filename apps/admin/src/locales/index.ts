import type { App } from 'vue';

import type { LocaleSetupOptions, SupportedLanguagesType } from '@super/locales';

import {
  $t,
  setupI18n as coreSetup,
  loadLocalesMapFromDir,
} from '@super/locales';
import { preferences } from '@super/preferences';

import dayjs from 'dayjs';

import settingsCompatEn from '#/settings/compat/en.json';
import settingsCompatZhCN from '#/settings/compat/zh-CN.json';

const modules = import.meta.glob('./langs/**/*.json');

const localesMap = loadLocalesMapFromDir(
  /\.\/langs\/([^/]+)\/(.*)\.json$/,
  modules,
);
/**
 * 加载应用特有的语言包
 * 这里也可以改造为从服务端获取翻译数据
 * @param lang
 */
type LocaleMessages = Record<string, any>;

function mergeMessages(target: LocaleMessages, source: LocaleMessages) {
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      mergeMessages(target[key], value);
      continue;
    }
    target[key] = value;
  }
  return target;
}

function expandDotKeys(source: LocaleMessages) {
  const messages: LocaleMessages = {};

  for (const [key, value] of Object.entries(source)) {
    if (!key.includes('.')) {
      messages[key] = value;
      continue;
    }

    const parts = key.split('.');
    let current = messages;
    for (const part of parts.slice(0, -1)) {
      if (
        !current[part] ||
        typeof current[part] !== 'object' ||
        Array.isArray(current[part])
      ) {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]!] = value;
  }

  return mergeMessages(messages, source);
}

function getSettingsCompatMessages(lang: SupportedLanguagesType) {
  return expandDotKeys(
    lang === 'zh-CN'
      ? (settingsCompatZhCN as LocaleMessages)
      : (settingsCompatEn as LocaleMessages),
  );
}

async function loadMessages(lang: SupportedLanguagesType) {
  const [appLocaleMessages] = await Promise.all([
    localesMap[lang]?.(),
    loadThirdPartyMessage(lang),
  ]);
  return mergeMessages(
    getSettingsCompatMessages(lang),
    appLocaleMessages?.default ?? {},
  );
}

/**
 * 加载第三方组件库的语言包
 * @param lang
 */
async function loadThirdPartyMessage(lang: SupportedLanguagesType) {
  await loadDayjsLocale(lang);
}

/**
 * 加载dayjs的语言包
 * @param lang
 */
async function loadDayjsLocale(lang: SupportedLanguagesType) {
  let locale;
  switch (lang) {
    case 'en-US': {
      locale = await import('dayjs/locale/en');
      break;
    }
    case 'zh-CN': {
      locale = await import('dayjs/locale/zh-cn');
      break;
    }
    // 默认使用英语
    default: {
      locale = await import('dayjs/locale/en');
    }
  }
  if (locale) {
    dayjs.locale(locale);
  } else {
    console.error(`Failed to load dayjs locale for ${lang}`);
  }
}

async function setupI18n(app: App, options: LocaleSetupOptions = {}) {
  await coreSetup(app, {
    defaultLocale: preferences.app.locale,
    loadMessages,
    missingWarn: !import.meta.env.PROD,
    ...options,
  });
}

export { $t, setupI18n };
