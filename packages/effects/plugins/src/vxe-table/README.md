# VXE Table Plugin

基于 vxe-table 和 vxe-pc-ui 的表格组件插件。

## 导出

| 导出                  | 类型 | 说明           |
| --------------------- | ---- | -------------- |
| `setupSuperVxeTable`   | 函数 | 初始化配置函数 |
| `useSuperVxeGrid`      | 函数 | 表格组合式函数 |
| `SuperVxeGrid`         | 组件 | 表格组件       |
| `VxeTableGridColumns` | 类型 | 表格列类型     |
| `VxeTableGridOptions` | 类型 | 表格配置类型   |
| `VxeGridProps`        | 类型 | 表格 Props     |
| `VxeGridListeners`    | 类型 | 表格事件类型   |

## 使用

```ts
import {
  setupSuperVxeTable,
  useSuperVxeGrid,
  SuperVxeGrid,
} from '@super/plugins/vxe-table';
```

## 初始化

在应用入口处调用：

```ts
import { setupSuperVxeTable } from '@super/plugins/vxe-table';
import { useSuperForm } from '@super-core/form-ui';

setupSuperVxeTable({
  configVxeTable: (vxeUI) => {
    // 配置 VXE Table
  },
  useSuperForm,
});
```

## 类型

```ts
import type {
  VxeTableGridOptions,
  VxeGridProps,
} from '@super/plugins/vxe-table';
```
