# DramaStudio Web

`@super/web` 是 DramaStudio 的前端应用，已接入 monorepo 的 pnpm、Turbo、catalog 依赖、`@super/vite-config` 和 `@super/tsconfig` 工程封装。项目结构参考 `apps/admin`，同时保留现有短剧创作业务界面。

## 技术栈

- Vue 3.5+
- Vite 8，通过 `@super/vite-config` 统一封装
- TypeScript 6，通过 `@super/tsconfig/web-app.json` 和 `@super/tsconfig/node.json` 统一配置
- Pinia
- Vue Router
- TDesign Vue Next
- pnpm workspace catalog 依赖管理

## 本地开发

从仓库根目录执行：

```bash
pnpm install --ignore-scripts
pnpm dev:web
```

默认前端端口为 `50188`，后端 API 默认为 `http://localhost:10588/api`。

常用命令：

```bash
pnpm typecheck:web
pnpm build:web
pnpm build:app
pnpm lint:web
pnpm -F @super/web run preview
```

## 环境变量

`apps/web/.env.example` 提供本地默认值；实际 mode 配置跟随 `apps/admin` 拆分到 `apps/web/.env.development`、`apps/web/.env.production` 和 `apps/web/.env.analyze`：

```bash
VITE_APP_TITLE=DramaStudio
VITE_APP_NAMESPACE=dramastudio-web
VITE_APP_STORE_SECURE_KEY=please-replace-me-with-your-own-key
VITE_BASE=./
VITE_PORT=50188
VITE_ROUTER_HISTORY=hash
VITE_GLOB_API_URL=http://localhost:10588/api
```

`VITE_BASE`、`VITE_PORT`、`VITE_APP_TITLE` 由 `@super/vite-config` 读取；`VITE_ROUTER_HISTORY` 控制 hash/history 路由模式；`VITE_GLOB_API_URL` 供业务请求封装读取。旧的 `VITE_API_BASE_URL` 仍作为本地兼容兜底，但新配置应使用 `VITE_GLOB_API_URL`。

## 工程结构

```text
apps/web/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ tsconfig.node.json
├─ src/
│  ├─ app/                  # 应用根组件，承载 ConfigProvider 等应用级配置
│  ├─ bootstrap.ts          # 应用启动、插件安装、全局标题等运行时入口
│  ├─ main.ts               # 仅调用 bootstrap
│  ├─ router/
│  │  ├─ index.ts           # router 实例
│  │  ├─ guard.ts           # 路由守卫
│  │  └─ routes/            # 静态路由拆分
│  ├─ assets/
│  ├─ components/
│  ├─ locales/
│  ├─ pages/
│  ├─ stores/
│  ├─ types/                # 非 .d.ts 的兼容类型模块
│  ├─ utils/
│  └─ views/
└─ public/
```

`vite.config.ts` 是唯一的 Vite 配置源；`vite.config.js`、`vite.config.d.ts` 属于 TypeScript 可能生成的临时产物，不再纳入源码维护。
应用内不维护 `.d.ts` 声明文件；Vue、Pinia、Router、TDesign API 由源码显式导入，TDesign 组件在 `src/bootstrap.ts` 安装，不再通过 Vite 自动导入或组件扫描插件注入。必要的历史业务全局类型集中在 `src/types/global.ts`。

## 验证要求

工程配置或运行时入口变更后，至少执行：

```bash
pnpm typecheck:web
pnpm build:web
```

涉及登录、路由、API 地址或 shell 行为时，还需要打开本地页面验证 `#/login`、登录跳转和 `#/project` 等主路由。
