<template>
  <div ref="rootRef" class="membershipCenter">
    <div class="pointsCard">
      <button type="button" class="pointsButton" :title="`积分明细：${formatInteger(pointSummary.remaining)}`" @click="pointsOpen = true">
        <i-magic theme="outline" size="14" />
        <span class="pointsValue">{{ formatCompactPoints(pointSummary.remaining) }}</span>
      </button>
      <button type="button" class="levelButton" :title="`购买订阅：${levelName}`" @click="openSubscribe('yearly')">
        {{ levelBadgeText }}
      </button>
    </div>

    <div class="avatarWrap">
      <button type="button" class="avatarButton" title="会员中心" aria-label="会员中心" @click="userMenuOpen = !userMenuOpen">
        <img v-if="userAvatar" :src="userAvatar" :alt="displayName" />
        <i-user v-else theme="outline" size="28" />
      </button>

      <transition name="member-pop">
        <div v-if="userMenuOpen" class="accountPopover">
          <div class="popoverUser">
            <div class="miniAvatar">
              <img v-if="userAvatar" :src="userAvatar" :alt="displayName" />
              <i-user v-else theme="outline" size="18" />
            </div>
            <button type="button" class="userNameButton" @click="copyUid">
              <strong>{{ displayName }}</strong>
              <span>复制UID</span>
            </button>
            <button type="button" class="iconButton" title="复制UID" aria-label="复制UID" @click="copyUid">
              <i-edit theme="outline" size="14" />
            </button>
          </div>

          <div class="memberPanel">
            <div class="memberLevel">
              <div class="memberLevelName">
                <i-diamond theme="outline" size="16" />
                <span>{{ levelName }}</span>
              </div>
              <span>{{ membershipExpireLabel }} 到期</span>
            </div>
            <div class="pointRows">
              <div class="pointRow">
                <span>当前积分</span>
                <strong>{{ formatInteger(pointSummary.remaining) }}</strong>
              </div>
              <div class="pointRow">
                <span>付费积分</span>
                <strong>{{ formatInteger(pointSummary.membership + pointSummary.recharge) }}</strong>
              </div>
              <div class="pointRow">
                <span>赠送积分</span>
                <strong>{{ formatInteger(pointSummary.bonus) }}</strong>
              </div>
            </div>
            <div class="memberActions">
              <button type="button" @click="openSubscriptionManage">订阅管理</button>
              <span />
              <button type="button" @click="openOrderRecords">订单记录</button>
            </div>
          </div>

          <button type="button" class="logoutButton" @click="logout">
            <i-logout theme="outline" size="16" />
            退出登录
          </button>
        </div>
      </transition>
    </div>

    <teleport to="body">
      <transition name="modal-fade">
        <div v-if="pointsOpen" class="membershipModalOverlay" @click.self="pointsOpen = false">
          <section class="pointsModal" role="dialog" aria-modal="true" aria-labelledby="points-title">
            <button type="button" class="modalClose" aria-label="关闭" @click="pointsOpen = false">
              <i-close theme="outline" size="20" />
            </button>
            <h2 id="points-title">积分明细</h2>

            <div class="pointFormula">
              <PointMetric label="剩余积分" :value="pointSummary.remaining" />
              <span>=</span>
              <PointMetric label="会员积分" :value="pointSummary.membership" />
              <span>+</span>
              <PointMetric label="充值积分" :value="pointSummary.recharge" />
              <span>+</span>
              <PointMetric label="赠送积分" :value="pointSummary.bonus" />
            </div>

            <div class="segmentedTabs">
              <button
                v-for="tab in pointTabs"
                :key="tab.id"
                type="button"
                :class="{ active: activePointTab === tab.id }"
                @click="activePointTab = tab.id">
                {{ tab.label }}
              </button>
            </div>

            <div class="transactionBox">
              <div v-if="visibleTransactions.length === 0" class="emptyState">暂无积分记录</div>
              <div v-else class="transactionList">
                <div v-for="item in visibleTransactions" :key="item.id" class="transactionItem">
                  <div>
                    <strong>{{ item.description || item.type }}</strong>
                    <span>{{ formatDateTime(item.createdAt) }}</span>
                  </div>
                  <b :class="{ consume: item.amount < 0 }">{{ item.amount > 0 ? "+" : "" }}{{ formatInteger(item.amount) }}</b>
                </div>
              </div>
            </div>

            <footer class="modalFooter">
              <div>
                <i-info theme="outline" size="16" />
                <span>仅展示近一年明细，数据更新可能存在延时</span>
                <button type="button" @click="showRules">积分规则</button>
              </div>
              <button type="button" class="primaryPill" @click="openSubscribe('yearly')">购买订阅</button>
            </footer>
          </section>
        </div>
      </transition>

      <transition name="modal-fade">
        <div v-if="subscribeOpen" class="membershipModalOverlay" @click.self="subscribeOpen = false">
          <section class="subscribeModal" role="dialog" aria-modal="true" aria-labelledby="subscribe-title">
            <button type="button" class="modalClose" aria-label="关闭" @click="subscribeOpen = false">
              <i-close theme="outline" size="20" />
            </button>
            <h2 id="subscribe-title">订阅会员 畅享更多权益</h2>
            <div class="segmentedTabs subscribeTabs">
              <button
                v-for="tab in subscribeTabs"
                :key="tab.id"
                type="button"
                :class="{ active: activeSubscribeTab === tab.id }"
                @click="activeSubscribeTab = tab.id">
                {{ tab.label }}
              </button>
            </div>
            <div class="paymentMethodPanel" :class="{ empty: paymentOptions.length === 0 }">
              <div class="paymentMethodHeader">
                <span>支付方式</span>
                <strong>{{ selectedPaymentProviderLabel }}</strong>
              </div>
              <div v-if="paymentOptions.length > 0" class="paymentMethodGrid">
                <button
                  v-for="item in paymentOptions"
                  :key="item.value"
                  type="button"
                  class="paymentMethodButton"
                  :class="{ active: selectedPaymentProvider === item.value }"
                  @click="selectedPaymentProvider = item.value">
                  <span class="paymentIcon" :class="item.value">{{ item.value === "alipay" ? "支" : "微" }}</span>
                  <span class="paymentMethodText">
                    <strong>{{ item.label }}</strong>
                    <small>{{ paymentMethodDescription(item.value) }}</small>
                  </span>
                </button>
              </div>
              <div v-else class="paymentUnavailable">暂未配置支付通道</div>
            </div>

            <div v-if="activeSubscribeTab !== 'points'" class="planGrid">
              <article v-for="plan in visiblePlans" :key="plan.key" class="planCard" :class="{ popular: plan.popular }">
                <div class="planHeader">
                  <span>{{ plan.badge }}</span>
                  <strong>{{ plan.name }}</strong>
                </div>
                <div class="planPrice">
                  <b>{{ plan.price }}</b>
                  <span>{{ plan.period }}</span>
                </div>
                <p>{{ plan.desc }}</p>
                <ul>
                  <li v-for="feature in plan.features" :key="feature">{{ feature }}</li>
                </ul>
                <button type="button" :disabled="ordering || paymentOptions.length === 0" @click="submitPlanOrder(plan)">
                  {{ ordering ? "创建中" : "立即订阅" }}
                </button>
              </article>
            </div>

            <div v-else class="packageGrid">
              <article v-for="pkg in pointPackages" :key="pkg.key" class="packageCard">
                <strong>{{ formatInteger(pkg.points) }}</strong>
                <span>积分</span>
                <p>{{ pkg.desc }}</p>
                <button type="button" :disabled="ordering || paymentOptions.length === 0" @click="submitPointPackageOrder(pkg)">
                  {{ ordering ? "创建中" : pkg.price }}
                </button>
              </article>
            </div>
          </section>
        </div>
      </transition>

      <transition name="modal-fade">
        <div v-if="paymentOpen" class="membershipModalOverlay" @click.self="paymentOpen = false">
          <section class="compactModal paymentResultModal" role="dialog" aria-modal="true" aria-labelledby="payment-title">
            <button type="button" class="modalClose" aria-label="关闭" @click="paymentOpen = false">
              <i-close theme="outline" size="20" />
            </button>
            <div class="paymentResultHeader">
              <span class="paymentStateIcon" :class="activePayment?.provider">{{ activePayment?.provider === "wechat" ? "微" : "支" }}</span>
              <div>
                <h2 id="payment-title">支付确认</h2>
                <p>{{ activePaymentLabel }} · 付款完成后刷新权益</p>
              </div>
            </div>
            <div class="summaryCard">
              <span>订单号</span>
              <strong>{{ activePayment?.orderNo || "-" }}</strong>
              <p v-if="activePayment?.type === 'wechat_native'">请复制 code_url 到微信支付二维码生成器，或切换 H5 支付。</p>
              <p v-else>付款完成后刷新权益，最终结果以支付平台异步通知为准。</p>
            </div>
            <div v-if="activePayment?.type === 'wechat_native'" class="codeUrlBox">
              {{ activePayment.codeUrl }}
            </div>
            <div class="paymentActions">
              <button v-if="activePayment?.type === 'wechat_native'" type="button" class="secondaryPill" @click="copyPaymentCode">复制 code_url</button>
              <button type="button" class="primaryPill" @click="refreshAfterPayment">已完成支付，刷新权益</button>
            </div>
          </section>
        </div>
      </transition>

      <transition name="modal-fade">
        <div v-if="subscriptionManageOpen" class="membershipModalOverlay" @click.self="subscriptionManageOpen = false">
          <section class="compactModal" role="dialog" aria-modal="true" aria-labelledby="manage-title">
            <button type="button" class="modalClose" aria-label="关闭" @click="subscriptionManageOpen = false">
              <i-close theme="outline" size="20" />
            </button>
            <h2 id="manage-title">订阅管理</h2>
            <div class="summaryCard">
              <span>当前会员</span>
              <strong>{{ levelName }}</strong>
              <p>{{ membershipExpireLabel }} 到期 · 自动续费未开启</p>
            </div>
            <button type="button" class="primaryPill" @click="openSubscribe('yearly')">升级订阅</button>
          </section>
        </div>
      </transition>

      <transition name="modal-fade">
        <div v-if="orderRecordsOpen" class="membershipModalOverlay" @click.self="orderRecordsOpen = false">
          <section class="compactModal" role="dialog" aria-modal="true" aria-labelledby="orders-title">
            <button type="button" class="modalClose" aria-label="关闭" @click="orderRecordsOpen = false">
              <i-close theme="outline" size="20" />
            </button>
            <h2 id="orders-title">订单记录</h2>
            <div class="orderList">
              <div v-if="orders.length === 0" class="emptyState">暂无订单记录</div>
              <div v-for="order in orders" v-else :key="order.id" class="orderItem">
                <div>
                  <strong>{{ order.name }}</strong>
                  <span>{{ formatDateTime(order.createdAt) }}</span>
                </div>
                <b>{{ order.status }}</b>
              </div>
            </div>
          </section>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import axios from "#/utils/axios";

