<script setup lang="ts">
import type { Recordable } from '@super/types';

import type { SuperFormSchema } from '@super-core/form-ui';

import { computed, reactive } from 'vue';

import { $t } from '@super/locales';

import { useSuperForm } from '@super-core/form-ui';
import { SuperButton } from '@super-core/shadcn-ui';

interface Props {
  formSchema?: SuperFormSchema[];
}

const props = withDefaults(defineProps<Props>(), {
  formSchema: () => [],
});

const emit = defineEmits<{
  submit: [Recordable<any>];
}>();

const [Form, formApi] = useSuperForm(
  reactive({
    commonConfig: {
      labelWidth: 130,
      // 所有表单项
      componentProps: {
        class: 'w-full',
      },
    },
    layout: 'horizontal',
    schema: computed(() => props.formSchema),
    showDefaultActions: false,
  }),
);

async function handleSubmit() {
  const { valid } = await formApi.validate();
  const values = await formApi.getValues();
  if (valid) {
    emit('submit', values);
  }
}

defineExpose({
  getFormApi: () => formApi,
});
</script>
<template>
  <div>
    <Form />
    <SuperButton type="submit" class="mt-4" @click="handleSubmit">
      {{ $t('profile.updatePassword') }}
    </SuperButton>
  </div>
</template>
