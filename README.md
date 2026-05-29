# DramaStudio Monorepo

本仓库按 Vben Admin 的 pnpm workspace + Turborepo 大仓方式组织。`web` 前端与 `server` 后端已经作为 workspace 应用接入根工程，同时保留原目录位置，避免影响现有 Docker、静态资源同步与本地开发路径。

## 目录

```text
apps/                 Vben 示例应用与 mock 服务
internal/             Vben 工程工具、lint、tsconfig、vite 配置
packages/             可复用前端基础包
scripts/              turbo-run、vsh、部署脚本
web/                  @dramastudio/web 前端应用，默认端口 50188
server/               @dramastudio/server 后端服务，默认 API 端口 10588
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

# 构建与检查
pnpm build:web
pnpm build:server
pnpm build:app
pnpm typecheck:web
pnpm typecheck:server
pnpm check:type
```

## Workspace 应用

- `@dramastudio/web` 位于 `web/`，保留原 Vite/Vue/TDesign 业务代码。
- `@dramastudio/server` 位于 `server/`，保留 Express/MySQL/AI SDK 后端服务。
- `@super/web-tdesign` 与 `@super/backend-mock` 仍位于 `apps/`，作为 Vben 模板侧的应用参考。

后续新增前端、后端或移动端应用时优先放入 `apps/`；现有 `web`、`server` 当前以 workspace 根级应用保留，等部署路径和静态资源拷贝脚本统一后再做物理搬迁。
