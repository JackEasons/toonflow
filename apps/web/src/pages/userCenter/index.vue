<template>
  <div class="userCenterPage">
    <header class="pageHeader">
      <div>
        <span>Account Center</span>
        <h1>用户中心</h1>
      </div>
      <t-button variant="outline" @click="router.push('/project')">
        返回项目
      </t-button>
    </header>

    <section class="profilePanel">
      <div class="profileAvatar">
        <img v-if="userInfo.avatar" :src="userInfo.avatar" :alt="displayName" />
        <i-user v-else theme="outline" size="36" />
      </div>
      <div class="profileMeta">
        <h2>{{ displayName }}</h2>
        <p>{{ userInfo.introduction || '短剧创作会员' }}</p>
      </div>
      <div class="profileStats">
        <div>
          <span>UID</span>
          <strong>{{ userInfo.userId || '-' }}</strong>
        </div>
        <div>
          <span>账号</span>
          <strong>{{ userInfo.username || '-' }}</strong>
        </div>
        <div>
          <span>角色</span>
          <strong>{{ inviteProfile.isAdmin ? 'Admin' : '会员' }}</strong>
        </div>
      </div>
    </section>

    <section class="invitePanel">
      <div class="sectionHead">
        <div>
          <span>Invite Program</span>
          <h2>邀请码</h2>
        </div>
        <t-tag :theme="statusTheme" variant="light">{{ statusLabel }}</t-tag>
      </div>

      <div v-if="loading" class="emptyState">加载中...</div>
      <div v-else-if="inviteProfile.isAdmin" class="emptyState">admin 账号不参与邀请码申请和生成。</div>
      <div v-else class="inviteBody">
        <div v-if="!inviteProfile.invite || inviteProfile.invite.status === 'rejected'" class="requestBox">
          <p v-if="inviteProfile.invite?.reviewNote" class="reviewNote">管理员备注：{{ inviteProfile.invite.reviewNote }}</p>
          <t-textarea
            v-model="requestReason"
            :autosize="{ minRows: 3, maxRows: 5 }"
            :maxlength="500"
            placeholder="可填写申请说明，便于管理员审核" />
          <t-button theme="primary" :loading="applying" @click="requestInvite">
            申请邀请码
          </t-button>
        </div>

        <div v-else-if="inviteProfile.invite.status === 'pending'" class="emptyState">
          申请已提交，等待管理员审核。
        </div>

        <div v-else-if="inviteProfile.invite.status === 'disabled'" class="emptyState">
          邀请码已被管理员停用，暂时不能继续用于注册。
          <p v-if="inviteProfile.invite.reviewNote" class="reviewNote">管理员备注：{{ inviteProfile.invite.reviewNote }}</p>
        </div>

        <div v-else-if="inviteProfile.invite.status === 'approved' && !inviteProfile.invite.code" class="requestBox">
          <p>申请已通过，可以生成专属邀请链接。每个用户只能生成一个邀请码。</p>
          <t-button theme="primary" :loading="generating" @click="generateInvite">
            生成专属邀请链接
          </t-button>
        </div>

        <div v-else class="inviteReady">
          <div class="inviteCodeBox">
            <div>
              <span>专属邀请码</span>
              <strong>{{ inviteProfile.invite?.code }}</strong>
            </div>
            <t-button size="small" variant="outline" @click="copyInviteCode">复制邀请码</t-button>
          </div>
          <span class="linkLabel">专属邀请链接</span>
          <div class="inviteLinkBox">
            <span :title="inviteLink">{{ inviteLink }}</span>
            <t-button size="small" theme="primary" @click="copyInviteLink">复制链接</t-button>
          </div>
          <div class="ruleGrid">
            <div>
              <span>总上限</span>
              <strong>{{ inviteProfile.invite?.maxUses }}</strong>
            </div>
            <div>
              <span>今日上限</span>
              <strong>{{ inviteProfile.invite?.dailyLimit }}</strong>
            </div>
            <div>
              <span>同 IP 今日上限</span>
              <strong>{{ inviteProfile.invite?.ipDailyLimit }}</strong>
            </div>
            <div>
              <span>已注册</span>
              <strong>{{ inviteProfile.invite?.useCount }}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="inviteesPanel">
      <div class="sectionHead">
        <div>
          <span>Registered By Invite</span>
          <h2>邀请注册账号</h2>
        </div>
        <t-button variant="outline" :loading="loading" @click="loadData">刷新</t-button>
      </div>
      <div v-if="inviteProfile.invitedUsers.length === 0" class="emptyState">暂无通过您的邀请码注册的账号。</div>
      <div v-else class="inviteeList">
        <div v-for="item in inviteProfile.invitedUsers" :key="item.id" class="inviteeItem">
          <t-avatar size="36px" :image="item.avatar || undefined">{{ item.name.slice(0, 1) }}</t-avatar>
          <div>
            <strong>{{ item.realName || item.name }}</strong>
            <span>ID {{ item.id }} · {{ item.name }} · {{ formatDate(item.registeredAt) }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import axios from "#/utils/axios";

interface InviteInfo {
  code: string;
  dailyLimit: number;
  disabled: boolean;
  id: string;
  invitePath: string;
  ipDailyLimit: number;
  maxUses: number;
  reviewNote: string;
  status: "approved" | "disabled" | "pending" | "rejected";
  useCount: number;
}

interface InviteProfile {
  canRequest: boolean;
  invite: InviteInfo | null;
  invitedUsers: Array<{
    avatar: string;
    id: string;
    name: string;
    registeredAt?: string | null;
    realName: string;
  }>;
  isAdmin: boolean;
}

interface UserInfo {
  avatar?: string;
  introduction?: string;
  realName?: string;
  userId?: string;
  username?: string;
}

const router = useRouter();
const loading = ref(false);
const applying = ref(false);
const generating = ref(false);
const requestReason = ref("");
const userInfo = ref<UserInfo>({});
const inviteProfile = ref<InviteProfile>({
  canRequest: false,
  invite: null,
  invitedUsers: [],
  isAdmin: false,
});

const displayName = computed(() => userInfo.value.realName || userInfo.value.username || "用户");
const inviteLink = computed(() => {
  const path = inviteProfile.value.invite?.invitePath;
  if (!path) return "";
  return `${window.location.origin}${path}`;
});
const statusLabel = computed(() => {
  if (inviteProfile.value.isAdmin) return "不可申请";
  const status = inviteProfile.value.invite?.status;
  if (!status) return "未申请";
  if (status === "pending") return "待审核";
  if (status === "approved" && inviteProfile.value.invite?.code) return "已生成";
  if (status === "approved") return "已通过";
  if (status === "disabled") return "已停用";
  return "已拒绝";
});
const statusTheme = computed(() => {
  const status = inviteProfile.value.invite?.status;
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected" || status === "disabled") return "danger";
  return "default";
});

async function loadData() {
  loading.value = true;
  try {
    const [userRes, inviteRes] = await Promise.all([axios.get("/user/info"), axios.get("/invite/my")]);
    userInfo.value = userRes.data || {};
    inviteProfile.value = inviteRes.data || inviteProfile.value;
  } finally {
    loading.value = false;
  }
}

async function requestInvite() {
  applying.value = true;
  try {
    await axios.post("/invite/request", { reason: requestReason.value.trim() });
    window.$message?.success("邀请码申请已提交");
    await loadData();
  } catch (err: any) {
    window.$message?.warning(err?.message || "申请失败");
  } finally {
    applying.value = false;
  }
}

async function generateInvite() {
  generating.value = true;
  try {
    await axios.post("/invite/generate");
    window.$message?.success("专属邀请链接已生成");
    await loadData();
  } catch (err: any) {
    window.$message?.warning(err?.message || "生成失败");
  } finally {
    generating.value = false;
  }
}

async function copyInviteLink() {
  if (!inviteLink.value) return;
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    window.$message?.success("邀请链接已复制");
  } catch {
    window.$message?.warning("复制失败");
  }
}

