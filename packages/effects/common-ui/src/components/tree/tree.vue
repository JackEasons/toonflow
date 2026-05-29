<script setup lang="ts">
import type { TreeProps } from '@super-core/shadcn-ui';

import { Inbox } from '@super/icons';
import { $t } from '@super/locales';

import { treePropsDefaults, SuperTree } from '@super-core/shadcn-ui';

const props = withDefaults(defineProps<TreeProps>(), treePropsDefaults());
</script>

<template>
  <SuperTree v-if="props.treeData?.length > 0" v-bind="props">
    <template v-for="(_, key) in $slots" :key="key" #[key]="slotProps">
      <slot :name="key" v-bind="slotProps"> </slot>
    </template>
  </SuperTree>
  <div
    v-else
    class="flex-col-center cursor-pointer rounded-lg border p-10 text-sm font-medium text-muted-foreground"
  >
    <Inbox class="size-10" />
    <div class="mt-1">{{ $t('common.noData') }}</div>
  </div>
</template>
