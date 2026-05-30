<script lang="ts" setup>
import { computed } from 'vue';

import { AuthPageLayout } from '@super/layouts';
import { preferences } from '@super/preferences';

import { $t } from '#/locales';

const appName = computed(() => preferences.app.name);
const logo = computed(() => preferences.logo.source);
const pageTitle = computed(() => {
  const fallbackTitle = $t('authentication.pageTitle');
  return appName.value
    ? fallbackTitle.replace('DramaStudio', appName.value)
    : fallbackTitle;
});
</script>

<template>
  <AuthPageLayout
    :app-name="appName"
    :logo="logo"
    :page-description="$t('authentication.pageDesc')"
    :page-title="pageTitle"
  >
    <!-- 自定义工具栏 -->
    <!-- <template #toolbar></template> -->
  </AuthPageLayout>
</template>
