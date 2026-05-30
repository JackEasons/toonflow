<script lang="ts" setup>
import { useSuperModal } from '@super/common-ui';

import { Button } from 'antdv-next';

import DragDemo from './drag-demo.vue';

const [Modal] = useSuperModal({
  destroyOnClose: true,
});
const [BaseModal, baseModalApi] = useSuperModal({
  connectedComponent: DragDemo,
});

function openNestedModal() {
  baseModalApi.open();
}
</script>
<template>
  <Modal title="嵌套弹窗示例">
    <Button @click="openNestedModal" type="primary">打开子弹窗</Button>
    <BaseModal />
  </Modal>
</template>
