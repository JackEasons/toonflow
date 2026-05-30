import { useAccessStore } from '@super/stores';

import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    username?: string;
  }

  /** 注册接口参数 */
  export interface RegisterParams {
    confirmPassword?: string;
    inviteCode?: string;
    password?: string;
    username?: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
  }

  export interface RefreshTokenResponse {
    data: {
      code: number;
      data: string;
      message?: string;
    };
    status: number;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/auth/login', data);
}

/**
 * 注册
 */
export async function registerApi(data: AuthApi.RegisterParams) {
  return requestClient.post('/login/register', data);
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  const accessStore = useAccessStore();
  const resp = await baseRequestClient.post<AuthApi.RefreshTokenResponse>(
    '/auth/refresh',
    undefined,
    {
      headers: accessStore.accessToken
        ? { Authorization: `Bearer ${accessStore.accessToken}` }
        : {},
      withCredentials: true,
    },
  );
  return resp.data.data;
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return requestClient.post('/auth/logout', {
    withCredentials: true,
  });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/auth/codes');
}
