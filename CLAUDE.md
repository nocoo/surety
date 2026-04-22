# Surety

家庭保单管理工具。极简、Self-host、隐私安全。

## 目标用户

40岁软件开发者，上有老下有小，关注家庭风险管理。

## 技术栈

| 组件 | 选型 |
|------|------|
| Runtime | Bun |
| 前端 | Vite 6 + React 19 + React Router 7 + SWR |
| 后端 | Hono on Cloudflare Workers |
| Language | TypeScript (严格模式) |
| Database | Cloudflare D1 (D1 binding 直连) + Drizzle ORM |
| UI | Tailwind CSS v4 + shadcn/ui |
| Auth | Cloudflare Access (Google OAuth) + Bearer token (CLI) |
| Deployment | Cloudflare Workers (单一 Worker，托管 API + 静态资源) |

### Monorepo 结构

Bun workspace monorepo，运行时依赖图：`apps/web (Vite SPA) → apps/worker (Hono) → packages/api → packages/db → D1 binding`。CLI 经 Bearer token 直接走 Worker HTTP API。

```
surety/
├── apps/
│   ├── web/           # Vite + React SPA（构建产物 → apps/worker/static/）
│   ├── worker/        # Hono Worker：/api/* + 静态资源（D1 binding 直连）
│   └── cli/           # @nocoo/surety — Bun-only CLI（Bearer token）
├── packages/
│   ├── db/            # @surety/db — Schema + D1/sqlite-proxy 双驱动 + Repositories
│   └── api/           # @surety/api — Framework-agnostic 业务逻辑
├── package.json       # Workspace root
├── tsconfig.base.json # 共享 TS strict 配置
└── bunfig.toml
```

**关键原则**：`apps/worker` 路由是薄壳，所有业务逻辑都在 `@surety/api`；UI/CLI 只通过 HTTP API 接触数据。

### 数据库架构

- **运行时（生产）**：Hono Worker → `@surety/db` (D1 binding driver) → D1
- **L1 单元测试**：bun:sqlite `:memory:` (零网络)
- **L2 API E2E**：Hono test client + bun:sqlite `:memory:`（`apps/worker/__tests__/e2e/setup.ts`）
- **管理面**：drizzle-kit + d1-http driver (开发时 schema push)
- **Repo 模式**：Factory pattern `createMembersRepo(db)` — request-scoped DB 注入

## 六维质量金字塔

| 维度 | 工具 | 触发时机 | 要求 |
|------|------|----------|------|
| L1 单测 | bun test | pre-commit | 行 ≥ 90%、函数 ≥ 85%（web/cli/worker 全覆盖） |
| L2 API E2E | `bun test apps/worker/__tests__/e2e` | pre-push | 通过 Hono test client + in-memory D1 跑全链路 |
| L3 UI E2E | — | 按需重建 | Vite SPA 暂未接入；旧 Next.js Playwright suite 已删除 |
| G1 静态 | tsc --noEmit + eslint strict | pre-commit | 零类型错误、零 lint 警告、`*.skip`/`*.only` 禁用 |
| G2 安全 | gitleaks + osv-scanner | pre-commit (gitleaks) + pre-push (双保险) | 零泄漏、无已知漏洞 |
| Worker 单测 | bun test apps/worker/__tests__ | pre-push | 中间件、路由、auth 边界 |

升级历程见 `docs/17-quality-to-S.md`。

### 测试文件自动发现

`bunfig.toml` 配置 `pathIgnorePatterns` 排除 E2E 文件（`**/e2e/**` 和 `**/*.e2e.test.ts`），单元测试通过 glob 自动发现。新增测试文件无需手动维护列表。E2E runner 通过 `--path-ignore-patterns __none__` 覆盖 bunfig 配置。

### 核心原则

1. **尽早发现** — 不积累技术债
2. **自主解决** — 不依赖人工 review 发现低级错误
3. **质量门禁** — 问题代码无法进入主分支

## 常用命令

