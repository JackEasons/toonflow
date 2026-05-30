import { isAdminUser } from "@/utils/admin";

export interface NotificationSettings {
  accountPassword: boolean;
  systemMessage: boolean;
  todoTask: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  accountPassword: true,
  systemMessage: true,
  todoTask: true,
};

export function parseNotificationSettings(value: unknown): NotificationSettings {
  let parsed: unknown = value;
  if (typeof value === "string" && value.trim()) {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = {};
    }
  }

  const settings = parsed && typeof parsed === "object" ? (parsed as Partial<NotificationSettings>) : {};
  return {
    accountPassword:
      typeof settings.accountPassword === "boolean" ? settings.accountPassword : DEFAULT_NOTIFICATION_SETTINGS.accountPassword,
    systemMessage: typeof settings.systemMessage === "boolean" ? settings.systemMessage : DEFAULT_NOTIFICATION_SETTINGS.systemMessage,
    todoTask: typeof settings.todoTask === "boolean" ? settings.todoTask : DEFAULT_NOTIFICATION_SETTINGS.todoTask,
  };
}

export function buildUserInfo(user: any) {
  const username = String(user?.name || "");
  const introduction = String(user?.introduction || "");
  const realName = String(user?.realName || username);

  return {
    avatar: String(user?.avatar || ""),
    desc: introduction,
    homePath: "/analytics",
    introduction,
    notificationSettings: parseNotificationSettings(user?.notificationSettings),
    realName,
    roles: isAdminUser(user) ? ["admin"] : ["user"],
    userId: String(user?.id || ""),
    username,
  };
}
