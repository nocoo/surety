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

> 💡 **提示**: Google OAuth 回调地址设置为 `http://localhost:7015/api/auth/callback/google`

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

打开浏览器访问 👉 [http://localhost:7015](http://localhost:7015)

## 📁 项目结构

```
surety/
├── 📂 docs/                      # 项目文档
│   ├── 01-design-overview.md     # 整体设计研究报告
│   ├── 02-database-design.md     # 数据库设计
│   ├── 03-google-oauth-setup.md  # Google OAuth 配置
│   ├── 04-mcp-setup.md           # MCP Server 配置
│   ├── 05-basalt-ui-migration.md # Basalt UI 迁移方案
│   ├── 06-testing-improvement-plan.md # 四层测试改进计划
│   ├── 07-impeccable-audit-report.md # 安全审计报告
│   ├── 08-two-factor-auth.md    # 2FA 设计
│   ├── 09-totp-module.md        # TOTP 模块重构
│   ├── 10-totp-implementation-details.md # TOTP 实现细节
│   └── 11-sqlite-to-d1-migration.md # SQLite → Cloudflare D1 迁移
├── 📂 drizzle/                   # 数据库迁移文件
├── 📂 e2e/                       # Playwright 浏览器 E2E 测试
│   ├── 📂 fixtures/              # 测试 fixture 与自定义 helpers
│   │   └── base.ts               # navigateTo helper, 通用 selectors
│   ├── 📂 pages/                 # Page Object Model
│   │   ├── dashboard.page.ts     # 仪表盘
│   │   ├── members.page.ts       # 成员 CRUD
│   │   ├── policies.page.ts      # 保单 CRUD (筛选/排序/视图切换)
│   │   ├── assets.page.ts        # 资产 CRUD
│   │   ├── insurers.page.ts      # 保险公司 CRUD
│   │   ├── coverage-lookup.page.ts # 保障速查
│   │   ├── renewal-calendar.page.ts # 续保日历
│   │   └── settings.page.ts      # 设置
│   ├── 📂 tests/                 # 测试用例 (58 tests)
│   │   ├── dashboard.spec.ts     # 仪表盘统计卡片与图表
│   │   ├── members.spec.ts       # 成员增删改查
│   │   ├── policies.spec.ts      # 保单增删改查 + 筛选/视图
│   │   ├── assets.spec.ts        # 资产增删改查
│   │   ├── insurers.spec.ts      # 保险公司增删改查
│   │   ├── coverage-lookup.spec.ts # 保障速查 + 类别切换
│   │   ├── renewal-calendar.spec.ts # 续保日历
│   │   ├── settings.spec.ts      # 设置页面
│   │   └── navigation.spec.ts    # 侧边栏导航 + 页面跳转
│   └── playwright.config.ts      # Playwright 配置 (Chromium, 单线程, zh-CN)
├── 📂 public/                    # 静态资源
├── 📂 scripts/                   # 工具脚本
│   ├── seed-remote.ts            # 远程 D1 数据库种子
│   ├── restore-prod.ts           # 生产数据库还原
│   ├── run-e2e.ts                # API E2E 运行器 (port 7016)
│   ├── run-e2e-ui.ts             # Playwright E2E 运行器 (port 7017)
│   ├── e2e-utils.ts              # E2E 共享工具 (端口检查等)
│   ├── check-coverage.ts         # 测试覆盖率检查
│   └── resize-logos.py           # Logo 处理脚本
├── 📂 src/
│   ├── 📂 __tests__/             # 单元测试 + API E2E 测试
│   │   ├── 📂 db/                # Repository 单元测试
│   │   ├── 📂 e2e/               # API 端到端测试 (14 specs)
│   │   ├── backy-service.test.ts # Backy 远程备份服务
│   │   ├── backup.test.ts        # 数据库备份
│   │   ├── category-config.test.ts # 保险类别配置
│   │   ├── chart-config.test.ts  # 图表配置
│   │   ├── coverage-lookup-vm.test.ts # 保障速查 ViewModel
│   │   ├── dashboard-vm.test.ts  # 仪表盘 ViewModel
│   │   ├── health.test.ts        # 健康检查
│   │   ├── policy-status.test.ts # 保单状态推导
│   │   ├── renewal-calendar-vm.test.ts # 续保日历 ViewModel
│   │   ├── utils.test.ts         # 工具函数
│   │   └── version.test.ts       # 版本号一致性
│   ├── 📂 app/                   # Next.js App Router
│   │   ├── 📂 api/               # API 路由
│   │   ├── 📂 assets/            # 资产页面
│   │   ├── 📂 coverage-lookup/   # 保障速查页面
│   │   ├── 📂 insurers/          # 保险公司页面
│   │   ├── 📂 login/             # 登录页面
│   │   ├── 📂 members/           # 成员页面
│   │   ├── 📂 policies/          # 保单页面
│   │   ├── 📂 renewal-calendar/  # 续保日历页面
│   │   ├── 📂 settings/          # 设置页面
│   │   ├── layout.tsx            # 根布局
│   │   └── page.tsx              # 仪表盘 (首页)
│   ├── 📂 components/            # UI 组件
│   │   ├── 📂 charts/            # 图表组件
│   │   ├── 📂 coverage-lookup/   # 保障速查组件
│   │   ├── 📂 layout/            # 布局组件 (Sidebar 等)
│   │   ├── 📂 renewal/           # 续保相关组件
│   │   ├── 📂 ui/                # shadcn/ui 基础组件
│   │   ├── auth-provider.tsx     # 认证 Provider
│   │   └── loading-screen.tsx    # 加载画面
│   ├── 📂 db/                    # 数据库层
│   │   ├── 📂 repositories/      # CRUD 操作
│   │   ├── backup.ts             # 数据库备份/还原
│   │   ├── index.ts              # 连接管理 (D1 remote + bun:sqlite test)
│   │   ├── schema.ts             # Drizzle schema
│   │   ├── seed.ts               # 种子数据函数
│   │   └── types.ts              # 类型定义, deriveDisplayStatus()
│   ├── 📂 hooks/                 # React Hooks
│   │   ├── use-mobile.tsx        # 移动端检测
│   │   └── use-persisted-state.ts # localStorage 持久化状态
│   ├── 📂 lib/                   # 工具函数 & ViewModel
│   │   ├── api-helpers.ts        # API 请求辅助
│   │   ├── category-config.ts    # 保险类别配置
│   │   ├── chart-config.ts       # 图表颜色配置
│   │   ├── coverage-lookup-vm.ts # 保障速查 ViewModel
│   │   ├── dashboard-vm.ts       # 仪表盘 ViewModel
│   │   ├── health.ts             # 健康检查
│   │   ├── palette.ts            # 调色板
│   │   ├── renewal-calendar-vm.ts # 续保日历 ViewModel
│   │   ├── utils.ts              # 通用工具
│   │   └── version.ts            # 版本号管理 (APP_VERSION)
│   ├── 📂 services/              # 业务服务
│   │   └── backy.ts              # Backy 远程备份服务
│   ├── auth.ts                   # NextAuth 配置
│   └── proxy.ts                  # 代理中间件
├── 📂 mcp/                       # MCP Server
│   ├── index.ts                  # Entry point (stdio transport)
│   ├── server.ts                 # Tool registration
│   ├── guard.ts                  # Security enable check
│   ├── 📂 tools/                 # Tool implementations
│   │   ├── members.ts            # list-members, get-member
│   │   ├── policies.ts           # list-policies, get-policy
│   │   ├── assets.ts             # list-assets
│   │   └── coverage.ts           # coverage-analysis, renewal-overview, dashboard-summary
│   └── 📂 __tests__/             # MCP tests
│       ├── mcp.e2e.test.ts       # E2E tests (agent perspective)
│       ├── guard.test.ts         # Guard unit tests
│       ├── tools-members.test.ts # Member tools unit tests
│       ├── tools-policies.test.ts # Policy tools unit tests
│       ├── tools-assets.test.ts  # Asset tools unit tests
│       └── tools-coverage.test.ts # Coverage tools unit tests
├── .env.example                  # 环境变量示例
├── drizzle.config.ts             # Drizzle ORM 配置
├── Dockerfile                    # Docker 容器化
└── package.json
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
| `bun dev` | 启动开发服务器 (端口 7015) |
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
      "args": ["run", "mcp/index.ts"],
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
