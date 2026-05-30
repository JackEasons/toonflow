import type { BasicUserInfo } from '@super-core/typings';

/** 用户信息 */
interface NotificationSettings {
  accountPassword: boolean;
  systemMessage: boolean;
  todoTask: boolean;
}

interface UserInfo extends BasicUserInfo {
  /**
   * 用户描述
   */
  desc?: string;
  /**
   * 首页地址
   */
  homePath: string;
  /**
   * 个人简介
   */
  introduction?: string;
  /**
   * 新消息提醒设置
   */
  notificationSettings?: NotificationSettings;

  /**
   * accessToken
   */
  token?: string;
}

export type { NotificationSettings, UserInfo };