type PointTab = "all" | "consume" | "purchase" | "earn";
type SubscribeTab = "monthly" | "yearly" | "points";

interface UserInfo {
  avatar?: string;
  realName?: string;
  userId?: string;
  username?: string;
}

interface PointSummary {
  remaining: number;
  frozen: number;
  spent: number;
  membership: number;
  recharge: number;
  bonus: number;
}

interface PointTransaction {
  id: string;
  type: string;
  category: PointTab;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

interface Plan {
  key: string;
  billingPeriod: string;
  name: string;
  badge: string;
  price: string;
  priceCny: number;
  period: string;
  desc: string;
  features: string[];
  popular?: boolean;
}

interface PointPackage {
  key: string;
  points: number;
  price: string;
  priceCny: number;
  desc: string;
}

interface OrderRecord {
  id: string;
  name: string;
  createdAt: string;
  status: string;
}

interface PaymentOption {
  label: string;
  value: "alipay" | "wechat";
}

interface PaymentResult {
  codeUrl?: string;
  formHtml?: string;
  h5Url?: string;
  orderNo: string;
  provider: string;
  type: "alipay_form" | "none" | "wechat_h5" | "wechat_native";
}

interface MembershipInfo {
  autoRenew: boolean;
  expiresAt: string | null;
  levelKey: string;
  levelName: string;
  planKey: string;
  status: string;
}

interface MembershipProfile {
  membership?: MembershipInfo;
  orders?: Array<{
    amountCny: number;
    createdAt: string;
    id: string;
    kind: "plan" | "points";
    paidAt?: string | null;
    planKey?: string | null;
    points?: number;
    pointsPackageKey?: string | null;
    status: string;
  }>;
  plans?: {
    monthly?: any[];
    yearly?: any[];
  };
  pointPackages?: Array<{
    description?: string;
    key: string;
    points: number;
    priceCny: number;
  }>;
  pointSummary?: PointSummary;
  transactions?: PointTransaction[];
}

const router = useRouter();
const rootRef = ref<HTMLElement | null>(null);
const userInfo = ref<UserInfo | null>(null);
const userMenuOpen = ref(false);
const pointsOpen = ref(false);
const subscribeOpen = ref(false);
const subscriptionManageOpen = ref(false);
const orderRecordsOpen = ref(false);
const paymentOpen = ref(false);
const activePointTab = ref<PointTab>("all");
const activeSubscribeTab = ref<SubscribeTab>("yearly");
const selectedPaymentProvider = ref<"" | "alipay" | "wechat">("");
const paymentOptions = ref<PaymentOption[]>([]);
const activePayment = ref<PaymentResult | null>(null);
const ordering = ref(false);
const orders = ref<OrderRecord[]>([]);
const membershipInfo = ref<MembershipInfo>({
  autoRenew: false,
  expiresAt: null,
  levelKey: "free",
  levelName: "免费会员",
  planKey: "free",
  status: "active",
});

const pointSummary = ref<PointSummary>({
  remaining: 50,
  frozen: 0,
  spent: 0,
  membership: 0,
  recharge: 0,
  bonus: 50,
});

const pointTabs: Array<{ id: PointTab; label: string }> = [
  { id: "all", label: "全部" },
  { id: "consume", label: "消耗" },
  { id: "purchase", label: "购买" },
  { id: "earn", label: "获得" },
];

const subscribeTabs: Array<{ id: SubscribeTab; label: string }> = [
  { id: "monthly", label: "连续包月" },
  { id: "yearly", label: "连续包年" },
  { id: "points", label: "购买积分" },
];

const fallbackMonthlyPlans: Plan[] = [
  {
    key: "starter-monthly",
    billingPeriod: "monthly",
    name: "创作会员",
    badge: "基础权益",
    price: "¥29",
    priceCny: 29,
    period: "/月",
    desc: "适合轻量创作与素材整理。",
    features: ["每月 300 积分", "基础队列优先级", "项目资产云端归档"],
  },
  {
    key: "pro-monthly",
    billingPeriod: "monthly",
    name: "专业会员",
    badge: "推荐",
    price: "¥69",
    priceCny: 69,
    period: "/月",
    desc: "覆盖分镜、视频与批量生成工作流。",
    features: ["每月 900 积分", "高峰队列优先级", "批量创作额度提升"],
    popular: true,
  },
];

const fallbackYearlyPlans: Plan[] = [
  {
    key: "starter-yearly",
    billingPeriod: "yearly",
    name: "创作年卡",
    badge: "年付优惠",
    price: "¥288",
    priceCny: 288,
    period: "/年",
    desc: "稳定创作账号的年度基础权益。",
    features: ["每年 4200 积分", "含 2 个月折扣", "长期项目资产归档"],
  },
  {
    key: "pro-yearly",
    billingPeriod: "yearly",
    name: "专业年卡",
    badge: "推荐",
    price: "¥688",
    priceCny: 688,
    period: "/年",
    desc: "面向连续短剧生产的完整权益。",
    features: ["每年 12000 积分", "高峰队列优先级", "批量任务额度提升"],
    popular: true,
  },
];

const fallbackPointPackages: PointPackage[] = [
  { key: "points-100", points: 100, price: "¥9.9", priceCny: 9.9, desc: "补充少量图片或分镜任务" },
  { key: "points-600", points: 600, price: "¥49", priceCny: 49, desc: "适合集中生成一个短篇项目" },
  { key: "points-1500", points: 1500, price: "¥99", priceCny: 99, desc: "适合多集短剧批量生产" },
];
const monthlyPlans = ref<Plan[]>(fallbackMonthlyPlans);
const yearlyPlans = ref<Plan[]>(fallbackYearlyPlans);
const pointPackages = ref<PointPackage[]>(fallbackPointPackages);

const transactions = ref<PointTransaction[]>([
  {
    id: "welcome-bonus",
    type: "earn",
    category: "earn",
    amount: 50,
    balanceAfter: 50,
    description: "新人赠送积分 +50",
    createdAt: "2026-05-22T22:43:29+08:00",
  },
]);

const visibleTransactions = computed(() => {
  if (activePointTab.value === "all") return transactions.value;
  return transactions.value.filter((item) => item.category === activePointTab.value);
});

const visiblePlans = computed(() => (activeSubscribeTab.value === "monthly" ? monthlyPlans.value : yearlyPlans.value));
const levelName = computed(() => membershipInfo.value.levelName || "免费会员");
const selectedPaymentProviderLabel = computed(
  () => paymentOptions.value.find((item) => item.value === selectedPaymentProvider.value)?.label || "暂未配置",
);
const activePaymentLabel = computed(() => {
  if (activePayment.value?.provider === "wechat") return "微信支付";
  if (activePayment.value?.provider === "alipay") return "支付宝";
  return "支付平台";
});
const levelBadgeText = computed(() => {
  const fullName = levelName.value.trim();
  const compactName = fullName.replace(/会员|年卡|月卡|套餐/g, "").trim();
  const displayName = compactName || fullName;
  return displayName.length > 4 ? `${displayName.slice(0, 4)}…` : displayName;
});
const membershipExpireLabel = computed(() => {
  if (!membershipInfo.value.expiresAt) return "长期有效";
  return new Date(membershipInfo.value.expiresAt).toLocaleDateString("zh-CN");
});

const displayName = computed(() => {
  const name = userInfo.value?.realName || userInfo.value?.username;
  return name?.trim() || "用户";
});

const userAvatar = computed(() => {
  const avatar = userInfo.value?.avatar?.trim();
  return avatar || "";
});

async function loadUserInfo() {
  try {
    const res = await axios.get("/user/info");
    userInfo.value = res.data as UserInfo;
  } catch {
    userInfo.value = {
      userId: localStorage.getItem("userId") || "",
      username: "用户",
    };
  }
}

function formatPrice(value: number) {
  if (!value) return "免费";
  return `¥${Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}`;
}

function paymentMethodDescription(value: PaymentOption["value"]) {
  return value === "wechat" ? "微信收银台" : "支付宝收银台";
}

function toPlanCard(plan: any): Plan {
  const priceCny = Number(plan.priceCny || 0);
  const billingPeriod = String(plan.billingPeriod || "");
  const period = billingPeriod === "monthly" ? "/月" : billingPeriod === "yearly" ? "/年" : "";
  const features = Array.isArray(plan.features) && plan.features.length ? plan.features : [`赠送 ${formatInteger(plan.points || 0)} 积分`];
  return {
    key: String(plan.key || ""),
    billingPeriod,
    name: String(plan.name || plan.levelName || "会员套餐"),
    badge: plan.popular ? "推荐" : plan.yearlyDiscountLabel || (billingPeriod === "yearly" ? "年付优惠" : "基础权益"),
    price: formatPrice(priceCny),
    priceCny,
    period,
    desc: features[0] || "会员权益套餐",
    features,
    popular: Boolean(plan.popular),
  };
}

function applyMembershipProfile(profile: MembershipProfile) {
  if (profile.membership) membershipInfo.value = profile.membership;
  if (profile.pointSummary) pointSummary.value = profile.pointSummary;
  if (Array.isArray(profile.transactions)) transactions.value = profile.transactions;
  if (Array.isArray(profile.orders)) {
    orders.value = profile.orders.map((order) => ({
      id: order.id,
      name:
        order.kind === "plan"
          ? `会员订阅 ${order.planKey || ""}`.trim()
          : `积分包 ${formatInteger(order.points || 0)} 积分`,
      createdAt: order.createdAt,
      status: order.status === "paid" ? "已支付" : order.status === "pending" ? "待支付" : order.status,
    }));
  }
  if (profile.plans?.monthly?.length) monthlyPlans.value = profile.plans.monthly.filter((plan) => plan.billingPeriod !== "free").map(toPlanCard);
  if (profile.plans?.yearly?.length) yearlyPlans.value = profile.plans.yearly.filter((plan) => plan.billingPeriod !== "free").map(toPlanCard);
  if (profile.pointPackages?.length) {
    pointPackages.value = profile.pointPackages.map((pkg) => ({
      key: pkg.key,
      points: Number(pkg.points || 0),
      price: formatPrice(Number(pkg.priceCny || 0)),
      priceCny: Number(pkg.priceCny || 0),
      desc: pkg.description || "补充创作积分",
    }));
  }
}

async function loadMembershipProfile() {
  try {
    const res = await axios.get("/membership/me");
    applyMembershipProfile(res.data as MembershipProfile);
  } catch (err: any) {
    window.$message?.warning(err?.message || "会员信息加载失败");
  }
}

async function loadPaymentOptions() {
  try {
    const res = await axios.get("/payment/options");
    const providers = Array.isArray(res.data?.providers) ? res.data.providers : [];
    paymentOptions.value = providers;
    selectedPaymentProvider.value = providers.some((item: PaymentOption) => item.value === res.data?.defaultProvider)
      ? res.data.defaultProvider
      : providers[0]?.value || "";
  } catch {
    paymentOptions.value = [];
    selectedPaymentProvider.value = "";
  }
}

function formatInteger(value: number | null | undefined) {
  return Math.round(Number(value || 0)).toLocaleString("zh-CN");
}

function formatCompactPoints(value: number | null | undefined) {
  const numberValue = Math.round(Number(value || 0));
  if (numberValue >= 100_000_000) return `${Number.parseFloat((numberValue / 100_000_000).toFixed(1))}亿`;
  if (numberValue >= 1_000_000) return `${Math.floor(numberValue / 10_000)}万`;
  if (numberValue >= 10_000) return `${Math.floor(numberValue / 1000) / 10}万`;
  return numberValue.toLocaleString("zh-CN");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function openSubscribe(tab: SubscribeTab) {
  pointsOpen.value = false;
  subscriptionManageOpen.value = false;
  activeSubscribeTab.value = tab;
  subscribeOpen.value = true;
}

function openSubscriptionManage() {
  userMenuOpen.value = false;
  subscriptionManageOpen.value = true;
}

function openOrderRecords() {
  userMenuOpen.value = false;
  orderRecordsOpen.value = true;
}

function showRules() {
  window.$message?.info("积分按实际生成任务消耗，赠送积分优先使用。");
}

async function submitPlanOrder(plan: Plan) {
  if (!selectedPaymentProvider.value) {
    window.$message?.warning("请先联系管理员配置支付方式");
    return;
  }
  ordering.value = true;
  try {
    const res = await axios.post("/membership/orders", {
      kind: "plan",
      planKey: plan.key,
      paymentProvider: selectedPaymentProvider.value,
    });
    await handleOrderCreated(res.data);
  } catch (err: any) {
    window.$message?.warning(err?.message || "订单创建失败");
  } finally {
    ordering.value = false;
  }
}

async function submitPointPackageOrder(pkg: PointPackage) {
  if (!selectedPaymentProvider.value) {
    window.$message?.warning("请先联系管理员配置支付方式");
    return;
  }
  ordering.value = true;
  try {
    const res = await axios.post("/membership/orders", {
      kind: "points",
      pointsPackageKey: pkg.key,
      paymentProvider: selectedPaymentProvider.value,
    });
    await handleOrderCreated(res.data);
  } catch (err: any) {
    window.$message?.warning(err?.message || "订单创建失败");
  } finally {
    ordering.value = false;
  }
}

async function handleOrderCreated(payload: any) {
  if (payload?.profile) applyMembershipProfile(payload.profile as MembershipProfile);
  const payment = payload?.payment as PaymentResult | undefined;
  if (!payment || payment.type === "none") {
    window.$message?.success("会员权益已更新");
    subscribeOpen.value = false;
    return;
  }

  activePayment.value = payment;
  subscribeOpen.value = false;
  paymentOpen.value = true;

  if (payment.type === "alipay_form" && payment.formHtml) {
    const payWindow = window.open("", "_blank");
    if (!payWindow) {
      window.$message?.warning("浏览器拦截了支付窗口，请允许弹窗后重试");
      return;
    }
    payWindow.document.open();
    payWindow.document.write(payment.formHtml);
    payWindow.document.close();
    window.$message?.success("已打开支付宝收银台");
  } else if (payment.type === "wechat_h5" && payment.h5Url) {
    window.open(payment.h5Url, "_blank");
    window.$message?.success("已打开微信支付");
  }
}

async function refreshAfterPayment() {
  await loadMembershipProfile();
  paymentOpen.value = false;
}

async function copyPaymentCode() {
  const codeUrl = activePayment.value?.codeUrl || "";
  if (!codeUrl) return;
  try {
    await navigator.clipboard.writeText(codeUrl);
    window.$message?.success("code_url 已复制");
  } catch {
    window.$message?.warning("复制失败");
  }
}

async function copyUid() {
  const uid = userInfo.value?.userId || localStorage.getItem("userId") || "";
  if (!uid) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(uid);
    } else {
      const input = document.createElement("input");
      input.value = uid;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    window.$message?.success("UID 已复制");
  } catch {
    window.$message?.warning("复制失败");
  }
}

async function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("userId");
  userMenuOpen.value = false;
  window.$message?.success("退出登录成功");
  await router.push("/login");
}

