<p align="center">
  <img src="apps/worker/static/logo-80.png" alt="Surety Logo" width="80" height="80">
</p>

<h1 align="center">Surety</h1>

<p align="center">
  <strong>家庭保单管理工具</strong><br>
  极简 · Self-host · 隐私安全
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vite-6-646cff" alt="Vite">
  <img src="https://img.shields.io/badge/Hono-Worker-ff6600" alt="Hono">
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

## 🏗️ 架构

Surety 是一个全栈 Cloudflare 应用：

```
Browser ──► Cloudflare Access (Google OAuth)
        └─► Hono Worker (surety) ──► @surety/api ──► @surety/db ──► D1 binding
                    │
                    └─► Static assets (Vite SPA build)

CLI/MCP ──► Bearer token ──► Hono Worker ──► @surety/api ──► @surety/db ──► D1
```

- **前端**：Vite + React Router SPA，构建产物直接写到 Worker 的 `static/` 目录，由 Worker `ASSETS` binding 托管（SPA fallback）。
- **API**：Hono Worker，路由全部位于 `/api/*`，业务逻辑委托给 `@surety/api`。
- **Auth**：
  - 浏览器走 Cloudflare Access（Google OAuth），Worker 中 `accessAuth` 中间件校验 `Cf-Access-Jwt-Assertion`。
  - CLI / MCP / 脚本走 Bearer token（`api_tokens` 表），`apiKeyAuth` 中间件校验。
  - `/api/live` 公开无需鉴权；本地 localhost host 直通以便本地调试。
- **MCP**：不再直连 DB，改为通过 Bearer token 调 Worker HTTP API。

## 🚀 快速开始

### 1️⃣ 安装依赖

```bash
# 需要先安装 Bun: https://bun.sh
bun install
```

### 2️⃣ 配置环境变量

```bash
cp .env.example .env
```

本地开发不需要跑自己的 Worker — Vite dev server 会代理 `/api/*` 到线上 Worker，同时自动注入 Bearer token，让你直接在浏览器里看到 prod 数据：

```bash
# 线上 Worker 地址 (默认 https://surety.hexly.ai)
SURETY_API_URL=https://surety.hexly.ai

# 拿一个 CLI token（详见下面的"CLI / MCP — Bearer token"）
SURETY_DEV_API_TOKEN=sk_xxx
```

> 💡 想跑本地 Worker 也可以：`bun run dev:worker` 启动 `wrangler dev`，然后把 `SURETY_API_URL` 指向 `http://localhost:7016`。

### 3️⃣ 初始化数据库（只在新部署时需要）

```bash
# 推送 schema 到 D1
bun run db:push

# (可选) 填充测试数据
SURETY_TARGET_DB=dev bun run db:seed
```

> 💡 详见 [CLAUDE.md](CLAUDE.md) 中的 Worker Deployment 章节。

### 4️⃣ 启动开发服务器

```bash
bun dev
```

