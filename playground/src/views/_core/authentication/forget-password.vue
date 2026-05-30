<script lang="ts" setup>
import type { SuperFormSchema } from '@super/common-ui';

import { computed, ref } from 'vue';

import { AuthenticationForgetPassword, z } from '@super/common-ui';
import { $t } from '@super/locales';

defineOptions({ name: 'ForgetPassword' });

const loading = ref(false);

const formSchema = computed((): SuperFormSchema[] => {
  return [
    {
      component: 'SuperInput',
      componentProps: {
        placeholder: 'example@example.com',
      },
      fieldName: 'email',
      label: $t('authentication.email'),
      rules: z
        .string()
        .min(1, { message: $t('authentication.emailTip') })
        .email($t('authentication.emailValidErrorTip')),
    },
  ];
});

function handleSubmit(value: Record<string, any>) {
  void value;
}
</script>

<template>
  <AuthenticationForgetPassword
    :form-schema="formSchema"
    :loading="loading"
    @submit="handleSubmit"
  />
</template>