function handlePointerDown(event: PointerEvent) {
  const target = event.target;
  if (target instanceof Node && !rootRef.value?.contains(target)) {
    userMenuOpen.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  if (pointsOpen.value) pointsOpen.value = false;
  else if (subscribeOpen.value) subscribeOpen.value = false;
  else if (paymentOpen.value) paymentOpen.value = false;
  else if (subscriptionManageOpen.value) subscriptionManageOpen.value = false;
  else if (orderRecordsOpen.value) orderRecordsOpen.value = false;
  else userMenuOpen.value = false;
}

watch(
  () => pointsOpen.value || subscribeOpen.value || paymentOpen.value || subscriptionManageOpen.value || orderRecordsOpen.value,
  (open, _, onCleanup) => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    onCleanup(() => {
      document.body.style.overflow = previousOverflow;
    });
  },
);

onMounted(() => {
  void loadUserInfo();
  void loadMembershipProfile();
  void loadPaymentOptions();
  document.addEventListener("pointerdown", handlePointerDown);
  document.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", handlePointerDown);
  document.removeEventListener("keydown", handleKeydown);
});

const PointMetric = defineComponent({
  props: {
    label: { type: String, required: true },
    value: { type: Number, required: true },
  },
  setup(props) {
    return () =>
      h("div", { class: "pointMetric" }, [
        h("span", props.label),
        h("strong", formatInteger(props.value)),
      ]);
  },
});
</script>

