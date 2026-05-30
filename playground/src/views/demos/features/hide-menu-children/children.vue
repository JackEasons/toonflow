<script lang="ts" setup>
import { Fallback, SuperButton } from '@super/common-ui';
import { useTabs } from '@super/hooks';
import { X } from '@super/icons';

const { closeCurrentTab } = useTabs();
</script>

<template>
  <Fallback
    description="当前路由在菜单中不可见"
    status="coming-soon"
    title="被隐藏的子菜单"
    show-back
  >
    <template #action>
      <SuperButton size="lg" @click="closeCurrentTab()">
        <X class="mr-2 size-4" />
        关闭当前标签页
      </SuperButton>
    </template>
  </Fallback>
</template>
