import { createApp } from "vue";
import type { RouteLocationNormalizedLoaded } from "vue-router";

import { install as installIconPark } from "@icon-park/vue-next/es/all";
import { Log } from "@webav/av-cliper";
import TDesignChat from "@tdesign-vue-next/chat";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import TDesign from "tdesign-vue-next";

import App from "./app/index.vue";
import i18n from "./locales";
import router from "./router";
import { imageOptimizer } from "#/utils/imageOptimizer";

import "#/utils/global";
import "@icon-park/vue-next/styles/index.css";
import "@tdesign-vue-next/chat/es/style/index.css";
import "tdesign-vue-next/es/style/index.css";
import "md-editor-v3/lib/style.css";
import "splitpanes/dist/splitpanes.css";
import "./assets/main.scss";

function getRouteTitle(route: RouteLocationNormalizedLoaded) {
  return typeof route.meta.title === "string" ? route.meta.title : "";
}

function setupDynamicTitle() {
  const appTitle = import.meta.env.VITE_APP_TITLE || "DramaStudio";

  router.afterEach((route) => {
    const routeTitle = getRouteTitle(route);
    document.title = routeTitle && routeTitle !== appTitle ? `${routeTitle} - ${appTitle}` : appTitle;
  });
}

function bootstrap() {
  Log.setLogLevel(Log.warn);

  const app = createApp(App);
  const pinia = createPinia();

  app.use(imageOptimizer);
  installIconPark(app, "i");
  app.use(pinia.use(piniaPluginPersistedstate));
  app.use(TDesign);
  app.use(TDesignChat);
  app.use(router);
  setupDynamicTitle();
  app.use(i18n);
  app.mount("#app");
}

export { bootstrap };
