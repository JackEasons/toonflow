import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/assets/index.vue'),
    meta: {
      authority: ['admin'],
      icon: 'lucide:images',
      order: 6,
      title: '资产管理',
    },
    name: 'AdminAssets',
    path: '/assets',
  },
];

export default routes;
