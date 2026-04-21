<p align="center">
  <img src="public/logo-light-80.png" alt="Surety Logo" width="80" height="80">
</p>

<h1 align="center">Surety</h1>

<p align="center">
  <strong>家庭保单管理工具</strong><br>
  极简 · Self-host · 隐私安全
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/Cloudflare_D1-database-orange" alt="Cloudflare D1">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
</p>

---

## ✨ 功能特点

- 📋 **保单管理** — 集中管理家庭所有保险保单
- 👨‍👩‍👧‍👦 **成员管理** — 追踪每位家庭成员的保障情况
- 🔍 **保障速查** — 快速查看任意成员或资产的保障覆盖
- 📅 **续保日历** — 一目了然的保单到期提醒
- 🏢 **保险公司** — 管理保险公司和代理人联系方式
- 🏠 **资产管理** — 房产、车辆等财产保险关联
- 🔒 **隐私优先** — 数据存储在自己的 Cloudflare D1 数据库
- 🤖 **MCP 接入** — 支持 AI 助手通过 MCP 协议查询保单数据

## 🚀 快速开始

### 1️⃣ 安装依赖

```bash
# 需要先安装 Bun: https://bun.sh
bun install
```

### 2️⃣ 配置环境变量

```bash
# 复制示例配置文件
cp .env.example .env
```

编辑 `.env` 文件，配置以下内容：

```bash
# Google OAuth 配置 (从 Google Cloud Console 获取)
# https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret

# NextAuth 密钥 (生成命令: openssl rand -base64 32)
NEXTAUTH_SECRET=your-generated-secret-here

# 允许登录的邮箱列表 (逗号分隔)
ALLOWED_EMAILS=your-email@gmail.com
```

> 💡 **提示**: Google OAuth 回调地址设置为 `http://localhost:7012/api/auth/callback/google`

### 3️⃣ 初始化数据库

数据存储在 Cloudflare D1，通过 Worker proxy 访问：

```bash
# 推送 schema 到 D1
bun run db:push

# (可选) 填充测试数据到 D1 dev 数据库
SURETY_TARGET_DB=dev bun run db:seed
```

> 💡 **提示**: 需要先部署 Worker proxy，详见 [CLAUDE.md](CLAUDE.md) 中的 Worker Deployment 章节。

### 4️⃣ 启动开发服务器

```bash
bun dev
```

