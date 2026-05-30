import { createApp, watchEffect } from 'vue';

import { install as installIconPark } from '@icon-park/vue-next/es/all';
import { registerAccessDirective } from '@super/access';
import { registerLoadingDirective } from '@super/common-ui/es/loading';
import { preferences } from '@super/preferences';
import { initStores } from '@super/stores';
import '@super/styles';
// import '@super/styles/antd';
// 引入组件库的少量全局样式变量

import { useTitle } from '@vueuse/core';

import { $t, setupI18n } from '#/locales';
import { setupSettingsCompat } from '#/settings/compat';

import { initComponentAdapter } from './adapter/component';
import { initSetupSuperForm } from './adapter/form';
import App from './app.vue';
import { router } from './router';

import '@icon-park/vue-next/styles/index.css';
import 'md-editor-v3/lib/style.css';
import 'tdesign-vue-next/es/style/index.css';
import '#/styles/settings-admin.scss';

async function bootstrap(namespace: string) {
  // 初始化组件适配器
  await initComponentAdapter();

  // 初始化表单组件
  await initSetupSuperForm();

  // // 设置弹窗的默认配置
  // setDefaultModalProps({
  //   fullscreenButton: false,
  // });
  // // 设置抽屉的默认配置
  // setDefaultDrawerProps({
  //   zIndex: 1020,
  // });

  const app = createApp(App);
  const { default: TDesign } = await import('tdesign-vue-next');
  app.use(TDesign);
  installIconPark(app, 'i');

  // 注册v-loading指令
  registerLoadingDirective(app, {
    loading: 'loading', // 在这里可以自定义指令名称，也可以明确提供false表示不注册这个指令
    spinning: 'spinning',
  });

  // 国际化 i18n 配置
  await setupI18n(app);
  setupSettingsCompat(app);

  // 配置 pinia-tore
  await initStores(app, { namespace });

  // 安装权限指令
  registerAccessDirective(app);

  // 初始化 tippy
  const { initTippy } = await import('@super/common-ui/es/tippy');
  initTippy(app);

  // 配置路由及路由守卫
  app.use(router);

  // 配置Motion插件
  const { MotionPlugin } = await import('@super/plugins/motion');
  app.use(MotionPlugin);

  // 动态更新标题
  watchEffect(() => {
    if (preferences.app.dynamicTitle) {
      const routeTitle = router.currentRoute.value.meta?.title;
      const pageTitle =
        (routeTitle ? `${$t(routeTitle)} - ` : '') + preferences.app.name;
      useTitle(pageTitle);
    }
  });

  app.mount('#app');
}

export { bootstrap };
