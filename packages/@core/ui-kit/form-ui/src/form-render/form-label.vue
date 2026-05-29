<script setup lang="ts">
import type { CustomRenderType } from '../types';

import {
  FormLabel,
  SuperHelpTooltip,
  SuperRenderContent,
} from '@super-core/shadcn-ui';
import { cn } from '@super-core/shared/utils';

interface Props {
  class?: string;
  colon?: boolean;
  help?: CustomRenderType;
  label?: CustomRenderType;
  required?: boolean;
}

const props = defineProps<Props>();
</script>

<template>
  <FormLabel :class="cn('flex items-center', props.class)">
    <span v-if="required" class="mr-0.5 text-destructive">*</span>
    <slot></slot>
    <SuperHelpTooltip v-if="help" trigger-class="size-3.5 ml-1">
      <SuperRenderContent :content="help" />
    </SuperHelpTooltip>
    <slot name="extra"></slot>
    <span v-if="colon && label" class="ml-0.5">:</span>
  </FormLabel>
</template>
