<template>
  <Page auto-content-height title="管理员账号">
    <template #description>
      <div class="mt-2 text-foreground/70">
        管理 Admin 后台登录账号。会员账号仍从 Web 端注册。
      </div>
    </template>
    <template #extra>
      <t-button variant="outline" :loading="loading" @click="loadAccounts">
        <template #icon><t-icon name="refresh" /></template>
        刷新
      </t-button>
    </template>

    <div class="adminAccounts">
      <t-card title="新增管理员" :bordered="false">
        <t-form :data="formData" label-align="top" class="accountForm">
          <div class="fieldGrid">
            <t-form-item label="用户名">
              <t-input v-model="formData.username" placeholder="2-20 个字符" clearable />
            </t-form-item>
            <t-form-item label="显示名称">
              <t-input v-model="formData.realName" placeholder="默认同用户名" clearable />
            </t-form-item>
            <t-form-item label="初始密码">
              <t-input
                v-model="formData.password"
                type="password"
                placeholder="6-20 个字符"
                clearable />
            </t-form-item>
          </div>
          <div class="actionRow">
            <t-button theme="primary" :loading="saving" @click="createAccount">
              <template #icon><t-icon name="user-add" /></template>
              创建管理员
            </t-button>
          </div>
        </t-form>
      </t-card>

      <t-card title="管理员列表" :bordered="false">
        <t-table
          row-key="id"
          :columns="columns"
          :data="accounts"
          :loading="loading"
          hover
          table-layout="fixed">
          <template #name="{ row }">
            <div class="accountCell">
              <t-avatar size="32px" :image="row.avatar || undefined">
                {{ row.name.slice(0, 1) }}
              </t-avatar>
              <div class="accountText">
                <div class="accountName">{{ row.name }}</div>
                <div class="accountMeta">ID {{ row.id }}</div>
              </div>
            </div>
          </template>
          <template #role>
            <t-tag theme="primary" variant="light">Admin</t-tag>
          </template>
        </t-table>
      </t-card>
    </div>
  </Page>
</template>

<script setup lang="ts">
import { Page } from '@super/common-ui';
import { MessagePlugin } from 'tdesign-vue-next';
import { onMounted, reactive, ref } from 'vue';

import { requestClient } from '#/api/request';

interface AdminAccount {
  avatar: string;
  id: string;
  name: string;
  realName: string;
  role: 'admin';
}

const loading = ref(false);
const saving = ref(false);
const accounts = ref<AdminAccount[]>([]);
const formData = reactive({
  password: '',
  realName: '',
  username: '',
});

const columns = [
  { colKey: 'name', title: '账号', width: 260 },
  { colKey: 'realName', ellipsis: true, title: '显示名称' },
  { align: 'center', colKey: 'role', title: '角色', width: 120 },
];

async function loadAccounts() {
  loading.value = true;
  try {
    accounts.value = await requestClient.get<AdminAccount[]>('/admin/users');
  } finally {
    loading.value = false;
  }
}

async function createAccount() {
  const username = formData.username.trim();
  const realName = formData.realName.trim();
  const password = formData.password;

  if (!username) {
    MessagePlugin.warning('请输入用户名');
    return;
  }
  if (!password) {
    MessagePlugin.warning('请输入初始密码');
    return;
  }

  saving.value = true;
  try {
    await requestClient.post('/admin/users', { password, realName, username });
    MessagePlugin.success('管理员账号已创建');
    formData.username = '';
    formData.realName = '';
    formData.password = '';
    await loadAccounts();
  } finally {
    saving.value = false;
  }
}

onMounted(loadAccounts);
</script>

<style scoped>
.adminAccounts {
  display: grid;
  gap: 16px;
}

.accountForm {
  max-width: 900px;
}

.fieldGrid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.actionRow {
  display: flex;
  justify-content: flex-end;
}

.accountCell {
  align-items: center;
  display: flex;
  gap: 10px;
  min-width: 0;
}

.accountText {
  min-width: 0;
}

.accountName,
.accountMeta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.accountName {
  font-weight: 600;
}

.accountMeta {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

@media (max-width: 900px) {
  .fieldGrid {
    grid-template-columns: 1fr;
  }
}
</style>