<style lang="scss" scoped>
.membershipCenter {
  position: relative;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 72px;
}

.pointsCard {
  display: flex;
  width: 72px;
  height: 62px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 4px;
  overflow: hidden;
  border: 1px solid rgba(104, 174, 255, 0.3);
  border-radius: 16px;
  background: rgba(18, 35, 58, 0.76);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(22px) saturate(120%);

  button {
    width: 100%;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    transition:
      background 0.18s ease,
      color 0.18s ease,
      transform 0.18s ease;
  }
}

.pointsButton {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 24px;
  color: #f5fcf9;
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;

  .pointsValue {
    min-width: 0;
    max-width: 40px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  :deep(svg) {
    flex-shrink: 0;
    color: #31d9ff;
  }

  &:hover {
    background: rgba(118, 218, 204, 0.1);
  }
}

.levelButton {
  display: flex;
  height: 22px;
  align-items: center;
  justify-content: center;
  max-width: 58px;
  overflow: hidden;
  padding: 0 2px !important;
  color: #ffd36a;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: keep-all;

  &:hover {
    background: rgba(255, 211, 106, 0.12);
  }
}

.avatarWrap {
  position: relative;
}

.avatarButton {
  display: inline-flex;
  width: 50px;
  height: 50px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(118, 218, 204, 0.26);
  border-radius: 999px;
  background: rgba(14, 25, 23, 0.92);
  color: rgba(245, 252, 249, 0.94);
  cursor: pointer;
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28);
  transition:
    border-color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:hover {
    border-color: rgba(118, 218, 204, 0.48);
    box-shadow: 0 18px 38px rgba(0, 0, 0, 0.34), 0 0 0 1px rgba(98, 216, 202, 0.1);
    transform: scale(1.04);
  }
}

