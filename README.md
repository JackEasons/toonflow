# Super Monorepo

本仓库按 Vben Admin 的 pnpm workspace + Turborepo 大仓方式组织。DramaStudio 前端、后端和后续后台管理系统都统一放在 `apps/` 下，通过根目录 catalog 维护依赖版本，通过 `@super/*` 统一包名。

## 目录

```text
apps/                 应用入口
  admin/              @super/admin 后台管理系统基础应用
  web/                @super/web 创作端前端应用，默认端口 50188
  server/             @super/server 后端服务，默认 API 端口 10588
internal/             Vben 工程工具、lint、tsconfig、vite 配置
packages/             可复用前端基础包
scripts/              turbo-run、vsh、部署脚本
pnpm-workspace.yaml   workspace 与 catalog 配置
turbo.json            Turborepo task 配置
```

## 常用命令

```bash
pnpm install

# 交互选择 workspace 内可运行 dev 的应用
pnpm dev

# DramaStudio 前后端
pnpm dev:web
pnpm dev:server
pnpm dev:app
pnpm dev:admin

# 构建与检查
pnpm build:web
pnpm build:server
pnpm build:admin
pnpm build:app
pnpm typecheck:web
pnpm typecheck:server
pnpm typecheck:admin
pnpm check:type
```

## Workspace 应用

- `@super/web` 位于 `apps/web`，保留原 Vite/Vue/TDesign 创作端业务代码。
- `@super/server` 位于 `apps/server`，保留 Express/MySQL/AI SDK 后端服务。
- `@super/admin` 位于 `apps/admin`，由 Vben TDesign 模板重命名而来，后台认证和基础菜单接口统一对接 `@super/server` 的 `/api` 服务。
