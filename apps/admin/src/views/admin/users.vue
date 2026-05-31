<script setup lang="ts">
import type { SuperFormProps } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, ref } from 'vue';

import { Page } from '@super/common-ui';

import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next';

import { requestClient } from '#/api/request';
import { useSuperVxeGrid } from '#/adapter/vxe-table';

interface AdminAccount {
  avatar: string;
  id: string;
  isCurrent: boolean;
  name: string;
  realName: string;
  role: 'admin';
}

const accounts = ref<AdminAccount[]>([]);
const dialogVisible = ref(false);
const editingId = ref('');
const saving = ref(false);
const formData = ref({
  password: '',
  realName: '',
  username: '',
});

const metrics = computed(() => [
  {
    desc: '不包含内置 admin',
    label: '可管理账号',
    value: String(accounts.value.length),
  },
  {
    desc: '不参与增删改',
    label: '保护账号',
    value: 'admin',
  },
  {
    desc: '禁止操作保护账号',
    label: '安全策略',
    value: '启用',
  },
]);

const formOptions: SuperFormProps = {
  collapsed: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        clearable: true,
        placeholder: '搜索用户名、显示名称或 ID',
      },
      fieldName: 'keyword',
      label: '关键词',
    },
  ],
  showCollapseButton: false,
  submitOnEnter: true,
};

const gridOptions: VxeTableGridOptions<AdminAccount> = {
  columns: [
    { title: '序号', type: 'seq', width: 64 },
    { align: 'left', field: 'name', slots: { default: 'name' }, title: '账号', minWidth: 260 },
    { align: 'left', field: 'realName', slots: { default: 'realName' }, title: '显示名称', minWidth: 180 },
    { field: 'role', slots: { default: 'role' }, title: '角色', width: 120 },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: '操作',
      width: 180,
    },
  ],
  keepSource: true,
  maxHeight: 680,
  pagerConfig: {
    pageSize: 10,
  },
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues = {}) => {
        const res = await fetchAdmins();
        accounts.value = res;
        const filtered = filterAdmins(res, formValues);
        return pageResult(filtered, page.currentPage, page.pageSize);
      },
    },
  },
  rowConfig: {
    keyField: 'id',
  },
  toolbarConfig: {
    custom: true,
    refresh: true,
    search: true,
    zoom: true,
  },
} as VxeTableGridOptions<AdminAccount>;

const [Grid, gridApi] = useSuperVxeGrid<AdminAccount>({
  formOptions,
  gridOptions,
});

function pageResult<T>(items: T[], currentPage: number, pageSize: number) {
  const safePage = Number(currentPage) > 0 ? Number(currentPage) : 1;
  const safePageSize = Number(pageSize) > 0 ? Number(pageSize) : 10;
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    total: items.length,
  };
}

async function fetchAdmins() {
  return await requestClient.get<AdminAccount[]>('/admin/users');
}

function filterAdmins(source: AdminAccount[], formValues: Record<string, any>) {
  const keyword = String(formValues.keyword || '').trim().toLowerCase();
  if (!keyword) return source;
  return source.filter((account) =>
    [account.id, account.name, account.realName].join(' ').toLowerCase().includes(keyword),
  );
}

function isProtectedAdmin(username: string) {
  return username.trim().toLowerCase() === 'admin';
}

function openDialog(row?: AdminAccount) {
  editingId.value = row?.id || '';
  formData.value = {
    password: '',
    realName: row?.realName || '',
    username: row?.name || '',
  };
  dialogVisible.value = true;
}

