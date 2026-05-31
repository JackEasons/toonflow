import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/admin/users.vue'),
    meta: {
      authority: ['admin'],
      icon: 'lucide:shield-user',
      order: 9,
      title: '管理员管理',
    },
    name: 'AdminUsers',
    path: '/admin/users',
  },
];

export default routes;
