import type { NotificationSettings, UserInfo } from '@super/types';

import { requestClient } from '#/api/request';

export interface UpdateUserProfileParams {
  avatar?: string;
  introduction?: string;
  realName?: string;
  username: string;
}

export interface UpdateUserPasswordParams {
  confirmPassword: string;
  newPassword: string;
  oldPassword: string;
}

export interface UploadUserAvatarParams {
  contentBase64: string;
  filename?: string;
}

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  return requestClient.get<UserInfo>('/user/info');
}

/**
 * 更新当前用户资料
 */
export async function updateUserProfileApi(data: UpdateUserProfileParams) {
  return requestClient.post<UserInfo>('/user/updateProfile', data);
}

/**
 * 上传当前用户头像
 */
export async function uploadUserAvatarApi(data: UploadUserAvatarParams) {
  return requestClient.post<UserInfo>('/user/uploadAvatar', data);
}

/**
 * 修改当前用户密码
 */
export async function updateUserPasswordApi(data: UpdateUserPasswordParams) {
  return requestClient.post<null>('/user/updatePassword', data);
}

/**
 * 获取新消息提醒设置
 */
export async function getNotificationSettingsApi() {
  return requestClient.get<NotificationSettings>('/user/notificationSettings');
}

/**
 * 更新新消息提醒设置
 */
export async function updateNotificationSettingsApi(
  data: Partial<NotificationSettings>,
) {
  return requestClient.post<NotificationSettings>(
    '/user/notificationSettings',
    data,
  );
}