async function submitAdmin() {
  const username = formData.value.username.trim();
  const realName = formData.value.realName.trim();
  const password = formData.value.password;

  if (!username) {
    MessagePlugin.warning('请输入用户名');
    return;
  }
  if (isProtectedAdmin(username)) {
    MessagePlugin.warning('admin 为内置保护账号，不能在这里维护');
    return;
  }
  if (!editingId.value && !password) {
    MessagePlugin.warning('请输入初始密码');
    return;
  }

  saving.value = true;
  try {
    const payload = { password, realName, username };
    if (editingId.value) {
      await requestClient.put(`/admin/users/${editingId.value}`, payload);
      MessagePlugin.success('管理员账号已更新');
    } else {
      await requestClient.post('/admin/users', payload);
      MessagePlugin.success('管理员账号已创建');
    }
    dialogVisible.value = false;
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}

function confirmDelete(row: AdminAccount) {
  if (row.isCurrent) {
    MessagePlugin.warning('不能删除当前登录账号');
    return;
  }
  const dialog = DialogPlugin.confirm({
    body: `删除管理员「${row.name}」后，该账号将无法登录后台。`,
    cancelBtn: '取消',
    confirmBtn: { content: '删除', theme: 'danger' },
    header: '删除管理员账号',
    onCancel: () => dialog.hide(),
    onConfirm: async () => {
      await requestClient.delete(`/admin/users/${row.id}`);
      MessagePlugin.success('管理员账号已删除');
      dialog.hide();
      await gridApi.query();
    },
  });
}
</script>

<template>
  <Page title="管理员管理">
    <template #description>
      <div class="mt-2 text-foreground/70">
        管理可登录 Admin 后台的普通管理员账户，内置 admin 账号不参与增删改。
      </div>
    </template>
    <template #extra>
      <t-button theme="primary" @click="openDialog()">
        <template #icon><t-icon name="user-add" /></template>
        新增管理员
      </t-button>
    </template>

    <div class="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
      <div
        v-for="item in metrics"
        :key="item.label"
        class="rounded-lg border border-border bg-card px-5 py-4">
        <div class="text-sm text-foreground/60">{{ item.label }}</div>
        <div class="mt-2 truncate text-2xl font-semibold">{{ item.value }}</div>
        <div class="mt-1 text-xs text-foreground/50">{{ item.desc }}</div>
      </div>
    </div>

    <Grid table-title="管理员账户" table-title-help="仅管理非 admin 用户名的后台登录账号">
      <template #toolbar-tools>
        <t-button theme="primary" @click="openDialog()">
          <template #icon><t-icon name="user-add" /></template>
          新增管理员
        </t-button>
      </template>

      <template #name="{ row }">
        <div class="flex min-w-0 items-center gap-3">
          <t-avatar size="36px" :image="row.avatar || undefined">
            {{ row.name.slice(0, 1).toUpperCase() }}
          </t-avatar>
          <div class="min-w-0 text-left">
            <div class="flex min-w-0 items-center gap-2">
              <span class="truncate font-medium">{{ row.name }}</span>
              <t-tag v-if="row.isCurrent" size="small" theme="success" variant="light">
                当前
              </t-tag>
            </div>
            <div class="truncate text-xs text-foreground/60">ID {{ row.id }}</div>
          </div>
        </div>
      </template>

      <template #realName="{ row }">
        <span>{{ row.realName || '-' }}</span>
      </template>

      <template #role>
        <t-tag theme="primary" variant="light">Admin</t-tag>
      </template>

      <template #operation="{ row }">
        <t-space :size="0">
          <t-button variant="text" theme="primary" @click="openDialog(row)">
            编辑
          </t-button>
          <t-button
            variant="text"
            theme="danger"
            :disabled="row.isCurrent"
            @click="confirmDelete(row)">
            删除
          </t-button>
        </t-space>
      </template>
    </Grid>

    <t-dialog
      v-model:visible="dialogVisible"
      :header="editingId ? '编辑管理员' : '新增管理员'"
      placement="center"
      width="520px"
      :confirm-btn="{ content: '保存', loading: saving }"
      @confirm="submitAdmin">
      <t-form label-align="top">
        <t-form-item label="用户名">
          <t-input v-model="formData.username" placeholder="2-20 个字符，不能使用 admin" clearable />
        </t-form-item>
        <t-form-item label="显示名称">
          <t-input v-model="formData.realName" placeholder="默认同用户名" clearable />
        </t-form-item>
        <t-form-item :label="editingId ? '重置密码' : '初始密码'">
          <t-input
            v-model="formData.password"
            type="password"
            :placeholder="editingId ? '留空则不修改密码' : '6-20 个字符'"
            clearable />
        </t-form-item>
      </t-form>
    </t-dialog>
  </Page>
</template>