```bash
bun dev                  # Vite dev server (7012)，代理 /api → 线上 Worker
bun run dev:worker       # 本地 Hono Worker (wrangler dev --port 7016)
bun run build            # Vite 构建 → apps/worker/static/
bun test                 # 全部单元测试 (web + worker + cli)
bun run test:coverage    # 测试覆盖率
bun run lint             # ESLint
bun run typecheck        # tsc --noEmit (root + web + cli)
bun run db:push          # 推送 schema 到 D1
bun run db:studio        # 数据库可视化
```

## Worker Deployment

Worker 源码在 `apps/worker/`，部署到 Cloudflare Workers。单 Worker 同时托管 Hono API (`/api/*`) 和 Vite 构建出来的 SPA 静态资源（`ASSETS` binding，SPA fallback）。

### 基础信息

| 项目 | 值 |
|------|------|
| Worker 名称 | `surety` |
| Worker URL | `https://surety.<your-account>.workers.dev` |
| Custom Domain (UI) | `https://surety.hexly.ai` (CF Access 保护) |
| Custom Domain (API) | `https://surety-api.hexly.ai` (Bearer token) |
| D1 Database | `surety-db` (`<your-database-id>`) |
| Liveness | `GET /api/live` (no auth, no cache, 返回 version + D1 状态) |

### 部署命令

```bash
cd apps/web && bun run build           # 构建 SPA 到 apps/worker/static/
cd apps/worker && bunx wrangler deploy # 部署 Worker
```

### Schema 推送 (D1)

通过 `drizzle-kit push` + D1 HTTP driver 直接推（不经过 Worker）：

```bash
CLOUDFLARE_ACCOUNT_ID=<account_id> \
CLOUDFLARE_DATABASE_ID=<database_id> \
CLOUDFLARE_D1_TOKEN=<token> \
bunx drizzle-kit push
```

验证表结构：
```bash
cd apps/worker && bunx wrangler d1 execute surety-db --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table'"
```

### 数据导入

⚠️ `.dump` 的 INSERT 无列名，本地 SQLite 和 D1 (Drizzle push) 列顺序不同，必须生成带显式列名的 INSERT 语句。

```bash
# 生成带列名的 INSERT（用 python3 脚本，不能直接用 sqlite3 .dump）
# 执行到 D1
cd apps/worker && bunx wrangler d1 execute surety-db --remote --file=<sql_file>
```

### Auth 配置

- 浏览器走 CF Access（在 CF Dashboard 配置 Google OAuth → 绑定到 surety domain）。Worker 中 `accessAuth` 中间件用 CF JWKS 校验 `Cf-Access-Jwt-Assertion`。
- CLI / 脚本走 Bearer token（`api_tokens` 表），`apiKeyAuth` 中间件校验。
- `/api/live` 公开；本地 localhost host 直通便于本地调试。

### 本地开发环境变量

`.env`（用于 Vite dev proxy）：
```
SURETY_API_URL=https://surety-api.hexly.ai   # 或 http://localhost:7016
SURETY_DEV_API_TOKEN=sk_xxx                  # 从 /api/auth/cli 流程铸造
```

## Version Release Checklist

1. Read current version from `package.json`, apply the requested bump (default: patch)
2. Update **all version references** per this checklist:

   | File | What to update |
   |------|---------------|
   | `package.json` | `"version"` field |
   | `apps/web/src/app/api/live/route.ts` | fallback via `APP_VERSION` (auto, no manual change needed) |
   | `apps/web/src/services/backy.ts` | fallback via `APP_VERSION` (auto, no manual change needed) |
   | `apps/web/src/__tests__/version.test.ts` | reads from package.json (auto, no manual change needed) |

3. Commit: `chore: bump version to x.y.z`
4. Push (triggers deployment)
5. Create annotated tag: `git tag -a vx.y.z -m "vx.y.z"`
6. Push tags: `git push --tags`

Verification: `rg '旧版本号' --glob '*.ts' --glob '*.tsx'` to catch stragglers.

## CLI (`@nocoo/surety`)

