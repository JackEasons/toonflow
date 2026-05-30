import axios from '#/utils/axios';

export interface MembershipPlan {
  billingPeriod: string;
  enabled: boolean;
  features: string[];
  key: string;
  levelKey: string;
  levelName: string;
  maxSeries: null | number;
  maxShots: null | number;
  name: string;
  originalPriceCny: null | number;
  pointValidityDays: number;
  points: number;
  popular: boolean;
  priceCny: number;
  sortOrder: number;
  yearlyDiscountLabel: null | string;
}

export interface PointsPackage {
  description: string;
  enabled: boolean;
  key: string;
  points: number;
  priceCny: number;
  sortOrder: number;
  validityDays: number;
}

export interface MembershipOverview {
  plans: MembershipPlan[];
  pointPackages: PointsPackage[];
  totals: {
    activeMembers: number;
    balance: number;
    frozenBalance: number;
    paidOrders: number;
    totalSpent: number;
    users: number;
  };
}

export interface MemberUser {
  avatar: string;
  membership: {
    autoRenew: boolean;
    expiresAt: null | string;
    levelKey: string;
    levelName: string;
    planKey: string;
    status: string;
  };
  name: string;
  points: {
    bonus: number;
    frozen: number;
    membership: number;
    recharge: number;
    remaining: number;
    spent: number;
  };
  userId: string;
  username: string;
}

export interface OrderRecord {
  amountCny: number;
  createdAt: null | string;
  id: string;
  kind: 'plan' | 'points';
  orderNo: string;
  paidAt: null | string;
  paymentMethod: string;
  planKey: string;
  points: number;
  pointsPackageKey: string;
  status: string;
  userId: string;
  userName: string;
}

export interface PointTransaction {
  amount: number;
  balanceAfter: number;
  category: string;
  createdAt: null | string;
  description: string;
  id: string;
  operatorId: string;
  type: string;
  userId: string;
  userName: string;
}

export interface PageResult<T> {
  list: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function formatInt(value: null | number | string | undefined) {
  return Math.round(Number(value || 0)).toLocaleString('zh-CN');
}

export function formatMoney(value: null | number | string | undefined) {
  const numberValue = Number(value || 0);
  return numberValue === 0
    ? '免费'
    : `¥${numberValue.toLocaleString('zh-CN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: Number.isInteger(numberValue) ? 0 : 2,
      })}`;
}

export function formatDate(value: null | string | undefined) {
  return value ? new Date(value).toLocaleDateString('zh-CN') : '长期有效';
}

export function formatDateTime(value: null | string | undefined) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

export function formatOrderStatus(status: string) {
  return (
    {
      canceled: '已取消',
      paid: '已支付',
      pending: '待支付',
      refunded: '已退款',
    } as Record<string, string>
  )[status] || status;
}

export async function fetchOverview() {
  const res = await axios.get('/admin/membership/overview');
  return res.data as MembershipOverview;
}

export async function fetchCatalog() {
  const res = await axios.get('/admin/membership/catalog');
  return res.data as Pick<MembershipOverview, 'plans' | 'pointPackages'>;
}

export async function fetchUsers(params: {
  keyword?: string;
  page: number;
  pageSize: number;
}) {
  const res = await axios.get('/admin/membership/users', { params });
  return res.data as PageResult<MemberUser>;
}

export async function fetchOrders(params: {
  page: number;
  pageSize: number;
  status?: string;
  userId?: string;
}) {
  const res = await axios.get('/admin/membership/orders', { params });
  return res.data as PageResult<OrderRecord>;
}

export async function fetchTransactions(params: {
  page: number;
  pageSize: number;
  type?: string;
  userId?: string;
}) {
  const res = await axios.get('/admin/membership/transactions', { params });
  return res.data as PageResult<PointTransaction>;
}

export async function adjustPoints(payload: {
  amount: number;
  bucket: 'bonus' | 'membership' | 'recharge';
  description?: string;
  userId: string;
}) {
  await axios.post('/admin/membership/adjustPoints', payload);
}

export async function updateMembership(payload: {
  autoRenew: boolean;
  expiresAt?: null | string;
  levelKey: string;
  levelName: string;
  planKey?: null | string;
  status: string;
  userId: string;
}) {
  await axios.post('/admin/membership/updateMembership', payload);
}

export async function updateOrder(payload: {
  id: string;
  status: 'canceled' | 'paid' | 'pending' | 'refunded';
}) {
  await axios.post('/admin/membership/updateOrder', payload);
}

export async function savePlan(payload: MembershipPlan) {
  const res = await axios.post('/admin/membership/savePlan', payload);
  return res.data as Pick<MembershipOverview, 'plans' | 'pointPackages'>;
}

export async function savePackage(payload: PointsPackage) {
  const res = await axios.post('/admin/membership/savePointsPackage', payload);
  return res.data as Pick<MembershipOverview, 'plans' | 'pointPackages'>;
}
