# Surety

家庭保单管理工具。极简、Self-host、隐私安全。

## 目标用户

40岁软件开发者，上有老下有小，关注家庭风险管理。

## 技术栈

| 组件 | 选型 |
|------|------|
| Runtime | Bun |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (严格模式) |
| Database | Cloudflare D1 (via Worker proxy) + Drizzle ORM |
| UI | Tailwind CSS + shadcn/ui |
| Deployment | Railway (Next.js) + Cloudflare Workers (D1 proxy) |

### Monorepo 结构

Bun workspace monorepo，依赖图：`apps/web → packages/api → packages/db`，`packages/mcp → packages/api → packages/db`。

```
surety/
├── apps/
│   ├── web/           # Next.js 薄壳（路由、auth、SSR、UI 组件）
│   └── worker/        # Cloudflare Worker D1 proxy（独立，无内部依赖）
├── packages/
│   ├── db/            # @surety/db — Schema + DB 连接 + Repositories
│   ├── api/           # @surety/api — Framework-agnostic 业务逻辑
│   └── mcp/           # @surety/mcp — MCP Server（调用 @surety/api）
├── package.json       # Workspace root
├── tsconfig.base.json # 共享 TS strict 配置
└── bunfig.toml
```

**关键原则**：`apps/web` 和 `packages/mcp` 不直接操作数据库，只通过 `@surety/api` 访问数据。

### 数据库架构

- **运行时（生产/E2E）**：Next.js → sqlite-proxy → Cloudflare Worker → D1 binding
- **单元测试**：bun:sqlite `:memory:` (无网络)
- **E2E 测试**：远程 D1 test 数据库 (`surety-db-test`，Worker binding `DB_TEST`，`SURETY_TARGET_DB=test`)
- **管理面**：drizzle-kit + d1-http driver (开发时 schema push)
- **Repo 模式**：Factory pattern `createMembersRepo(db)` — request-scoped DB 注入
- **无本地 SQLite 运行时**：所有非测试路径都走远程 D1

## 四层测试框架

| 层级 | 工具 | 触发时机 | 要求 |
|------|------|----------|------|
| UT | bun test | pre-commit | 覆盖率 90%+ |
| Lint | eslint | pre-commit | 零错误零警告 |
| Typecheck | tsc --noEmit | pre-commit | 零类型错误 |
| API E2E | bun run test:e2e | pre-push | 100% API 覆盖 (port 7016) |
| UI E2E | bun run test:e2e:ui | 按需执行 | Playwright + Chromium (port 7017) |

### E2E 隔离约束

所有 E2E suite（API、UI、MCP）共用一个远程 D1 test 数据库 (`surety-db-test`)。每个 runner 启动时执行 `seed-remote.ts` 清空并重新 seed，因此 **E2E suite 不可并行运行**。串行执行即可保证数据隔离。

### 测试文件自动发现

`bunfig.toml` 配置 `pathIgnorePatterns` 排除 E2E 文件（`**/e2e/**` 和 `**/*.e2e.test.ts`），单元测试通过 glob 自动发现。新增测试文件无需手动维护列表。E2E runner 通过 `--path-ignore-patterns __none__` 覆盖 bunfig 配置。

### 核心原则

1. **尽早发现** — 不积累技术债
2. **自主解决** — 不依赖人工 review 发现低级错误
3. **质量门禁** — 问题代码无法进入主分支

## 常用命令

```bash
bun dev              # 开发服务器 (7012)
bun run build        # 生产构建
bun test             # 单元测试 (含 MCP)
bun test --coverage  # 测试覆盖率
bun run test:mcp     # MCP 单元测试
bun run test:mcp:e2e # MCP E2E 测试
bun run test:e2e     # API E2E 测试 (port 7016)
bun run test:e2e:ui  # Playwright 浏览器 E2E 测试 (port 7017)
bun run lint         # ESLint
bun run db:push      # 推送 schema
bun run db:studio    # 数据库可视化
bun run mcp          # 启动 MCP Server (stdio)
```

## Worker Deployment (D1 Proxy)

Worker 源码在 `apps/worker/` 目录，部署到 Cloudflare Workers，作为 Next.js → D1 的中间代理。

### 基础信息

| 项目 | 值 |
|------|------|
| Worker 名称 | `surety` |
| Worker URL | `https://surety.<your-account>.workers.dev` |
| Custom Domain | `<your-custom-domain>` |
| D1 Database | `surety-db` (`<your-database-id>`) |
| Liveness | `GET /api/live` (no auth, no cache, 返回 version + D1 状态) |

### 部署命令