.accountPopover {
  position: absolute;
  bottom: 0;
  left: calc(100% + 30px);
  z-index: 170;
  width: 276px;
  padding: 14px;
  border: 1px solid rgba(118, 218, 204, 0.2);
  border-radius: 20px;
  background: rgba(8, 13, 13, 0.86);
  color: rgba(245, 252, 249, 0.94);
  box-shadow: 0 32px 90px rgba(0, 0, 0, 0.58), 0 0 0 1px rgba(118, 218, 204, 0.14);
  backdrop-filter: blur(22px) saturate(120%);
}

.popoverUser {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px 14px;
}

.miniAvatar {
  display: flex;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(118, 218, 204, 0.2);
  border-radius: 999px;
  background: rgba(82, 215, 255, 0.14);
  color: #41ddc9;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.userNameButton {
  min-width: 0;
  flex: 1;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;

  strong,
  span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 15px;
    font-weight: 900;
    line-height: 1.2;
  }

  span {
    margin-top: 3px;
    color: rgba(219, 238, 232, 0.42);
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }
}

.iconButton {
  display: flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(219, 238, 232, 0.42);
  cursor: pointer;

  &:hover {
    background: rgba(118, 218, 204, 0.1);
    color: #41ddc9;
  }
}

.memberPanel {
  padding: 14px;
  border: 1px solid rgba(118, 218, 204, 0.18);
  border-radius: 18px;
  background: rgba(8, 17, 29, 0.72);
}