async function copyInviteCode() {
  const code = inviteProfile.value.invite?.code;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    window.$message?.success("邀请码已复制");
  } catch {
    window.$message?.warning("复制失败");
  }
}

function formatDate(value?: null | string) {
  if (!value) return "注册时间未知";
  return new Date(value).toLocaleString("zh-CN");
}

onMounted(() => {
  void loadData();
});
</script>

<style scoped lang="scss">
.userCenterPage {
  min-height: 100%;
  padding: 38px 42px;
  color: var(--td-text-color-primary);
}

.pageHeader,
.sectionHead,
.profilePanel,
.profileStats,
.inviteLinkBox,
.ruleGrid,
.inviteeItem {
  display: flex;
  align-items: center;
}

.pageHeader,
.sectionHead {
  justify-content: space-between;
  gap: 20px;

  span {
    color: var(--td-text-color-secondary);
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
  }

  h1,
  h2 {
    margin: 6px 0 0;
    letter-spacing: 0;
  }
}

.pageHeader h1 {
  font-size: 34px;
}

.sectionHead h2 {
  font-size: 22px;
}

.profilePanel,
.invitePanel,
.inviteesPanel {
  margin-top: 24px;
  border: 1px solid rgba(118, 218, 204, 0.16);
  border-radius: 8px;
  background: rgba(8, 16, 17, 0.72);
  box-shadow: 0 20px 54px rgba(0, 0, 0, 0.28);
}

