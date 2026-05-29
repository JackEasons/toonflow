import type { RouteRecordRaw } from "vue-router";

import { LOGIN_PATH } from "../guard";

const WorkbenchLayout = () => import("#/pages/workbench/index.vue");

const workbenchRoutes: RouteRecordRaw[] = [
  {
    path: "/project",
    name: "Project",
    component: () => import("#/views/project/index.vue"),
    meta: { title: "Project" },
  },
  {
    path: "/task",
    name: "Task",
    component: () => import("#/views/task/index.vue"),
    meta: { title: "Task" },
  },
  {
    path: "/novel",
    name: "Novel",
    component: () => import("#/views/novel/index.vue"),
    meta: { title: "Novel" },
  },
  {
    path: "/script",
    name: "Script",
    component: () => import("#/views/script/index.vue"),
    meta: { title: "Script" },
  },
  {
    path: "/scriptAgent",
    name: "ScriptAgent",
    component: () => import("#/views/scriptAgent/index.vue"),
    meta: { title: "ScriptAgent" },
  },
  {
    path: "/cornerScape",
    name: "CornerScape",
    component: () => import("#/views/cornerScape/index.vue"),
    meta: { title: "CornerScape" },
  },
  {
    path: "/production",
    name: "Production",
    component: () => import("#/views/production/index.vue"),
    meta: { title: "Production" },
  },
  {
    path: "/assets",
    name: "Assets",
    component: () => import("#/views/assets/index.vue"),
    meta: { title: "Assets" },
  },
  {
    path: "/test",
    name: "Test",
    component: () => import("#/views/test/index.vue"),
    meta: { title: "Test" },
  },
];

const coreRoutes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/workbench",
  },
  {
    path: "/workbench",
    name: "Workbench",
    component: WorkbenchLayout,
    redirect: "/project",
    children: workbenchRoutes,
  },
  {
    path: LOGIN_PATH,
    name: "Login",
    component: () => import("#/pages/login/index.vue"),
    meta: { title: "Login" },
  },
];

const fallbackNotFoundRoute: RouteRecordRaw = {
  path: "/:catchAll(.*)",
  name: "FallbackNotFound",
  component: () => import("#/pages/error/404.vue"),
  meta: {
    title: "404",
  },
};

export { coreRoutes, fallbackNotFoundRoute, workbenchRoutes };
