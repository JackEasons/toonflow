<script setup lang="ts">
import type { Recordable, UserInfo } from '@super/types';

import type { SuperFormSchema } from '#/adapter/form';

import { computed, onMounted, ref } from 'vue';

import { ImagePlus } from '@super/icons';
import { ProfileBaseSetting, z } from '@super/common-ui';
import { useUserStore } from '@super/stores';

import { message } from '#/adapter/tdesign';
import {
  getUserInfoApi,
  updateUserProfileApi,
  uploadUserAvatarApi,
} from '#/api';

const profileBaseSettingRef = ref();
const avatarInputRef = ref<HTMLInputElement>();
const avatarPreview = ref('');
const avatarUploading = ref(false);
const avatarFileName = ref('');
const userStore = useUserStore();

const ACCEPTED_AVATAR_TYPES = ['image/gif', 'image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_AVATAR_EXTENSIONS = ['gif', 'jpeg', 'jpg', 'png', 'webp'];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

const avatarInitials = computed(() => {
  const name = userStore.userInfo?.realName || userStore.userInfo?.username || 'U';
  return name.slice(0, 2).toUpperCase();
});

function getRoleText(userInfo: UserInfo) {
  const labels: Record<string, string> = {
    admin: '管理员',
    user: '用户',
  };
  return userInfo.roles?.map((role) => labels[role] ?? role).join('、') || '用户';
}

function setProfileFormValues(userInfo: UserInfo) {
  avatarPreview.value = userInfo.avatar || '';
  profileBaseSettingRef.value?.getFormApi().setValues({
    introduction: userInfo.introduction || '',
    realName: userInfo.realName || userInfo.username,
    roleText: getRoleText(userInfo),
    username: userInfo.username,
  });
}

function getFileExtension(filename: string) {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function isAcceptedAvatar(file: File) {
  const extension = getFileExtension(file.name);
  return (
    ACCEPTED_AVATAR_TYPES.includes(file.type) ||
    ACCEPTED_AVATAR_EXTENSIONS.includes(extension)
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function selectAvatarFile() {
  avatarInputRef.value?.click();
}

async function handleAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  input.value = '';
  if (!isAcceptedAvatar(file)) {
    message.warning('仅支持 JPG、PNG、WEBP、GIF 图片');
    return;
  }
  if (file.size > MAX_AVATAR_SIZE) {
    message.warning('头像大小不能超过 5MB');
    return;
  }

  const previousAvatar = avatarPreview.value;
  avatarUploading.value = true;
  avatarFileName.value = file.name;

  try {
    const contentBase64 = await readFileAsDataUrl(file);
    avatarPreview.value = contentBase64;
    const userInfo = await uploadUserAvatarApi({
      contentBase64,
      filename: file.name,
    });
    userStore.setUserInfo(userInfo);
    setProfileFormValues(userInfo);
    message.success('头像已更新');
  } catch {
    avatarPreview.value = previousAvatar;
    message.error('头像上传失败');
  } finally {
    avatarUploading.value = false;
  }
}

const formSchema = computed((): SuperFormSchema[] => {
  return [
    {
      fieldName: 'realName',
      component: 'Input',
      label: '姓名',
      componentProps: {
        maxlength: 30,
        placeholder: '请输入姓名',
      },
      rules: z
        .string()
        .max(30, { message: '姓名长度不能超过 30 个字符' })
        .optional(),
    },
    {
      fieldName: 'username',
      component: 'Input',
      label: '用户名',
      componentProps: {
        maxlength: 20,
        placeholder: '请输入用户名',
      },
      rules: z
        .string()
        .min(2, { message: '用户名长度为 2-20 个字符' })
        .max(20, { message: '用户名长度为 2-20 个字符' }),
    },
    {
      fieldName: 'roleText',
      component: 'Input',
      componentProps: {
        disabled: true,
        placeholder: '用户角色',
      },
      label: '角色',
    },
    {
      fieldName: 'introduction',
      component: 'Textarea',
      label: '个人简介',
      componentProps: {
        autosize: { minRows: 4, maxRows: 6 },
        maxlength: 300,
        placeholder: '补充你的个人简介',
      },
      rules: z
        .string()
        .max(300, { message: '个人简介不能超过 300 个字符' })
        .optional(),
    },
  ];
});

async function loadProfile() {
  const data = await getUserInfoApi();
  userStore.setUserInfo(data);
  setProfileFormValues(data);
}

async function handleSubmit(values: Recordable<any>) {
  const userInfo = await updateUserProfileApi({
    introduction: String(values.introduction || ''),
    realName: String(values.realName || ''),
    username: String(values.username || ''),
  });
  userStore.setUserInfo(userInfo);
  setProfileFormValues(userInfo);
  message.success('个人信息已保存');
}

onMounted(loadProfile);
</script>
<template>
  <div class="profileBasePanel">
    <div class="avatarUploadPanel">
      <div class="avatarPreviewBox">
        <img v-if="avatarPreview" :src="avatarPreview" alt="头像" />
        <span v-else>{{ avatarInitials }}</span>
      </div>
      <div class="avatarUploadBody">
        <div class="avatarUploadLabel">头像</div>
        <div class="avatarUploadHint">JPG、PNG、WEBP、GIF，最大 5MB</div>
        <div class="avatarActions">
          <t-button
            theme="primary"
            variant="outline"
            :loading="avatarUploading"
            @click="selectAvatarFile"
          >
            <template #icon>
              <ImagePlus class="avatarUploadIcon" />
            </template>
            上传头像
          </t-button>
          <span v-if="avatarFileName" class="avatarFileName">
            {{ avatarFileName }}
          </span>
        </div>
      </div>
      <input
        ref="avatarInputRef"
        class="avatarFileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        @change="handleAvatarChange"
      />
    </div>

    <ProfileBaseSetting
      ref="profileBaseSettingRef"
      :form-schema="formSchema"
      @submit="handleSubmit"
    />
  </div>
</template>

<style scoped>
.profileBasePanel {
  max-width: 680px;
}

.avatarUploadPanel {
  display: flex;
  gap: 16px;
  align-items: center;
  padding-bottom: 24px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--td-border-level-1-color);
}

.avatarPreviewBox {
  display: flex;
  flex: 0 0 72px;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  overflow: hidden;
  font-size: 18px;
  font-weight: 700;
  color: var(--td-text-color-primary);
  background: var(--td-bg-color-component);
  border: 1px solid var(--td-border-level-2-color);
  border-radius: 50%;
}

.avatarPreviewBox img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatarUploadBody {
  min-width: 0;
}

.avatarUploadLabel {
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.avatarUploadHint {
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.avatarActions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.avatarUploadIcon {
  width: 16px;
  height: 16px;
}

.avatarFileName {
  max-width: 240px;
  overflow: hidden;
  font-size: 12px;
  color: var(--td-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.avatarFileInput {
  display: none;
}

@media (max-width: 640px) {
  .avatarUploadPanel {
    align-items: flex-start;
  }
}
</style>
