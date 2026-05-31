import { requestClient } from '#/api/request';

export interface TaskTokenUsage {
  completionTokens: null | number;
  promptTokens: null | number;
  reasoningTokens: null | number;
  source: string;
  totalTokens: null | number;
}

export interface TaskBillingRecord {
  amount: number;
  balanceAfter?: number;
  billingMeta?: Record<string, any>;
  createdAt: null | string;
  description: string;
  freezeId?: string;
  id: string;
  projectId: null | number | string;
  relatedId: null | number | string;
  releasedAt?: null | string;
  settledAt?: null | string;
  status?: string;
  taskType: string;
  type?: string;
  userId: string;
}

export interface TaskBilling {
  bucketDeductions: {
    bonus: number;
    membership: number;
    recharge: number;
  };
  count: number;
  frozenPoints: number;
  holds: TaskBillingRecord[];
  modelLabel: string;
  pointsPerCall: number;
  relatedIds: string[];
  releasedPoints: number;
  requiredPoints: number;
  settledPoints: number;
  status: 'frozen' | 'released' | 'settled' | 'unmatched';
  taskTypes: string[];
  tokenUsage: TaskTokenUsage;
  transactions: TaskBillingRecord[];
}

export interface AdminTaskItem {
  billing: TaskBilling;
  describe: string;
  hasNegativePrompt: boolean;
  hasPrompt: boolean;
  id: number | string;
  model: string;
  negativePrompt: string;
  projectId: null | number | string;
  projectName: string;
  prompt: string;
  reason: string;
  relatedObjects: string;
  startTime: null | number | string;
  state: string;
  taskClass: string;
  userId: null | number | string;
  userName: string;
  username: string;
}

export interface TaskBucket {
  count: number;
  name: string;
}

export interface AdminTaskListResult {
  list: AdminTaskItem[];
  modelBuckets: TaskBucket[];
  page: number;
  pageSize: number;
  stateBuckets: TaskBucket[];
  statistics: {
    completed: number;
    failed: number;
    running: number;
    successRate: number;
    total: number;
    withNegativePrompt: number;
    withPrompt: number;
  };
  taskClassBuckets: TaskBucket[];
  total: number;
}

export interface TaskOption {
  label: string;
  value: string;
}

export interface AdminTaskOptions {
  projects: TaskOption[];
  states: TaskOption[];
  taskClasses: TaskOption[];
  users: TaskOption[];
}

export interface AdminTaskListParams {
  keyword?: string;
  page: number;
  pageSize: number;
  projectId?: string;
  startFrom?: number;
  startTo?: number;
  state?: string;
  taskClass?: string;
  userId?: string;
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

export async function fetchAdminTasks(params: AdminTaskListParams) {
  return await requestClient.get<AdminTaskListResult>('/admin/tasks/list', {
    params,
  });
}

export async function fetchAdminTaskDetail(id: number | string) {
  return await requestClient.get<AdminTaskItem>('/admin/tasks/detail', {
    params: { id },
  });
}

export async function fetchAdminTaskOptions() {
  return await requestClient.get<AdminTaskOptions>('/admin/tasks/options');
}