.memberLevel,
.pointRow,
.memberActions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.memberLevel {
  gap: 10px;

  > span {
    flex-shrink: 0;
    color: rgba(219, 238, 232, 0.42);
    font-size: 12px;
    font-weight: 700;
  }
}

.memberLevelName {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  color: rgba(245, 252, 249, 0.94);
  font-size: 14px;
  font-weight: 900;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :deep(svg) {
    color: #41ddc9;
  }
}

.pointRows {
  margin-top: 16px;
}

.pointRow {
  color: rgba(219, 238, 232, 0.68);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.15;

  & + .pointRow {
    margin-top: 12px;
  }

  strong {
    color: rgba(245, 252, 249, 0.94);
    font-weight: 900;
  }
}

.memberActions {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(118, 218, 204, 0.14);

  button {
    height: 32px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: rgba(245, 252, 249, 0.9);
    cursor: pointer;
    font-size: 14px;
    font-weight: 900;

    &:hover {
      background: rgba(118, 218, 204, 0.1);
      color: #41ddc9;
    }
  }

  span {
    width: 1px;
    height: 16px;
    align-self: center;
    background: rgba(118, 218, 204, 0.16);
  }
}

.logoutButton {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  padding: 10px 12px;
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: rgba(219, 238, 232, 0.68);
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
  text-align: left;

  &:hover {
    background: rgba(118, 218, 204, 0.1);
    color: rgba(245, 252, 249, 0.94);
  }
}