打开浏览器访问 👉 [http://localhost:7012](http://localhost:7012)

## 📁 项目结构

Bun workspace monorepo。依赖图：`apps/web → apps/worker`（运行时）+ `apps/worker → @surety/api → @surety/db`，`packages/mcp → Worker HTTP API`。

```
surety/
├── 📂 apps/
│   ├── 📂 web/                       # Vite React SPA
│   │   ├── 📂 src/
│   │   │   ├── 📂 app/               # 路由页面 (React Router)
│   │   │   ├── 📂 components/        # React UI 组件 (shadcn/ui)
│   │   │   ├── 📂 hooks/             # React hooks
│   │   │   ├── 📂 lib/               # 客户端工具
│   │   │   ├── 📂 __tests__/         # fetchAPI 等单元测试
│   │   │   ├── api.ts                # fetch wrapper (credentials include)
│   │   │   ├── App.tsx               # 根路由
│   │   │   └── main.tsx              # 入口
│   │   ├── index.html
│   │   └── vite.config.ts            # dev proxy → prod Worker
│   ├── 📂 worker/                    # Hono API + 静态资源
│   │   ├── 📂 src/
│   │   │   ├── index.ts              # Hono app, 路由注册
│   │   │   ├── 📂 middleware/        # access-auth, api-key-auth, is-localhost
│   │   │   ├── 📂 routes/            # members, policies, …, auth-cli
│   │   │   └── 📂 lib/               # context/types helpers
│   │   ├── 📂 __tests__/             # Worker 单元测试
│   │   ├── 📂 static/                # Vite 构建产物 (git-ignored) + logos
│   │   └── wrangler.toml
│   └── 📂 web_legacy/                # 旧 Next.js 应用（过渡保留）
├── 📂 packages/
│   ├── 📂 db/                        # @surety/db — Schema + Repositories
│   │   └── 📂 src/
│   │       ├── schema.ts
│   │       ├── index.ts              # sqlite-proxy + D1 binding driver
│   │       └── 📂 repositories/
│   ├── 📂 api/                       # @surety/api — 业务逻辑（framework-agnostic）
│   │   └── 📂 src/
│   │       ├── dashboard.ts
│   │       ├── coverage-lookup.ts
│   │       ├── renewal-calendar.ts
│   │       └── …
│   └── 📂 mcp/                       # @surety/mcp — MCP Server（通过 HTTP API）
│       └── 📂 src/
│           ├── index.ts              # stdio entry
│           ├── api-client.ts         # Bearer-token HTTP client
│           ├── guard.ts              # mcp.enabled gate
│           └── 📂 tools/
├── package.json                      # Workspace root
├── tsconfig.base.json
└── bunfig.toml
```

## 🛠️ 技术栈

| 组件 | 选型 |
|------|------|
| ⚡ Runtime | [Bun](https://bun.sh) |
| 🖥️ 前端 | [Vite 6](https://vitejs.dev) + [React 19](https://react.dev) + [React Router 7](https://reactrouter.com) + [SWR](https://swr.vercel.app) |
| ☁️ 后端 | [Hono](https://hono.dev) on [Cloudflare Workers](https://workers.cloudflare.com) |
| 📝 Language | TypeScript (strict mode) |
| 🗄️ Database | [Cloudflare D1](https://developers.cloudflare.com/d1/) + [Drizzle ORM](https://orm.drizzle.team)（D1 binding 直连） |
| 🎨 UI | [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| 🔐 Auth | [Cloudflare Access](https://www.cloudflare.com/zero-trust/) (Google OAuth) + Bearer token（CLI/MCP） |

## 📋 常用命令

| 命令 | 说明 |
|------|------|
| `bun dev` | 启动 Vite dev server (端口 7012)，代理到线上 Worker |
| `bun run dev:worker` | 启动本地 Hono Worker (`wrangler dev --port 7016`) |
| `bun run build` | Vite 构建到 `apps/worker/static/` |
| `bun test` | 运行所有单元测试（web + worker + mcp + legacy） |
| `bun run test:web` | 仅 web SPA 单测 |
| `bun run test:worker` | 仅 Worker 中间件/路由单测 |
| `bun run test:mcp` | 仅 MCP HTTP client + guard 单测 |
| `bun run test:legacy` | 仅 legacy 测试（暂时保留） |
| `bun run test:coverage` | 测试覆盖率报告 |
| `bun run test:coverage:cached` | L1 文件哈希缓存：只在输入变化时跑测试 |
| `bun run test:e2e` | API E2E（port 7016） |
| `bun run test:e2e:ui` | Playwright 浏览器 E2E（port 7017） |
| `bun run test:mcp:e2e` | MCP E2E |
| `bun run lint` | ESLint（零警告） |
| `bun run typecheck` | tsc --noEmit |
| `bun run db:push` | 推送 schema 到 D1 |
| `bun run db:studio` | 打开 Drizzle Studio |
| `bun run db:seed` | 填充测试数据 |
| `bun run mcp` | 启动 MCP Server (stdio) |

## 🔐 鉴权流程

### 浏览器 — Cloudflare Access

1. 浏览器访问 `https://surety.hexly.ai`
2. Cloudflare Access 拦截 → Google OAuth 登录
3. CF 回发 `Cf-Access-Jwt-Assertion` header，Worker 的 `accessAuth` 用 CF JWKS 校验并提取 `email`。
4. 本地开发时 host 以 `localhost` / `127.0.0.1` / `.dev.hexly.ai` 开头 → 直接放行，用于脱机调试。

### CLI / MCP — Bearer token

目前**只有** `/api/auth/cli` loopback 流程可以铸 token（设置页暂时没有手动创建入口）：

1. 在本地起一个监听 `http://127.0.0.1:PORT/cb` 的小脚本（接收回调），例如：
   ```bash
   # 一次性 netcat 接收
   nc -l 7777
   ```
2. 浏览器打开（会先走 CF Access 登录）：
   ```
   https://surety.hexly.ai/api/auth/cli?callback_url=http://127.0.0.1:7777/cb&state=NONCE
   ```
3. Worker 通过 CF Access 鉴权后铸造一个绑定当前邮箱的 token，302 重定向回
   `callback_url`，查询参数里带上 `api_key`、`state`、`email`。`callback_url`
   必须是 `http://127.0.0.1:*` 或 `http://localhost:*`。
4. 把 `api_key` 配到 `SURETY_API_TOKEN` / `SURETY_DEV_API_TOKEN` 或 MCP 配置
   里。Worker 的 `apiKeyAuth` 中间件负责校验并更新 `lastUsedAt`。

> ℹ️ 吊销 token 走 `DELETE /api/auth/tokens/:id`（设置页目前没有 token 管理
> UI，只能用 API 直接管理）。

## 🤖 MCP Server

Surety 提供 [MCP (Model Context Protocol)](https://modelcontextprotocol.io) 接口，允许 AI 助手（Claude Code、Cursor 等）通过 stdio 传输协议查询保单数据。底层走 HTTP API — 需要在环境里配 Bearer token。

### 启用 MCP

1. 在 Surety 设置页开启 **MCP Access**（写入 `settings.mcp.enabled`，guard 会读这个开关）。
2. 按上一节的 `/api/auth/cli` loopback 流程拿一个 Bearer token。
3. 在 AI 助手配置中添加：

```json
{
  "mcpServers": {
    "surety": {
      "command": "bun",
      "args": ["run", "packages/mcp/src/index.ts"],
      "cwd": "/path/to/surety",
      "env": {
        "SURETY_API_URL": "https://surety.hexly.ai",
        "SURETY_API_TOKEN": "sk_xxx"
      }
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
