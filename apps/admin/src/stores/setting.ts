import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { preferences, usePreferences } from '@super/preferences';

export default defineStore('setting', () => {
  const { theme } = usePreferences();
  const activeMenu = ref('');
  const showSetting = ref(false);
  const isElectron = ref(false);
  const themeSetting = computed<{
    fontSize: number;
    mode: 'auto' | 'dark' | 'light';
    primaryColor: string;
  }>(() => ({
    fontSize: preferences.theme.fontSize,
    mode: theme.value,
    primaryColor: preferences.theme.colorPrimary,
  }));

  function $reset() {
    activeMenu.value = '';
    showSetting.value = false;
    isElectron.value = false;
  }

  return { $reset, activeMenu, isElectron, showSetting, themeSetting };
});