```bash
cd apps/worker && bun install          # 安装依赖
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

### Secret 管理

```bash
# 设置 Worker 共享密钥
echo "<secret>" | cd apps/worker && bunx wrangler secret put WORKER_SHARED_SECRET
```

### 环境变量 (Next.js 侧)

`.env` 中需要配置：
```
SURETY_WORKER_URL=<your-worker-url>
SURETY_WORKER_SECRET=<worker_shared_secret>
```

`packages/db/src/index.ts` 在非测试环境下必须配置这两个变量，否则 `getDbForRequest()` 会抛出错误。所有非测试路径都走远程 D1，无本地 SQLite 运行时 fallback。

E2E 测试额外需要：
```
SURETY_TARGET_DB=test       # 指向 D1 test 数据库 (surety-db-test)
E2E_SKIP_AUTH=true          # 跳过认证（E2E runner 自动设置）
```

安全机制：当 `E2E_SKIP_AUTH=true` 时，`resolveTargetDb()` 强制要求设置 `SURETY_TARGET_DB`，防止 E2E 意外连接 production D1。

## Version Release Checklist

1. Read current version from `package.json`, apply the requested bump (default: patch)
2. Update **all version references** per this checklist:

   | File | What to update |
   |------|---------------|
   | `package.json` | `"version"` field |
   | `apps/web/src/app/api/live/route.ts` | fallback via `APP_VERSION` (auto, no manual change needed) |
   | `apps/web/src/services/backy.ts` | fallback via `APP_VERSION` (auto, no manual change needed) |
   | `packages/mcp/src/index.ts` | MCP server version via `APP_VERSION` (auto, no manual change needed) |
   | `apps/web/src/__tests__/version.test.ts` | reads from package.json (auto, no manual change needed) |

3. Commit: `chore: bump version to x.y.z`
4. Push (triggers deployment)
5. Create annotated tag: `git tag -a vx.y.z -m "vx.y.z"`
6. Push tags: `git push --tags`

Verification: `rg '旧版本号' --glob '*.ts' --glob '*.tsx'` to catch stragglers.

## Retrospective

- **主动维护文档结构**：docs 目录下文件使用编号命名（如 `01-xxx.md`、`02-xxx.md`），便于阅读顺序；同时在根目录 README.md 中维护项目结构树，保持文档与代码同步更新。
- **Bun 特有 API 不可在 Next.js Server Runtime 使用**：`Bun.password.hash/verify` 是 Bun 独有 API，Next.js 的 server runtime 使用 Node.js 兼容层，`Bun` 全局对象不存在。此问题在开发阶段因 `bun dev` 运行正常而被掩盖，部署后在 API route 中触发 `ReferenceError`。解决方案：使用 `node:crypto` 的 `scrypt` + `timingSafeEqual` 替代。教训：在 Bun + Next.js 技术栈中，API route / middleware 代码必须只使用 Node.js 标准 API，Bun 特有 API 仅限构建脚本和独立进程使用。
- **SQLite .dump 导入 D1 必须带显式列名**：`sqlite3 .dump` 生成的 `INSERT INTO table VALUES(...)` 不含列名，按源库的列顺序排列。但 `drizzle-kit push` 创建的 D1 表列顺序由 schema.ts 定义顺序决定，与历史 SQLite 的列顺序不同。直接导入会导致值错位，触发 NOT NULL constraint 或数据写入错误列。解决方案：用脚本生成 `INSERT INTO table (col1, col2, ...) VALUES(...)` 格式。教训：跨数据库迁移数据时，永远不要依赖隐式列顺序。
- **sqlite-proxy "get" 方法的行映射陷阱**：Drizzle sqlite-proxy 的 callback 返回 `{ rows }` 时，`method === "get"` 期望 `rows` 是单个扁平行 `[1, "张伟", ...]`，而 `method === "all"` 期望行数组 `[[1, ...], [2, ...]]`。原实现用 `rows.slice(0,1)` 处理 "get"，但这返回 `[[1, "张伟", ...]]`（仍是数组包数组），导致 `.returning().get()` 返回 `id` 时得到整行数组而非标量值。修复：`method === "get" ? rows[0] : rows`。教训：sqlite-proxy 的 callback 返回格式文档不充分，必须读 `drizzle-orm/sqlite-proxy/session.cjs` 中的 `mapGetResult` 源码确认期望格式。
- **移除本地 SQLite 运行时的分阶段策略**：8 个原子 commit 从安全 guard → D1 dev 创建 → seed 脚本 → E2E 迁移 → UI 删除 → health check 异步化 → 本地代码删除 → 清理。关键决策：(1) 先加 E2E safety guard（Phase 1）防止迁移过程中 E2E 意外连 production；(2) E2E 全部走远程 D1 dev 而非本地文件，统一数据路径；(3) UT 保持 `bun:sqlite :memory:` 零改动（481+ test）。教训：大规模基础设施迁移必须先部署防护网再拆旧路径，每个 commit 独立可验证。