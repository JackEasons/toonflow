<script lang="ts" setup>
import { SUPER_DOC_URL } from '@super/constants';
import { openWindow } from '@super/utils';

import { Button } from 'antdv-next';

const props = defineProps<{ path: string }>();

function handleClick() {
  // 如果没有.html，打开页面时可能会出现404
  const path =
    SUPER_DOC_URL +
    (props.path.toLowerCase().endsWith('.html')
      ? props.path
      : `${props.path}.html`);
  openWindow(path);
}
</script>

<template>
  <Button @click="handleClick">查看组件文档</Button>
</template>
