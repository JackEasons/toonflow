import axios from '#/utils/axios';

export interface AnalyticsChartItem {
  amount?: number;
  name: string;
  orders?: number;
  value: number;
}

export interface AnalyticsTrendItem {
  activeUsers: number;
  date: string;
  label: string;
  modelCalls: number;
  pointsConsumed: number;
  rechargeAmount: number;
}

export interface MonthlyRechargeItem {
  amount: number;
  month: string;
  orders: number;
}

export interface RecentTaskItem {
  id: string;
  model: string;
  projectId: null | string;
  projectName: string;
  startTime: null | number;
  state: string;
  taskClass: string;
}

export interface AdminAnalyticsOverview {
  activeMembers: number;
  activeRate: number;
  activeUsers30d: number;
  averageOrderAmount: number;
  expiringMembers7d: number;
  memberConversionRate: number;
  modelCalls: number;
  paidOrders: number;
  pendingOrders: number;
  pointsBalance: number;
  pointsBonus: number;
  pointsBurnRate: number;
  pointsConsumed: number;
  pointsFrozen: number;
  pointsMembership: number;
  pointsRecharge: number;
  projects: number;
  rechargeAmount: number;
  successRate: number;
  totalUsers: number;
}

export interface MembershipLevelItem {
  activeUsers: number;
  expiredUsers: number;
  key: string;
  name: string;
  totalUsers: number;
}

export interface ModelStatItem {
  failed: number;
  latestAt: null | number;
  model: string;
  running: number;
  success: number;
  successRate: number;
  total: number;
}

export interface ActiveUserItem {
  lastActiveAt: null | number;
  membershipName: string;
  modelCalls: number;
  pointsConsumed: number;
  projects: number;
  rechargeAmount: number;
  userId: string;
  userName: string;
}

export interface ActiveProjectItem {
  failed: number;
  lastTaskAt: null | number;
  modelCalls: number;
  pointsConsumed: number;
  projectId: string;
  projectName: string;
  running: number;
  success: number;
  successRate: number;
  userName: string;
}

export interface RevenueProductItem {
  amount: number;
  kind: string;
  name: string;
  orders: number;
  points: number;
}

export interface RecentPointTransactionItem {
  amount: number;
  balanceAfter: number;
  createdAt: null | number;
  description: string;
  id: string;
  projectId: null | string;
  taskType: string;
  type: string;
  userId: string;
  userName: string;
}

export interface AnalyticsInsightItem {
  action: string;
  description: string;
  level: 'info' | 'success' | 'warning';
  metric: string;
  title: string;
}

export interface AdminAnalyticsData {
  activeProjects: ActiveProjectItem[];
  activeUsers: ActiveUserItem[];
  generatedAt: string;
  insights: AnalyticsInsightItem[];
  membershipLevels: MembershipLevelItem[];
  modelStats: ModelStatItem[];
  modelUsage: AnalyticsChartItem[];
  monthlyRecharge: MonthlyRechargeItem[];
  overview: AdminAnalyticsOverview;
  orderStatus: AnalyticsChartItem[];
  pointBuckets: AnalyticsChartItem[];
  pointFlow: AnalyticsChartItem[];
  range: {
    days: number;
    endDate: string;
    startDate: string;
  };
  recentTasks: RecentTaskItem[];
  recentPointTransactions: RecentPointTransactionItem[];
  rechargeBreakdown: AnalyticsChartItem[];
  revenueProducts: RevenueProductItem[];
  stateUsage: AnalyticsChartItem[];
  taskUsage: AnalyticsChartItem[];
  trend: AnalyticsTrendItem[];
}

export function formatInt(value: null | number | string | undefined) {
  return Math.round(Number(value || 0)).toLocaleString('zh-CN');
}

export function formatMoney(value: null | number | string | undefined) {
  const numberValue = Number(value || 0);
  return `¥${numberValue.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(numberValue) ? 0 : 2,
  })}`;
}

export function formatPercent(value: null | number | string | undefined) {
  return `${Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}%`;
}

export function formatDateTime(value: null | number | string | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN');
}

export async function fetchAdminAnalytics(params?: { days?: number }) {
  const res = await axios.get('/admin/analytics/overview', { params });
  return res.data as AdminAnalyticsData;
}
