import type { RouteRecordRaw } from 'vue-router';

import {
  SUPER_ANT_PREVIEW_URL,
  SUPER_ANTDV_NEXT_PREVIEW_URL,
  SUPER_DOC_URL,
  SUPER_ELE_PREVIEW_URL,
  SUPER_GITHUB_URL,
  SUPER_LOGO_URL,
  SUPER_NAIVE_PREVIEW_URL,
} from '@super/constants';
import { SvgAntdvLogoIcon, SvgAntdvNextLogoIcon } from '@super/icons';

import { IFrameView } from '#/layouts';
import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      badgeType: 'dot',
      icon: SUPER_LOGO_URL,
      order: 9998,
      title: $t('demos.super.title'),
    },
    name: 'SuperProject',
    path: '/super-admin',
    children: [
      {
        name: 'SuperDocument',
        path: '/super-admin/document',
        component: IFrameView,
        meta: {
          icon: 'lucide:book-open-text',
          link: SUPER_DOC_URL,
          title: $t('demos.super.document'),
        },
      },
      {
        name: 'SuperGithub',
        path: '/super-admin/github',
        component: IFrameView,
        meta: {
          icon: 'mdi:github',
          link: SUPER_GITHUB_URL,
          title: 'Github',
        },
      },
      {
        name: 'SuperNaive',
        path: '/super-admin/naive',
        component: IFrameView,
        meta: {
          badgeType: 'dot',
          icon: 'logos:naiveui',
          link: SUPER_NAIVE_PREVIEW_URL,
          title: $t('demos.super.naive-ui'),
        },
      },
      {
        name: 'SuperAntdv',
        path: '/super-admin/antdv',
        component: IFrameView,
        meta: {
          badgeType: 'dot',
          icon: SvgAntdvLogoIcon,
          link: SUPER_ANT_PREVIEW_URL,
          title: $t('demos.super.antdv'),
        },
      },
      {
        name: 'SuperAntdVNext',
        path: '/super-admin/antdv-next',
        component: IFrameView,
        meta: {
          badgeType: 'dot',
          icon: SvgAntdvNextLogoIcon,
          link: SUPER_ANTDV_NEXT_PREVIEW_URL,
          title: $t('demos.super.antdv-next'),
        },
      },
      {
        name: 'SuperElementPlus',
        path: '/super-admin/ele',
        component: IFrameView,
        meta: {
          badgeType: 'dot',
          icon: 'logos:element',
          link: SUPER_ELE_PREVIEW_URL,
          title: $t('demos.super.element-plus'),
        },
      },
    ],
  },
  {
    name: 'SuperAbout',
    path: '/super-admin/about',
    component: () => import('#/views/_core/about/index.vue'),
    meta: {
      icon: 'lucide:copyright',
      title: $t('demos.super.about'),
      order: 9999,
    },
  },
  {
    name: 'Profile',
    path: '/profile',
    component: () => import('#/views/_core/profile/index.vue'),
    meta: {
      icon: 'lucide:user',
      hideInMenu: true,
      title: $t('page.auth.profile'),
    },
  },
];

export default routes;
