import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    redirect: '/membership/overview',
    meta: {
      authority: ['admin'],
      icon: 'lucide:crown',
      order: 5,
      title: '会员中心',
    },
    name: 'MembershipCenter',
    path: '/membership',
    children: [
      {
        component: () => import('#/views/membership/overview.vue'),
        meta: {
          affixTab: true,
          icon: 'lucide:layout-dashboard',
          title: '总览',
        },
        name: 'MembershipOverview',
        path: '/membership/overview',
      },
      {
        component: () => import('#/views/membership/users.vue'),
        meta: {
          icon: 'lucide:users',
          title: '用户管理',
        },
        name: 'MembershipUsers',
        path: '/membership/users',
      },
      {
        component: () => import('#/views/membership/orders.vue'),
        meta: {
          icon: 'lucide:receipt-text',
          title: '订单管理',
        },
        name: 'MembershipOrders',
        path: '/membership/orders',
      },
      {
        component: () => import('#/views/membership/points.vue'),
        meta: {
          icon: 'lucide:coins',
          title: '积分流水',
        },
        name: 'MembershipPoints',
        path: '/membership/points',
      },
      {
        component: () => import('#/views/membership/functions.vue'),
        meta: {
          icon: 'lucide:sliders-horizontal',
          title: '功能管理',
        },
        name: 'MembershipFunctions',
        path: '/membership/functions',
      },
    ],
  },
];

export default routes;
