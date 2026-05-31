import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/task-center/index.vue'),
    meta: {
      authority: ['admin'],
      icon: 'lucide:list-checks',
      order: 4,
      title: '任务中心',
    },
    name: 'AdminTaskCenter',
    path: '/task-center',
  },
];

export default routes;
