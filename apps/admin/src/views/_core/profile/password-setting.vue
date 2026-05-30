<script setup lang="ts">
import type { Recordable } from '@super/types';
import type { SuperFormSchema } from '#/adapter/form';

import { computed, ref } from 'vue';

import { ProfilePasswordSetting, z } from '@super/common-ui';

import { message } from '#/adapter/tdesign';
import { updateUserPasswordApi } from '#/api';

const passwordSettingRef = ref();
const submitting = ref(false);

const formSchema = computed((): SuperFormSchema[] => {
  return [
    {
      fieldName: 'oldPassword',
      label: '旧密码',
      component: 'SuperInputPassword',
      componentProps: {
        placeholder: '请输入旧密码',
      },
      rules: z.string().min(1, { message: '请输入旧密码' }),
    },
    {
      fieldName: 'newPassword',
      label: '新密码',
      component: 'SuperInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: '请输入新密码',
      },
      rules: z
        .string()
        .min(6, { message: '密码长度为 6-20 个字符' })
        .max(20, { message: '密码长度为 6-20 个字符' }),
    },
    {
      fieldName: 'confirmPassword',
      label: '确认密码',
      component: 'SuperInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: '请再次输入新密码',
      },
      dependencies: {
        rules(values) {
          const { newPassword } = values;
          return z
            .string({ required_error: '请再次输入新密码' })
            .min(1, { message: '请再次输入新密码' })
            .max(20, { message: '密码长度为 6-20 个字符' })
            .refine((value) => value === newPassword, {
              message: '两次输入的密码不一致',
            });
        },
        triggerFields: ['newPassword'],
      },
    },
  ];
});

async function handleSubmit(values: Recordable<any>) {
  if (submitting.value) return;
  submitting.value = true;
  try {
    await updateUserPasswordApi({
      confirmPassword: String(values.confirmPassword || ''),
      newPassword: String(values.newPassword || ''),
      oldPassword: String(values.oldPassword || ''),
    });
    await passwordSettingRef.value?.getFormApi()?.resetForm?.();
    message.success('密码修改成功');
  } finally {
    submitting.value = false;
  }
}
</script>
<template>
  <ProfilePasswordSetting
    ref="passwordSettingRef"
    class="w-1/3"
    :form-schema="formSchema"
    @submit="handleSubmit"
  />
</template>
