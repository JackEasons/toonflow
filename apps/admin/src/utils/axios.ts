import type { AxiosError, AxiosRequestConfig } from 'axios';

import { preferences } from '@super/preferences';
import { useAccessStore } from '@super/stores';

import axios from 'axios';
import { MessagePlugin } from 'tdesign-vue-next';

const instance = axios.create({
  baseURL: import.meta.env.VITE_GLOB_API_URL || '/api',
});

instance.interceptors.request.use((config) => {
  const accessStore = useAccessStore();
  const token = accessStore.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['Accept-Language'] = preferences.app.locale;
  return config;
});

instance.interceptors.response.use(
  (response) => {
    if (response.config.responseType === 'blob') {
      return response.data;
    }
    return response.data;
  },
  (error: AxiosError<{ message?: string; msg?: string }>) => {
    const payload = error.response?.data;
    const message = payload?.message || payload?.msg || error.message;
    if (error.response?.status === 401) {
      MessagePlugin.error(message || '登录已失效');
    }
    return Promise.reject(payload ?? error);
  },
);

export default instance as {
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
};
