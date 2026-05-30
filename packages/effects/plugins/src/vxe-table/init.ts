import type { SetupVxeTable } from './types';

import { defineComponent, watch } from 'vue';

import { usePreferences } from '@super/preferences';

import {
  VxeButton,
  VxeCheckbox,
  VxeIcon,
  VxeInput,
  VxeLoading,
  VxeModal,
  VxeNumberInput,
  VxePager,
  VxeRadioGroup,
  VxeSelect,
  VxeTooltip,
  VxeUpload,
} from 'vxe-pc-ui';
import { VxeUI as VxePcUI } from 'vxe-pc-ui/es/vxe-ui/index.js';
import enUS from 'vxe-pc-ui/lib/language/en-US'; // 导入默认的语言
import zhCN from 'vxe-pc-ui/lib/language/zh-CN';
import { VxeUI as VxeTableUI } from 'vxe-table/es/vxe-ui/index.js';
import {
  VxeColgroup,
  VxeColumn,
  VxeGrid,
  VxeTable,
  VxeToolbar,
} from 'vxe-table';

import { injectPluginsOptions } from '../plugins-context';
import { extendsDefaultFormatter } from './extends'; // 是否加载过

// 是否加载过
let isInit = false;

let tableFormFactory: ((...args: any[]) => any) | undefined;

function normalizeVxeLocale<T extends Record<string, any>>(localeModule: T) {
  return (
    localeModule &&
    typeof localeModule === 'object' &&
    'default' in localeModule
      ? localeModule.default
      : localeModule
  ) as T;
}

export function useTableForm(...args: any[]) {
  const pluginsOptions = injectPluginsOptions();
  const contextFormFactory = pluginsOptions?.form?.useSuperForm;

  const factory = tableFormFactory || contextFormFactory;
  if (!factory) {
    throw new Error(
      'useTableForm is not initialized. Please provide useSuperForm via setupSuperVxeTable() or providePluginsOptions()',
    );
  }

  return factory(...args);
}

// 部分组件，如果没注册，vxe-table 会报错，这里实际没用组件，只是为了不报错，同时可以减少打包体积
const createVirtualComponent = (name = '') => {
  return defineComponent({
    name,
  });
};

export function initVxeTable() {
  if (isInit) {
    return;
  }

  VxeTableUI.component(VxeTable);
  VxeTableUI.component(VxeColumn);
  VxeTableUI.component(VxeColgroup);
  VxeTableUI.component(VxeGrid);
  VxeTableUI.component(VxeToolbar);

  VxeTableUI.component(VxeButton);
  // VxeUI.component(VxeButtonGroup);
  VxeTableUI.component(VxeCheckbox);
  // VxeUI.component(VxeCheckboxGroup);
  VxeTableUI.component(createVirtualComponent('VxeForm'));
  // VxeUI.component(VxeFormGather);
  // VxeUI.component(VxeFormItem);
  VxeTableUI.component(VxeIcon);
  VxeTableUI.component(VxeInput);
  // VxeUI.component(VxeList);
  VxeTableUI.component(VxeLoading);
  VxeTableUI.component(VxeModal);
  VxeTableUI.component(VxeNumberInput);
  // VxeUI.component(VxeOptgroup);
  // VxeUI.component(VxeOption);
  VxeTableUI.component(VxePager);
  // VxeUI.component(VxePulldown);
  // VxeUI.component(VxeRadio);
  // VxeUI.component(VxeRadioButton);
  VxeTableUI.component(VxeRadioGroup);
  VxeTableUI.component(VxeSelect);
  // VxeUI.component(VxeSwitch);
  // VxeUI.component(VxeTextarea);
  VxeTableUI.component(VxeTooltip);
  VxeTableUI.component(VxeUpload);

  isInit = true;
}

export function setupSuperVxeTable(setupOptions: SetupVxeTable) {
  const { configVxeTable, useSuperForm: useSuperFormFromParam } = setupOptions;

  initVxeTable();

  // 优先使用参数传入的 useSuperForm，否则清空让 context 注入生效
  if (useSuperFormFromParam) {
    tableFormFactory = useSuperFormFromParam;
  }
  const { isDark, locale } = usePreferences();

  const localMap = {
    'zh-CN': normalizeVxeLocale(zhCN),
    'en-US': normalizeVxeLocale(enUS),
  };

  watch(
    [() => isDark.value, () => locale.value],
    ([isDarkValue, localeValue]) => {
      const language = localMap[localeValue] ? localeValue : 'zh-CN';
      const localeConfig = localMap[language];
      [VxeTableUI, VxePcUI].forEach((vxeUI) => {
        vxeUI.setTheme(isDarkValue ? 'dark' : 'light');
        vxeUI.setI18n(language, localeConfig);
        vxeUI.setLanguage(language);
      });
    },
    {
      immediate: true,
    },
  );

  extendsDefaultFormatter(VxeTableUI);

  configVxeTable(VxeTableUI);
}
