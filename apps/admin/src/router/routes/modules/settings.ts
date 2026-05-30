import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    redirect: '/settings/vendor-config',
    meta: {
      authority: ['admin'],
      icon: 'lucide:settings',
      order: 10,
      title: '配置',
    },
    name: 'AdminSettings',
    path: '/settings',
    children: [
      {
        component: () => import('#/views/settings/components/vendorConfig.vue'),
        meta: {
          affixTab: true,
          icon: 'lucide:sliders-horizontal',
          title: '模型服务',
        },
        name: 'SettingsVendorConfig',
        path: '/settings/vendor-config',
      },
      {
        component: () => import('#/views/settings/components/modelMap.vue'),
        meta: {
          icon: 'lucide:monitor-cog',
          title: '模型映射',
        },
        name: 'SettingsModelMap',
        path: '/settings/model-map',
      },
      {
        component: () => import('#/views/settings/components/agentConfog.vue'),
        meta: {
          icon: 'lucide:bot',
          title: 'Agent配置',
        },
        name: 'SettingsAgentConfig',
        path: '/settings/agent-config',
      },
      {
        component: () => import('#/views/settings/components/promptManage.vue'),
        meta: {
          icon: 'lucide:message-square-text',
          title: '提示词管理',
        },
        name: 'SettingsPromptManage',
        path: '/settings/prompt-manage',
      },
      {
        component: () => import('#/views/settings/components/skillManagement.vue'),
        meta: {
          icon: 'lucide:workflow',
          title: 'Skills技能管理',
        },
        name: 'SettingsSkillManagement',
        path: '/settings/skill-management',
      },
      {
        component: () => import('#/views/settings/components/memoryConfig.vue'),
        meta: {
          icon: 'lucide:database-zap',
          title: 'Agent记忆配置',
        },
        name: 'SettingsMemoryConfig',
        path: '/settings/memory-config',
      },
      {
        component: () => import('#/views/settings/components/dbConfig.vue'),
        meta: {
          icon: 'lucide:database',
          title: '数据库操作',
        },
        name: 'SettingsDbConfig',
        path: '/settings/db-config',
      },
      {
        component: () => import('#/views/settings/components/fileManagement.vue'),
        meta: {
          icon: 'lucide:folder-open',
          title: '文件管理',
        },
        name: 'SettingsFileManagement',
        path: '/settings/file-management',
      },
    ],
  },
];

export default routes;