.profilePanel {
  gap: 18px;
  padding: 22px;
}

.profileAvatar {
  display: flex;
  width: 68px;
  height: 68px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(118, 218, 204, 0.26);
  border-radius: 999px;
  background: rgba(82, 215, 255, 0.12);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.profileMeta {
  min-width: 0;
  flex: 1;

  h2 {
    margin: 0;
    font-size: 24px;
  }

  p {
    margin: 6px 0 0;
    color: var(--td-text-color-secondary);
  }
}

.profileStats {
  gap: 12px;

  div {
    min-width: 120px;
    padding: 12px 14px;
    border: 1px solid rgba(118, 218, 204, 0.14);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.035);
  }

  span,
  strong {
    display: block;
  }

  span {
    color: var(--td-text-color-secondary);
    font-size: 12px;
  }

  strong {
    margin-top: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.invitePanel,
.inviteesPanel {
  padding: 22px;
}

.inviteBody,
.requestBox,
.inviteReady {
  margin-top: 18px;
}

.requestBox {
  display: grid;
  gap: 14px;
  max-width: 720px;
}

.reviewNote {
  margin: 0;
  color: #ffb56b;
}

.inviteCodeBox {
  display: inline-flex;
  align-items: center;
  gap: 18px;
  padding: 12px 16px;
  border: 1px solid rgba(118, 218, 204, 0.2);
  border-radius: 8px;
  background: rgba(8, 17, 29, 0.72);

  span {
    color: var(--td-text-color-secondary);
  }

  strong {
    display: block;
    margin-top: 4px;
    font-size: 24px;
    letter-spacing: 0;
  }
}

.linkLabel {
  display: block;
  margin-top: 14px;
  color: var(--td-text-color-secondary);
  font-size: 12px;
  font-weight: 800;
}

.inviteLinkBox {
  max-width: 860px;
  justify-content: space-between;
  gap: 14px;
  margin-top: 14px;
  padding: 12px;
  border: 1px solid rgba(118, 218, 204, 0.16);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.035);

  span {
    min-width: 0;
    overflow: hidden;
    color: var(--td-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.ruleGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  max-width: 860px;
  margin-top: 14px;

  div {
    padding: 14px;
    border: 1px solid rgba(118, 218, 204, 0.14);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.035);
  }

  span,
  strong {
    display: block;
  }

  span {
    color: var(--td-text-color-secondary);
    font-size: 12px;
  }

  strong {
    margin-top: 6px;
    font-size: 20px;
  }
}

.emptyState {
  margin-top: 18px;
  padding: 18px;
  border: 1px dashed rgba(118, 218, 204, 0.2);
  border-radius: 8px;
  color: var(--td-text-color-secondary);
}

.inviteeList {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.inviteeItem {
  gap: 12px;
  padding: 12px;
  border: 1px solid rgba(118, 218, 204, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.035);

  strong,
  span {
    display: block;
  }

  span {
    margin-top: 3px;
    color: var(--td-text-color-secondary);
    font-size: 12px;
  }
}

@media (max-width: 900px) {
  .userCenterPage {
    padding: 24px 18px;
  }

  .profilePanel,
  .profileStats {
    align-items: stretch;
    flex-direction: column;
  }

  .profileStats div {
    min-width: 0;
  }

  .ruleGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .inviteLinkBox {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