AI/脚本入口，通过 Bearer token 访问 Worker HTTP API，已替代原 MCP Server。源码 `apps/cli/`，Bun-only（`bin` 指向 `src/index.ts`，无 build 步骤）。

| 任务 | 命令 |
|------|------|
| 本地调试 | `cd apps/cli && bun src/index.ts <cmd>` |
| 跑测试 | `cd apps/cli && bun test` |
| 类型检查 | `cd apps/cli && bun run typecheck` |
| 全局安装 | `bun add -g @nocoo/surety` |

认证域名模型（易错点）：
- `loginUrl`（默认 `https://surety.hexly.ai`）= CF Access 保护的铸 token 入口，`surety login` 必须打在这个域。
- `apiUrl`（默认 `https://surety-api.hexly.ai`）= 数据面，纯 Bearer token。
- 两者配置/env 完全独立（`SURETY_LOGIN_URL` vs `SURETY_API_URL`）。改动 login 流时务必保持分离。

完整命令清单和输出契约见 [apps/cli/README.md](apps/cli/README.md)。

## Retrospective

- **主动维护文档结构**：docs 目录下文件使用编号命名（如 `01-xxx.md`、`02-xxx.md`），便于阅读顺序；同时在根目录 README.md 中维护项目结构树，保持文档与代码同步更新。
- **Bun 特有 API 不可在 Next.js Server Runtime 使用**：`Bun.password.hash/verify` 是 Bun 独有 API，Next.js 的 server runtime 使用 Node.js 兼容层，`Bun` 全局对象不存在。此问题在开发阶段因 `bun dev` 运行正常而被掩盖，部署后在 API route 中触发 `ReferenceError`。解决方案：使用 `node:crypto` 的 `scrypt` + `timingSafeEqual` 替代。教训：在 Bun + Next.js 技术栈中，API route / middleware 代码必须只使用 Node.js 标准 API，Bun 特有 API 仅限构建脚本和独立进程使用。
- **SQLite .dump 导入 D1 必须带显式列名**：`sqlite3 .dump` 生成的 `INSERT INTO table VALUES(...)` 不含列名，按源库的列顺序排列。但 `drizzle-kit push` 创建的 D1 表列顺序由 schema.ts 定义顺序决定，与历史 SQLite 的列顺序不同。直接导入会导致值错位，触发 NOT NULL constraint 或数据写入错误列。解决方案：用脚本生成 `INSERT INTO table (col1, col2, ...) VALUES(...)` 格式。教训：跨数据库迁移数据时，永远不要依赖隐式列顺序。
- **sqlite-proxy "get" 方法的行映射陷阱**：Drizzle sqlite-proxy 的 callback 返回 `{ rows }` 时，`method === "get"` 期望 `rows` 是单个扁平行 `[1, "张伟", ...]`，而 `method === "all"` 期望行数组 `[[1, ...], [2, ...]]`。原实现用 `rows.slice(0,1)` 处理 "get"，但这返回 `[[1, "张伟", ...]]`（仍是数组包数组），导致 `.returning().get()` 返回 `id` 时得到整行数组而非标量值。修复：`method === "get" ? rows[0] : rows`。教训：sqlite-proxy 的 callback 返回格式文档不充分，必须读 `drizzle-orm/sqlite-proxy/session.cjs` 中的 `mapGetResult` 源码确认期望格式。
- **移除本地 SQLite 运行时的分阶段策略**：8 个原子 commit 从安全 guard → D1 dev 创建 → seed 脚本 → E2E 迁移 → UI 删除 → health check 异步化 → 本地代码删除 → 清理。关键决策：(1) 先加 E2E safety guard（Phase 1）防止迁移过程中 E2E 意外连 production；(2) E2E 全部走远程 D1 dev 而非本地文件，统一数据路径；(3) UT 保持 `bun:sqlite :memory:` 零改动（481+ test）。教训：大规模基础设施迁移必须先部署防护网再拆旧路径，每个 commit 独立可验证。