<script lang="ts" setup>
import { SuperSpinner } from '@super-core/shadcn-ui';

import { useContentSpinner } from './use-content-spinner';

defineOptions({ name: 'LayoutContentSpinner' });

const { spinning } = useContentSpinner();
</script>
<template>
  <SuperSpinner :spinning="spinning" />
</template>
