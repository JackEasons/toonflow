<script setup lang="ts">
import type { NotificationSettings, Recordable } from '@super/types';

import { computed, onMounted, ref } from 'vue';

import { ProfileNotificationSetting } from '@super/common-ui';

import { message } from '#/adapter/tdesign';
import {
  getNotificationSettingsApi,
  updateNotificationSettingsApi,
} from '#/api';

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  accountPassword: true,
  systemMessage: true,
  todoTask: true,
};

const settings = ref<NotificationSettings>({ ...DEFAULT_NOTIFICATION_SETTINGS });

const formSchema = computed(() => {
  return [
    {
      value: settings.value.accountPassword,
      fieldName: 'accountPassword',
      label: '账户密码',
      description: '账户安全和密码变更消息将以站内信的形式通知',
    },
    {
      value: settings.value.systemMessage,
      fieldName: 'systemMessage',
      label: '系统消息',
      description: '系统消息将以站内信的形式通知',
    },
    {
      value: settings.value.todoTask,
      fieldName: 'todoTask',
      label: '待办任务',
      description: '待办任务将以站内信的形式通知',
    },
  ];
});

async function loadSettings() {
  settings.value = await getNotificationSettingsApi();
}

async function handleChange(payload: Recordable<any>) {
  if (!(payload.fieldName in settings.value)) return;

  const fieldName = payload.fieldName as keyof NotificationSettings;
  const previous = { ...settings.value };
  settings.value = {
    ...settings.value,
    [fieldName]: payload.value,
  };

  try {
    settings.value = await updateNotificationSettingsApi(settings.value);
    message.success('提醒设置已保存');
  } catch {
    settings.value = previous;
  }
}

onMounted(loadSettings);
</script>
<template>
  <ProfileNotificationSetting
    :form-schema="formSchema"
    @change="handleChange"
  />
</template>