.membershipModalOverlay {
  position: fixed;
  inset: 0;
  z-index: 180;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(10px) saturate(110%);
}

.pointsModal,
.subscribeModal,
.compactModal {
  position: relative;
  display: flex;
  width: min(800px, calc(100vw - 40px));
  max-height: min(900px, 86vh);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 22px;
  background: #1b1b1d;
  color: #fff;
  box-shadow: 0 28px 76px rgba(0, 0, 0, 0.56);

  h2 {
    margin: 0;
    font-size: 28px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0;
  }
}

.pointsModal {
  height: min(86vh, 900px);
  padding: 34px 40px 32px;
}

.subscribeModal {
  padding: 36px 40px 34px;
}

.compactModal {
  width: min(520px, calc(100vw - 40px));
  padding: 34px;
}

.modalClose {
  position: absolute;
  top: 26px;
  right: 26px;
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.pointFormula {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
  align-items: end;
  gap: 24px;
  margin-top: 54px;
  padding: 0 48px;

  > span {
    padding-bottom: 6px;
    color: rgba(255, 255, 255, 0.32);
    font-size: 22px;
    font-weight: 800;
  }
}

.pointMetric {
  display: flex;
  flex-direction: column;
  gap: 8px;

  span {
    color: rgba(255, 255, 255, 0.42);
    font-size: 14px;
    font-weight: 800;
  }

  strong {
    color: #fff;
    font-size: 30px;
    font-weight: 900;
    line-height: 1;
  }
}

.segmentedTabs {
  display: flex;
  margin-top: 42px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);

  button {
    height: 40px;
    flex: 1;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: rgba(255, 255, 255, 0.38);
    cursor: pointer;
    font-size: 14px;
    font-weight: 900;
    transition:
      background 0.18s ease,
      color 0.18s ease;

    &:hover {
      color: #fff;
    }

    &.active {
      background: #fff;
      color: #151515;
    }
  }
}

.transactionBox {
  min-height: 0;
  flex: 1;
  margin-top: 14px;
  overflow: hidden;
  border-radius: 16px;
  background: #252527;
}

.transactionList {
  height: 100%;
  overflow-y: auto;
  padding: 16px 24px;
}

.transactionItem,
.orderItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;

  & + .transactionItem,
  & + .orderItem {
    border-top: 1px dashed rgba(255, 255, 255, 0.1);
  }

  strong,
  span {
    display: block;
  }

  strong {
    color: #fff;
    font-size: 14px;
    font-weight: 900;
  }

  span {
    margin-top: 6px;
    color: rgba(255, 255, 255, 0.36);
    font-size: 12px;
    font-weight: 700;
  }

  b {
    flex-shrink: 0;
    color: #2ef4eb;
    font-size: 20px;
    font-weight: 900;

    &.consume {
      color: rgba(255, 255, 255, 0.85);
    }
  }
}

.emptyState {
  display: flex;
  height: 100%;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.35);
  font-size: 15px;
  font-weight: 800;
}

.modalFooter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 22px;
  color: rgba(255, 255, 255, 0.42);
  font-size: 14px;
  font-weight: 700;

  > div {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
  }

  button:not(.primaryPill) {
    border: 0;
    background: transparent;
    color: #20f2df;
    cursor: pointer;
    font: inherit;
    white-space: nowrap;
  }
}

.primaryPill {
  flex-shrink: 0;
  border: 0;
  border-radius: 999px;
  background: #fff;
  color: #151515;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
  padding: 10px 24px;
  transition: transform 0.18s ease;

  &:hover {
    transform: scale(1.02);
  }
}

.subscribeTabs {
  margin-top: 30px;
}

.paymentMethodPanel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.58);
  font-size: 13px;
  font-weight: 800;

  &.empty {
    border-style: dashed;
  }
}

.paymentMethodHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  span {
    color: rgba(255, 255, 255, 0.52);
  }

  strong {
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
  }
}

.paymentMethodGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.paymentMethodButton {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  background: #242426;
  color: #fff;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;

  &:hover,
  &.active {
    border-color: rgba(46, 244, 235, 0.46);
    background: rgba(46, 244, 235, 0.08);
  }

  &:hover {
    transform: translateY(-1px);
  }
}

.paymentIcon,
.paymentStateIcon {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: #fff;
  font-size: 16px;
  font-weight: 900;

  &.alipay {
    background: #1677ff;
  }

  &.wechat {
    background: #07c160;
  }
}

.paymentMethodText {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: #fff;
    font-size: 14px;
    font-weight: 900;
  }

  small {
    color: rgba(255, 255, 255, 0.45);
    font-size: 12px;
    font-weight: 800;
  }
}

.paymentUnavailable {
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.52);
  text-align: center;
}

.planGrid,
.packageGrid {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}

.planGrid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.packageGrid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.planCard,
.packageCard,
.summaryCard {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  background: #252527;
}

.planCard {
  padding: 20px;

  &.popular {
    border-color: rgba(46, 244, 235, 0.42);
    box-shadow: inset 0 0 0 1px rgba(46, 244, 235, 0.12);
  }

  p,
  li {
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.7;
  }

  ul {
    margin: 16px 0 0;
    padding-left: 18px;
  }

  button {
    width: 100%;
    height: 42px;
    margin-top: 18px;
    border: 0;
    border-radius: 14px;
    background: #fff;
    color: #151515;
    cursor: pointer;
    font-size: 14px;
    font-weight: 900;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.48;
    }
  }
}

.planHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  span {
    padding: 5px 9px;
    border-radius: 999px;
    background: rgba(46, 244, 235, 0.12);
    color: #2ef4eb;
    font-size: 12px;
    font-weight: 900;
  }

  strong {
    color: #fff;
    font-size: 18px;
    font-weight: 900;
  }
}

.planPrice {
  margin-top: 20px;

  b {
    color: #fff;
    font-size: 34px;
    font-weight: 900;
  }

  span {
    margin-left: 4px;
    color: rgba(255, 255, 255, 0.45);
    font-weight: 800;
  }
}

.packageCard {
  padding: 22px 18px;
  text-align: center;

  strong,
  span,
  p {
    display: block;
  }

  strong {
    color: #2ef4eb;
    font-size: 30px;
    font-weight: 900;
    line-height: 1;
  }

  span {
    margin-top: 5px;
    color: #fff;
    font-size: 14px;
    font-weight: 900;
  }

  p {
    min-height: 44px;
    margin: 14px 0 18px;
    color: rgba(255, 255, 255, 0.48);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.65;
  }

  button {
    width: 100%;
    height: 38px;
    border: 0;
    border-radius: 999px;
    background: #fff;
    color: #151515;
    cursor: pointer;
    font-size: 14px;
    font-weight: 900;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.48;
    }
  }
}

.paymentResultModal {
  gap: 18px;

  .summaryCard {
    margin: 0;
  }

  .summaryCard strong {
    font-size: 16px;
    word-break: break-all;
  }
}

.paymentResultHeader {
  display: flex;
  align-items: center;
  gap: 12px;

  h2 {
    font-size: 24px;
  }

  p {
    margin: 7px 0 0;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    font-weight: 800;
  }
}

.codeUrlBox {
  max-height: 96px;
  overflow: auto;
  padding: 12px;
  border: 1px solid rgba(46, 244, 235, 0.18);
  border-radius: 12px;
  background: rgba(46, 244, 235, 0.08);
  color: rgba(255, 255, 255, 0.78);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
}

.paymentActions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 18px;
  flex-wrap: wrap;
}

.secondaryPill {
  flex-shrink: 0;
  padding: 10px 18px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background: transparent;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
}

.summaryCard {
  margin: 26px 0 22px;
  padding: 22px;

  span,
  strong,
  p {
    display: block;
  }

  span {
    color: rgba(255, 255, 255, 0.48);
    font-size: 13px;
    font-weight: 800;
  }

  strong {
    margin-top: 8px;
    color: #fff;
    font-size: 28px;
    font-weight: 900;
  }

  p {
    margin: 10px 0 0;
    color: rgba(255, 255, 255, 0.46);
    font-size: 14px;
    font-weight: 700;
  }
}

.orderList {
  margin-top: 24px;
  overflow: hidden;
  border-radius: 16px;
  background: #252527;
  padding: 4px 20px;
}

.orderItem b {
  color: #ffd36a;
  font-size: 14px;
}

.member-pop-enter-active,
.member-pop-leave-active,
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.member-pop-enter-from,
.member-pop-leave-to {
  opacity: 0;
  transform: translateX(-6px) scale(0.98);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .pointsModal,
  .subscribeModal,
  .compactModal {
    width: calc(100vw - 24px);
    max-height: calc(100vh - 24px);
    padding: 28px 20px 22px;
  }

  .pointFormula,
  .planGrid,
  .packageGrid,
  .paymentMethodGrid {
    grid-template-columns: 1fr;
  }

  .pointFormula {
    align-items: start;
    gap: 12px;
    margin-top: 30px;
    padding: 0;

    > span {
      display: none;
    }
  }

  .modalFooter {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
