<template>
  <div class="task">
    <div class="header">
      <div class="headerInfo fc">
        <span class="title">{{ $t("workbench.task.title") }}</span>
        <span class="sub">{{ $t("workbench.task.subtitle") }}</span>
      </div>
      <t-button @click="getTaskList">
        <template #icon>
          <i-redo :size="20" />
        </template>
        {{ $t("workbench.task.refresh") }}
      </t-button>
    </div>
    <div class="list">
      <div class="search f">
        <t-select
          class="filterSelect projectFilter"
          :label="$t('workbench.task.project')"
          v-model="projectId"
          :options="projectData"
          @change="onFilterChange" />
        <t-select
          class="filterSelect categoryFilter"
          :label="$t('workbench.task.categoryLabel')"
          v-model="taskClass"
          :options="categoryOptions"
          @change="onFilterChange" />
        <t-select
          class="filterSelect stateFilter"
          :label="$t('workbench.task.stateLabel')"
          v-model="taskState"
          :options="stateOptions"
          @change="onFilterChange" />
      </div>
      <div class="content">
        <t-table :data="taskList" :columns="columns" row-key="id" :loading="pagination.loading" hover stripe>
          <template #state="{ row }">
            <t-tooltip v-if="row.state === '生成失败'" :content="row.reason || $t('workbench.task.noFailReason')" placement="top">
              <span class="stateText stateFail">{{ row.state }}</span>
            </t-tooltip>
            <span v-else class="stateText" :class="row.state === '进行中' ? 'stateRunning' : 'stateSuccess'">
              {{ row.state }}
            </span>
          </template>
          <template #startTime="{ row }">
            <span>{{ dayjs(row.startTime).format("YYYY-MM-DD HH:mm:ss") }}</span>
          </template>
        </t-table>
        <t-pagination
          class="paginationWrap"
          v-model:current="pagination.page"
          v-model:pageSize="pagination.limit"
          show-sizer
          :total="pagination.total"
          @page-size-change="getTaskList"
          @current-change="getTaskList" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from "dayjs";
import axios from "@/utils/axios";
import projectStore from "@/stores/project";

const { project } = storeToRefs(projectStore());

interface TaskItem {
  id: number;
  taskClass: string;
  relatedObjects: string;
  model: string;
  projectName: string;
  episode: string;
  state: string;
  startTime: number;
  describe?: string;
  prompt?: string;
  negativePrompt?: string;
  reason?: string;
}

const columns = [
  { colKey: "taskClass", title: $t("workbench.task.col.taskClass"), width: 120, ellipsis: true },
  { colKey: "relatedObjects", title: $t("workbench.task.col.relatedObjects"), width: 120, ellipsis: true },
  { colKey: "model", title: $t("workbench.task.col.model"), width: 280, ellipsis: true },
  { colKey: "describe", title: $t("workbench.task.col.describe"), ellipsis: true },
  { colKey: "prompt", title: $t("workbench.task.col.prompt"), width: 260, ellipsis: true },
  { colKey: "negativePrompt", title: $t("workbench.task.col.negativePrompt"), width: 260, ellipsis: true },
  { colKey: "reason", title: $t("workbench.task.col.reason"), ellipsis: true },
  { colKey: "state", title: $t("workbench.task.col.state"), width: 100, cell: "state" },
  { colKey: "startTime", title: $t("workbench.task.col.startTime"), width: 200, cell: "startTime" },
];

const stateOptions = [
  { label: $t("workbench.task.stateAll"), value: "" },
  { label: $t("workbench.task.stateRunning"), value: "进行中" },
  { label: $t("workbench.task.stateCompleted"), value: "已完成" },
  { label: $t("workbench.task.stateFailed"), value: "生成失败" },
];

const pagination = ref({ page: 1, limit: 10, total: 0, loading: false });
const categoryOptions = ref<{ label: string; value: string }[]>([]);
const projectData = ref<{ label: string; value: string }[]>([]);
const taskClass = ref("");
const taskState = ref("");
const projectId = ref("");
const taskList = ref<TaskItem[]>([]);

onMounted(() => {
  getTaskList();
  getCategories();
  getProject();
});

function onFilterChange() {
  pagination.value.page = 1;
  getTaskList();
}

async function getCategories() {
  const { data } = await axios.post("/task/getTaskCategories").catch(() => ({ data: [] }));
  categoryOptions.value = [
    { label: $t("workbench.task.stateAll"), value: "" },
    ...data.map((i: any) => ({ label: i.taskClass, value: i.taskClass })),
  ];
}

async function getProject() {
  const { data } = await axios.post("/task/getProject").catch(() => ({ data: [] }));
  projectData.value = [{ label: $t("workbench.task.stateAll"), value: "" }, ...data.map((i: any) => ({ label: i.name, value: i.id }))];
}

async function getTaskList() {
  pagination.value.loading = true;
  try {
    const { data } = await axios.post("/task/getTaskApi", {
      page: pagination.value.page,
      limit: pagination.value.limit,
      taskClass: taskClass.value,
      state: taskState.value,
      projectId: projectId.value || project.value?.id,
    });
    taskList.value = data.data;
    pagination.value.total = data.total;
  } catch {
    window.$message.error($t("workbench.task.fetchFailed"));
  } finally {
    pagination.value.loading = false;
  }
}
</script>

<style lang="scss" scoped>
.task {
  min-height: 100%;
  .header {
    padding-top: 30px;
    margin-bottom: 26px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    .title {
      font-size: 34px;
      font-weight: 800;
    }
    .sub {
      color: var(--td-text-color-secondary);
      margin-top: 8px;
    }
  }
  .list {
    padding: 18px;
    border: 1px solid rgba(104, 255, 226, 0.12);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.025);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);

    .search {
      gap: 14px;
      margin-bottom: 16px;
      flex-wrap: wrap;
      align-items: center;

      :deep(.t-select) {
        width: 100%;
        min-width: 0;
      }

      .filterSelect {
        flex: 0 1 260px;
        max-width: 320px;
        min-width: 200px;
      }

      .projectFilter {
        flex-basis: 320px;
        max-width: 380px;
      }

      .stateFilter {
        flex-basis: 220px;
        max-width: 240px;
      }
    }
  }
  .stateText {
    font-weight: bold;
  }
  .stateFail {
    color: var(--tf-danger);
    cursor: pointer;
  }
  .stateRunning {
    color: var(--tf-accent-2);
  }
  .stateSuccess {
    color: var(--tf-success);
  }
  .paginationWrap {
    margin-top: 14px;
  }
}

@media (max-width: 760px) {
  .task {
    .header {
      align-items: flex-start;
      gap: 16px;
      flex-direction: column;
    }

    .list {
      .search {
        .filterSelect,
        .projectFilter,
        .stateFilter {
          flex-basis: 100%;
          max-width: none;
        }
      }
    }
  }
}
</style>
