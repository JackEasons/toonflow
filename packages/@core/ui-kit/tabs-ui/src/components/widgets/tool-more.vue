<script lang="ts" setup>
import type { DropdownMenuProps } from '@super-core/shadcn-ui';

import { LayoutGrid } from '@super-core/icons';
import { SuperDropdownMenu } from '@super-core/shadcn-ui';

defineProps<DropdownMenuProps>();
</script>

<template>
  <SuperDropdownMenu :menus="menus" :modal="false">
    <div
      class="flex-center h-full cursor-pointer border-l border-border px-2 text-lg font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <LayoutGrid class="size-4" />
    </div>
  </SuperDropdownMenu>
</template>
