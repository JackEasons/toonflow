import express from "express";
import { success } from "@/lib/responseFormat";
import { isAdminRequest } from "@/utils/admin";

const router = express.Router();

const dashboardMenus = [
  {
    component: "BasicLayout",
    meta: {
      icon: "lucide:layout-dashboard",
      order: -1,
      title: "仪表盘",
    },
    name: "Dashboard",
    path: "/dashboard",
    redirect: "/analytics",
    children: [
      {
        component: "/dashboard/analytics/index.vue",
        meta: {
          affixTab: true,
          icon: "lucide:area-chart",
          title: "分析页",
        },
        name: "Analytics",
        path: "/analytics",
      },
      {
        component: "/dashboard/workspace/index.vue",
        meta: {
          icon: "carbon:workspace",
          title: "工作台",
        },
        name: "Workspace",
        path: "/workspace",
      },
    ],
  },
];

const adminSettingsMenus = [
  {
    component: "BasicLayout",
    meta: {
      icon: "lucide:settings",
      order: 10,
      title: "配置",
    },
    name: "AdminSettings",
    path: "/settings",
    redirect: "/settings/vendor-config",
    children: [
      {
        component: "/settings/components/vendorConfig.vue",
        meta: {
          affixTab: true,
          icon: "lucide:sliders-horizontal",
          title: "模型服务",
        },
        name: "SettingsVendorConfig",
        path: "/settings/vendor-config",
      },
      {
        component: "/settings/components/modelMap.vue",
        meta: {
          icon: "lucide:monitor-cog",
          title: "模型映射",
        },
        name: "SettingsModelMap",
        path: "/settings/model-map",
      },
      {
        component: "/settings/components/agentConfog.vue",
        meta: {
          icon: "lucide:bot",
          title: "Agent配置",
        },
        name: "SettingsAgentConfig",
        path: "/settings/agent-config",
      },
      {
        component: "/settings/components/promptManage.vue",
        meta: {
          icon: "lucide:message-square-text",
          title: "提示词管理",
        },
        name: "SettingsPromptManage",
        path: "/settings/prompt-manage",
      },
      {
        component: "/settings/components/skillManagement.vue",
        meta: {
          icon: "lucide:workflow",
          title: "Skills技能管理",
        },
        name: "SettingsSkillManagement",
        path: "/settings/skill-management",
      },
      {
        component: "/settings/components/memoryConfig.vue",
        meta: {
          icon: "lucide:database-zap",
          title: "Agent记忆配置",
        },
        name: "SettingsMemoryConfig",
        path: "/settings/memory-config",
      },
      {
        component: "/settings/components/dbConfig.vue",
        meta: {
          icon: "lucide:database",
          title: "数据库操作",
        },
        name: "SettingsDbConfig",
        path: "/settings/db-config",
      },
      {
        component: "/settings/components/fileManagement.vue",
        meta: {
          icon: "lucide:folder-open",
          title: "文件管理",
        },
        name: "SettingsFileManagement",
        path: "/settings/file-management",
      },
    ],
  },
];

export default router.get("/", async (req, res) => {
  res.status(200).send(success(isAdminRequest(req) ? [...dashboardMenus, ...adminSettingsMenus] : dashboardMenus));
});
