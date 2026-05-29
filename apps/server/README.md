# DramaStudio Server

## Monorepo 使用

后端位于 `apps/server`，已接入根目录 pnpm workspace，包名为 `@super/server`。推荐从仓库根目录运行：

```bash
pnpm install
pnpm dev:server
pnpm typecheck:server
pnpm build:server
```

也可以只过滤当前包：

```bash
pnpm -F @super/server run dev
pnpm -F @super/server run typecheck
```

## 环境变量配置

服务启动时会自动加载环境变量文件。默认优先级如下：

1. `DRAMASTUDIO_ENV_FILE` 或 `ENV_FILE` 指定的文件
2. 当前工作目录下的 `.env`
3. `apps/server/.env`

本地运行时直接修改 `apps/server/.env`。该文件不会提交到 Git；可提交和复制的模板是 `apps/server/.env.example`。

## 数据库配置

数据库连接通过 `.env` 配置，不需要改代码。服务只使用 MySQL：

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=dramastudio
MYSQL_CONNECTION_LIMIT=10
MYSQL_CHARSET=utf8mb4
MYSQL_TIMEZONE=Z
MYSQL_AUTO_CREATE_DATABASE=false
```

## 🛠️ 技术栈

| 类别       | 技术                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------- |
| 运行时     | Node.js 22.18.0+ / 24.0.0+                                                                |
| 语言       | TypeScript 5.x                                                                            |
| 后端框架   | Express 5                                                                                 |
| 数据库     | mysql                                                           |
| AI 集成    | Vercel AI SDK（OpenAI / Anthropic / Google / DeepSeek / 智谱 / MiniMax / 通义千问 / xAI） |
| 本地推理   | @huggingface/transformers（ONNX）                                                         |
| 实时通信   | Socket.IO                                                                                 |
| 图像处理   | Sharp                                                                                     |
| 容器化     | Docker                                                                                    |

## 项目结构

```
📂 build/                    # 编译产物
📂 data/                     # 运行时数据
│  ├─ 📂 models/            # 本地推理模型（ONNX）
│  ├─ 📂 oss/               # 对象存储（素材/角色/场景）
│  ├─ 📂 serve/             # 生产环境入口
│  ├─ 📂 skills/            # Agent 技能提示词
│  └─ 📂 web/               # 前端编译产物（内置）
📂 docs/                     # 文档资源
📂 env/                      # 环境配置
📂 scripts/                  # 构建与辅助脚本
📂 src/
├─ 📂 agents/               # AI Agent 模块
│  ├─ 📂 productionAgent/   # 生产 Agent
│  └─ 📂 scriptAgent/       # 剧本 Agent
├─ 📂 lib/                  # 公共库（数据库初始化、响应格式）
├─ 📂 middleware/            # 中间件
├─ 📂 routes/               # 路由模块
│  ├─ 📂 agents/            # Agent 记忆管理
│  ├─ 📂 artStyle/          # 画风管理
│  ├─ 📂 assets/            # 素材管理
│  ├─ 📂 assetsGenerate/    # 素材生成
│  ├─ 📂 cornerScape/       # 分镜管理
│  ├─ 📂 general/           # 通用接口
│  ├─ 📂 login/             # 登录认证
│  ├─ 📂 migrate/           # 数据迁移
│  ├─ 📂 modelSelect/       # 模型选择
│  ├─ 📂 novel/             # 小说管理
│  ├─ 📂 other/             # 其他功能
│  ├─ 📂 production/        # 制作管理
│  ├─ 📂 project/           # 项目管理
│  ├─ 📂 script/            # 剧本生成
│  ├─ 📂 scriptAgent/       # 剧本 Agent 接口
│  ├─ 📂 setting/           # 系统设置
│  ├─ 📂 task/              # 任务管理
│  └─ 📂 test/              # 测试接口
├─ 📂 socket/               # WebSocket 实时通信
├─ 📂 types/                # TypeScript 类型声明
├─ 📂 utils/                # 工具函数
├─ 📄 app.ts                # 应用入口
├─ 📄 core.ts               # 核心初始化
├─ 📄 env.ts                # 环境变量处理
├─ 📄 err.ts                # 错误处理
├─ 📄 logger.ts             # 日志模块
├─ 📄 router.ts             # 路由注册
└─ 📄 utils.ts              # 通用工具
📄 Dockerfile                # Docker 构建文件
📄 skillList.json            # 技能清单
📄 LICENSE                   # 许可证（Apache-2.0）
📄 NOTICES.txt               # 第三方依赖声明
📄 package.json              # 项目配置
📄 tsconfig.json             # TypeScript 配置
```