打开浏览器访问 👉 [http://localhost:7012](http://localhost:7012)

## 📁 项目结构

Bun workspace monorepo。依赖图：`apps/web → @surety/api → @surety/db`，`packages/mcp → @surety/api → @surety/db`。

```
surety/
├── 📂 apps/
│   ├── 📂 web/                       # Next.js 薄壳（路由、auth、SSR、UI）
│   │   ├── 📂 src/
│   │   │   ├── 📂 app/               # App Router pages + API routes
│   │   │   ├── 📂 components/        # React UI 组件
│   │   │   ├── 📂 hooks/             # React hooks
│   │   │   ├── 📂 lib/               # Next.js 相关胶水
│   │   │   ├── 📂 services/          # 业务服务 (backy)
│   │   │   ├── 📂 __tests__/         # 单元测试 + E2E 测试
│   │   │   └── auth.ts               # NextAuth 配置
│   │   ├── 📂 e2e/                   # Playwright 浏览器 E2E
│   │   ├── 📂 scripts/               # 工具脚本
│   │   ├── 📂 drizzle/               # Migration 文件
│   │   ├── Dockerfile
│   │   └── next.config.ts
│   └── 📂 worker/                    # Cloudflare Worker D1 proxy（独立）
│       ├── 📂 src/
│       └── wrangler.toml
├── 📂 packages/
│   ├── 📂 db/                        # @surety/db — Schema + Repositories
│   │   └── 📂 src/
│   │       ├── schema.ts             # Drizzle schema
│   │       ├── types.ts              # 类型 + deriveDisplayStatus
│   │       ├── index.ts              # DB 连接管理
│   │       └── 📂 repositories/      # CRUD 操作
│   ├── 📂 api/                       # @surety/api — 业务逻辑（framework-agnostic）
│   │   └── 📂 src/
│   │       ├── dashboard.ts          # 仪表盘数据
│   │       ├── coverage-lookup.ts    # 保障速查
│   │       ├── renewal-calendar.ts   # 续保日历
│   │       ├── health.ts             # 健康检查
│   │       └── 📂 lib/               # 纯工具函数
│   └── 📂 mcp/                       # @surety/mcp — MCP Server
│       └── 📂 src/
│           ├── index.ts              # Entry point (stdio)
│           ├── server.ts             # Tool registration
│           ├── guard.ts              # Security check
│           └── 📂 tools/             # Tool implementations
├── package.json                      # Workspace root
├── tsconfig.base.json                # 共享 TS strict 配置
└── bunfig.toml
```

## 🛠️ 技术栈

| 组件 | 选型 |
|------|------|
| ⚡ Runtime | [Bun](https://bun.sh) |
| 🖥️ Framework | [Next.js 16](https://nextjs.org) (App Router) |
| 📝 Language | TypeScript (strict mode) |
| 🗄️ Database | [Cloudflare D1](https://developers.cloudflare.com/d1/) + [Drizzle ORM](https://orm.drizzle.team) |
| 🎨 UI | [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| 🔐 Auth | [NextAuth.js](https://next-auth.js.org) (Google OAuth) |

## 📋 常用命令

| 命令 | 说明 |
|------|------|
| `bun dev` | 启动开发服务器 (端口 7012) |
| `bun run build` | 生产构建 |
| `bun start` | 启动生产服务器 |
| `bun test` | 运行单元测试 |
| `bun run test:coverage` | 测试覆盖率报告 |
| `bun run test:e2e` | 运行 API 端到端测试 (port 7016) |
| `bun run test:e2e:ui` | 运行 Playwright 浏览器 E2E 测试 (port 7017) |
| `bun run test:mcp` | 运行 MCP 单元测试 |
| `bun run test:mcp:e2e` | 运行 MCP E2E 测试 |
| `bun run lint` | ESLint 检查 |
| `bun run db:push` | 推送 schema 到数据库 |
| `bun run db:studio` | 打开 Drizzle Studio |
| `bun run db:seed` | 填充测试数据 |

## 🔧 数据库管理

### Cloudflare D1 架构

所有运行时数据存储在 Cloudflare D1，通过 Worker proxy 访问：

- **生产环境** — `surety-db`，Worker binding `DB_PROD`
- **开发/E2E** — `surety-db-dev`，Worker binding `DB_DEV`（`SURETY_TARGET_DB=dev`）
- **单元测试** — `bun:sqlite mem`（无网络依赖）

### 使用 Drizzle Studio

```bash
bun run db:studio
```

打开 [https://local.drizzle.studio](https://local.drizzle.studio) 可视化管理数据库。

## 🤖 MCP Server

Surety 提供 [MCP (Model Context Protocol)](https://modelcontextprotocol.io) 接口，允许 AI 助手（Claude Code、Cursor 等）通过 stdio 传输协议查询保单数据。

### 启用 MCP

1. 在 Surety 设置页面中开启 **MCP Access** 开关
2. 在 AI 助手配置中添加：

```json
{
  "mcpServers": {
    "surety": {
      "command": "bun",
      "args": ["run", "packages/mcp/src/index.ts"],
      "cwd": "/path/to/surety"
    }
  }
}
```

### 可用工具

| 工具 | 说明 |
|------|------|
| `list-members` | 查看所有家庭成员 |
| `get-member` | 查看成员详情及关联保单 |
| `list-policies` | 查看保单列表（支持状态/类别/成员筛选） |
| `get-policy` | 查看保单详情及受益人 |
| `list-assets` | 查看资产列表 |
| `coverage-analysis` | 分析成员或资产的保障覆盖 |
| `renewal-overview` | 查看即将到期的保单 |
| `dashboard-summary` | 获取整体保障概览 |

> ⚠️ **安全提示**: MCP 默认关闭，所有工具均为只读操作。

## 📄 License

[MIT](LICENSE) © 2026
