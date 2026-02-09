<p align="center">
  <img src="public/logo-light-80.png" alt="Surety Logo" width="80" height="80">
</p>

<h1 align="center">Surety</h1>

<p align="center">
  <strong>家庭保单管理工具</strong><br>
  极简 · 本地化 · 隐私安全
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/SQLite-local-green" alt="SQLite">
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
- 🔒 **隐私优先** — 数据完全存储在本地 SQLite

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

```bash
# 创建数据库并应用 schema
bun run db:push

# (可选) 填充示例数据
bun run db:seed
```

数据库文件会自动创建在项目根目录：
- `surety.db` — 生产数据
- `surety.example.db` — 示例数据（用于演示）

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
│   └── 02-database-design.md     # 数据库设计
├── 📂 drizzle/                   # 数据库迁移文件
├── 📂 public/                    # 静态资源
├── 📂 scripts/                   # 工具脚本
│   ├── seed.ts                   # 测试数据生成
│   ├── resize-logos.py           # Logo 处理脚本
│   └── ...
├── 📂 src/
│   ├── 📂 __tests__/             # 测试文件
│   │   ├── db/                   # Repository 单元测试
│   │   └── e2e/                  # 端到端测试
│   ├── 📂 app/                   # Next.js App Router
│   │   ├── api/                  # API 路由
│   │   └── (pages)/              # 页面组件
│   ├── 📂 components/            # UI 组件
│   ├── 📂 db/                    # 数据库层
│   │   ├── repositories/         # CRUD 操作
│   │   ├── schema.ts             # Drizzle schema
│   │   └── types.ts              # 类型定义
│   └── 📂 lib/                   # 工具函数
├── .env.example                  # 环境变量示例
├── drizzle.config.ts             # Drizzle ORM 配置
└── package.json
```

## 🛠️ 技术栈

| 组件 | 选型 |
|------|------|
| ⚡ Runtime | [Bun](https://bun.sh) |
| 🖥️ Framework | [Next.js 16](https://nextjs.org) (App Router) |
| 📝 Language | TypeScript (strict mode) |
| 🗄️ Database | SQLite + [Drizzle ORM](https://orm.drizzle.team) |
| 🎨 UI | [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| 🔐 Auth | [NextAuth.js](https://next-auth.js.org) (Google OAuth) |

## 📋 常用命令

| 命令 | 说明 |
|------|------|
| `bun dev` | 启动开发服务器 (端口 7015) |
| `bun run build` | 生产构建 |
| `bun start` | 启动生产服务器 |
| `bun test` | 运行单元测试 |
| `bun run test:e2e` | 运行端到端测试 |
| `bun run test:coverage` | 测试覆盖率报告 |
| `bun run lint` | ESLint 检查 |
| `bun run db:push` | 推送 schema 到数据库 |
| `bun run db:studio` | 打开 Drizzle Studio |
| `bun run db:seed` | 填充测试数据 |

## 🔧 数据库管理

### 切换数据库

应用支持多数据库切换，在设置页面可以选择：

- **生产数据** (`surety.db`) — 真实数据
- **示例数据** (`surety.example.db`) — 演示用

### 使用 Drizzle Studio

```bash
bun run db:studio
```

打开 [https://local.drizzle.studio](https://local.drizzle.studio) 可视化管理数据库。

## 📄 License

[MIT](LICENSE) © 2026
