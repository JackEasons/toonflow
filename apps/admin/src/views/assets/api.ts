import { requestClient } from '#/api/request';

export interface AdminAssetItem {
  assetsId: null | number | string;
  describe: string;
  filePath: string;
  fileType: string;
  id: number | string;
  imageErrorReason: string;
  imageId: null | number | string;
  imageState: string;
  name: string;
  parentName: string;
  previewUrl: string;
  projectId: null | number | string;
  projectName: string;
  prompt: string;
  promptErrorReason: string;
  promptState: string;
  remark: string;
  src: string;
  startTime: null | number | string;
  type: string;
  typeLabel: string;
  userId: null | number | string;
  userName: string;
  username: string;
}

export interface AdminAssetStatistics {
  childAssets: number;
  failed: number;
  generated: number;
  running: number;
  total: number;
  withPrompt: number;
}

export interface AdminAssetListResult {
  list: AdminAssetItem[];
  page: number;
  pageSize: number;
  statistics: AdminAssetStatistics;
  total: number;
}

export interface AdminAssetOption {
  label: string;
  value: string;
}

export interface AdminAssetOptions {
  projects: AdminAssetOption[];
  states: AdminAssetOption[];
  types: AdminAssetOption[];
  users: AdminAssetOption[];
}

export interface AdminAssetListParams {
  keyword?: string;
  page: number;
  pageSize: number;
  projectId?: string;
  scope?: string;
  state?: string;
  type?: string;
  userId?: string;
}

export interface AdminAssetUpdatePayload {
  describe: string;
  id: number | string;
  name: string;
  prompt: string;
  remark: string;
}

export function formatDateTime(value: null | number | string | undefined) {
  if (!value) return '-';
  const timestamp = typeof value === 'number' ? value : Number(value);
  const date = Number.isFinite(timestamp) ? new Date(timestamp) : new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN');
}

export function formatInt(value: null | number | string | undefined) {
  return Math.round(Number(value || 0)).toLocaleString('zh-CN');
}

export async function fetchAdminAssets(params: AdminAssetListParams) {
  return await requestClient.get<AdminAssetListResult>('/admin/assets/list', {
    params,
  });
}

export async function fetchAdminAssetOptions() {
  return await requestClient.get<AdminAssetOptions>('/admin/assets/options');
}

export async function updateAdminAsset(payload: AdminAssetUpdatePayload) {
  return await requestClient.post<AdminAssetItem>('/admin/assets/update', payload);
}

export async function deleteAdminAsset(id: number | string) {
  return await requestClient.post<{ deleted: number }>('/admin/assets/delete', {
    id: Number(id),
  });
}

export async function batchDeleteAdminAssets(ids: Array<number | string>) {
  return await requestClient.post<{ deleted: number }>('/admin/assets/batchDelete', {
    ids: ids.map((id) => Number(id)),
  });
}
