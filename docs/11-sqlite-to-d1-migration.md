# SQLite → Cloudflare D1 Migration

## Overview

将 Surety 的数据库从本地 SQLite 文件迁移到 Cloudflare D1，实现云端数据存储。部署架构（Railway）保持不变，通过 D1 HTTP REST API 远程访问。

### Goals

- 数据存储从本地文件系统迁移到 Cloudflare D1
- 线上（Railway）和本地开发环境指向同一个 D1 数据库
- 现有数据完整保留和迁移
- MCP Server 通过 D1 HTTP API 访问数据
- 项目定位从"本地化"转变为"Self-host"

### Non-goals

- 不迁移部署平台（保持 Railway）
- 不迁移到 Cloudflare Workers/Pages

---

## Architecture

### Before

```
┌─ Railway (Node.js) ──────────┐     ┌─ Local Dev (Bun) ──────────┐
│  Next.js App                  │     │  Next.js App                │
│    ↓ bun:sqlite / better-sql  │     │    ↓ bun:sqlite             │
│  database/surety.db (Volume)  │     │  database/surety.db (local) │
└───────────────────────────────┘     └─────────────────────────────┘
```

### After

```
┌─ Railway (Node.js) ────────┐     ┌─ Local Dev (Bun) ──────┐
│  Next.js App                │     │  Next.js App            │
│    ↓ sqlite-proxy (HTTP)    │     │    ↓ sqlite-proxy       │
│    ↓                        │     │    ↓                     │
└────┼────────────────────────┘     └────┼────────────────────┘
     │                                    │
     └────────────┬───────────────────────┘
                  ↓
        ┌─ Cloudflare ─────────────────────┐
        │  D1: surety-db      (production) │
        │  D1: surety-db-dev  (E2E test)   │
        └──────────────────────────────────┘
```

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime driver | `drizzle-orm/sqlite-proxy` | D1 native binding 仅在 CF Workers 内可用；`d1-http` 仅为 Drizzle Kit 配置选项，非运行时驱动 |
| Schema management | `drizzle-kit` with `driver: "d1-http"` | 支持 `push`/`generate`/`migrate` 直接操作远程 D1 |
| Database count | 2: `surety-db` + `surety-db-dev` | 生产与测试隔离，防止 E2E 测试污染真实数据 |
| Multi-db switching | 保留，cookie 切换 production/dev | UI 切换目标从本地文件切换为 D1 database binding |
| Unit test DB | `:memory:` SQLite (本地) | 单元测试不走网络，保持极速；仅 E2E 测试用远程 D1 dev |
| Transaction support | D1 HTTP batch (拼接 SQL) | HTTP API 不支持 `BEGIN/COMMIT`，但 Surety 的事务场景仅有 backup/restore |
| MCP Server | `sqlite-proxy` + D1 HTTP API | 与主应用共享同一套 D1 client |

---

## Affected Files

### Critical (must change)

| File | Change | Reason |
|------|--------|--------|
| `src/db/index.ts` | **Rewrite** | 替换 `bun:sqlite`/`better-sqlite3` → `sqlite-proxy`；移除文件路径逻辑；新增 D1 HTTP client |
| `src/db/repositories/*.ts` (9 files) | **Async 化** | 所有方法 sync → async（`.all()` / `.get()` / `.run()` 全部返回 Promise） |
| `src/db/backup.ts` | **Rewrite** | `getRawSqlite()` 不再可用；改用 Drizzle ORM 查询 + D1 batch |
| `drizzle.config.ts` | **Update** | `driver: "d1-http"` + Cloudflare credentials |
| `.env.example` | **Update** | 新增 `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_D1_TOKEN` |

### High impact (API routes — add `await`)

| File Pattern | Count | Change |
|---|---|---|
| `src/app/api/members/*/route.ts` | 2 | add `await` to repo calls |
| `src/app/api/policies/*/route.ts` | 2 | add `await` to repo calls |
| `src/app/api/assets/*/route.ts` | 2 | add `await` to repo calls |
| `src/app/api/insurers/*/route.ts` | 2 | add `await` to repo calls |
| `src/app/api/beneficiaries/*/route.ts` | 2 | add `await` to repo calls |
| `src/app/api/payments/*/route.ts` | 2 | add `await` to repo calls |
| `src/app/api/cash-values/*/route.ts` | 2 | add `await` to repo calls |
| `src/app/api/coverage-items/*/route.ts` | 2 | add `await` to repo calls |
| `src/app/api/settings/*/route.ts` | 2 | add `await` to repo calls |
| `src/app/api/backup/route.ts` | 1 | backup/restore async |
| `src/app/api/database/*/route.ts` | 2 | DB switching logic rewrite |
| `src/app/api/dashboard/route.ts` | 1 | add `await` |
| `src/app/api/coverage-lookup/route.ts` | 1 | add `await` |
| `src/app/api/live/route.ts` | 1 | health check async |

### Medium impact

| File | Change |
|------|--------|
| `src/lib/health.ts` | `SELECT 1` → async |
| `src/services/backy.ts` | backup call → async |
| `src/proxy.ts` | 移除 `process.env.SURETY_DB` 文件路径切换；改为 D1 database ID 切换 |
| `src/lib/api-helpers.ts` | `ensureDbFromRequest()` → 选择 D1 database ID |
| `mcp/tools/*.ts` (4 files) | repo calls → async |
| `mcp/server.ts` | tool handlers → async |
| `src/db/seed.ts` | seed functions → async |
| `src/db/seed-example.ts` | seed functions → async |

### Low impact (remove/cleanup)

| File | Change |
|------|--------|
| `database/` directory | 保留 `.db` 文件作为迁移源；迁移完成后归档 |
| `scripts/import-csv.ts` | 保持本地 SQLite（离线迁移工具），不改 |
| `scripts/e2e-utils.ts` | 移除 WAL/SHM 文件清理逻辑 |
| `Dockerfile` | 移除 `python3 make g++`（不再需要编译 native module）；移除 `/data` volume |
| `src/components/layout/db-selector.tsx` | UI 文案更新：production/dev 而非 production/example/test |

### Test files (async adaptation)

| File Pattern | Count | Change |
|---|---|---|
| `src/__tests__/db/*.test.ts` | ~9 | repo 调用加 await |
| `src/__tests__/backup.test.ts` | 1 | backup/restore tests rewrite |
| `src/__tests__/e2e/*.test.ts` | ~14 | E2E 测试指向 `surety-db-dev` |
| `mcp/__tests__/*.test.ts` | ~6 | MCP tool tests async |
| `src/__tests__/totp-module.test.ts` | 1 | settings repo calls async |

---

## D1 HTTP Client Design

### `src/db/d1-client.ts` (new file)

封装 Cloudflare D1 REST API 调用，提供给 `sqlite-proxy` 使用。

```
D1Client
├── constructor(accountId, databaseId, token)
├── query(sql, params) → Promise<{ rows: any[] }>
│   └── POST /accounts/{id}/d1/database/{id}/raw
├── batch(queries[]) → Promise<{ rows: any[] }[]>
│   └── 拼接多条 SQL 为单次请求
└── getConfig() → { accountId, databaseId, token }
```

**环境变量**：

| Variable | Purpose | Required |
|----------|---------|----------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account identifier | Yes |
| `CLOUDFLARE_D1_TOKEN` | API token with D1 Edit permission | Yes |
| `CLOUDFLARE_DATABASE_ID` | Production D1 database ID (`surety-db`) | Yes |
| `CLOUDFLARE_DATABASE_ID_DEV` | Dev/test D1 database ID (`surety-db-dev`) | Yes |

### `src/db/index.ts` (rewrite)

```
createDatabase(databaseId?)
├── 构建 D1Client(accountId, databaseId, token)
├── 创建 drizzle(sqlite-proxy callback, batch callback)
└── 返回 async DbInstance

db (Proxy)
├── test env → createTestDb() (本地 :memory: SQLite, 不变)
└── other env → getDb() → 基于 CLOUDFLARE_DATABASE_ID 或 cookie 选择 D1
```

**关键变化**：
- `DbInstance` 类型变为异步 — 所有 `.all()` / `.get()` / `.run()` 返回 `Promise`
- 移除 `getRawSqlite()` — 不再有本地 SQLite driver
- 移除 `resolveDbPath()` / `DATABASE_FILES` / `PROTECTED_FILES` — 不再有文件路径
- 保留 `createTestDb()` — 单元测试继续用本地 `:memory:` SQLite（bun:sqlite），保持极速
- `switchDatabase()` 变为切换 D1 database ID（而非文件路径）

### sqlite-proxy 回调实现

```typescript
import { drizzle } from "drizzle-orm/sqlite-proxy";

const db = drizzle(
  // single query callback
  async (sql, params, method) => {
    const result = await d1Client.query(sql, params);
    if (method === "get") {
      return { rows: result.rows[0] ? [result.rows[0]] : [] };
    }
    return { rows: result.rows };
  },
  // batch callback
  async (queries) => {
    const results = await d1Client.batch(queries);
    return results;
  }
);
```

---

## Data Migration Strategy

### Phase 1: Create D1 Databases

```bash
# Install wrangler
bun add -g wrangler

# Login to Cloudflare
wrangler login

# Create production database
wrangler d1 create surety-db

# Create dev/test database
wrangler d1 create surety-db-dev
```

### Phase 2: Export Local Data

```bash
# Export production data
sqlite3 database/surety.db .dump > /tmp/surety-prod-dump.sql

# Export example data (for dev DB)
sqlite3 database/surety.example.db .dump > /tmp/surety-example-dump.sql
```

### Phase 3: Import to D1

```bash
# Import production data
wrangler d1 execute surety-db --remote --file=/tmp/surety-prod-dump.sql

# Import example data to dev database
wrangler d1 execute surety-db-dev --remote --file=/tmp/surety-example-dump.sql
```

### Phase 4: Verify

```bash
# Verify production
wrangler d1 execute surety-db --remote --command="SELECT COUNT(*) FROM members"
wrangler d1 execute surety-db --remote --command="SELECT COUNT(*) FROM policies"

# Verify dev
wrangler d1 execute surety-db-dev --remote --command="SELECT COUNT(*) FROM members"
```

### Railway Migration

Railway 环境需要配置新的环境变量（`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_TOKEN`, `CLOUDFLARE_DATABASE_ID`, `CLOUDFLARE_DATABASE_ID_DEV`），并部署新版本代码。迁移步骤：

1. 在 Railway 中设置 D1 相关环境变量
2. 部署新版本代码
3. 验证线上服务正常
4. 移除 Railway Volume mount（`/data` 目录）
5. 清理 Dockerfile 中的 native module 编译步骤

> **注意**：Railway 线上迁移需确认后再执行。

---

## Transaction Handling

### Current (SQLite)

```typescript
// backup.ts — 手动事务
raw.exec("BEGIN TRANSACTION");
try {
  // DELETE all → INSERT all
  raw.exec("COMMIT");
} catch {
  raw.exec("ROLLBACK");
}
```

### After (D1 HTTP)

D1 HTTP API **不支持** `BEGIN/COMMIT/ROLLBACK`。替代方案：

**方案：D1 batch API（拼接 SQL）**

```typescript
// 将多条 DELETE + INSERT 拼接为单次 HTTP 请求
const statements = [
  "DELETE FROM coverage_items",
  "DELETE FROM cash_values",
  // ...
  "INSERT INTO members (...) VALUES (...)",
  // ...
];
// 单次请求发送，D1 内部保证原子性
await d1Client.batch(statements);
```

**影响范围**：仅 `backup.ts` 的 `restoreBackup()` 使用了事务。其他所有操作都是单条 CRUD，无需事务。

**风险评估**：D1 的 batch 拼接 SQL 方式丢失了参数绑定，存在 SQL 注入风险。`restoreBackup()` 的数据来源是用户上传的 JSON 备份文件，需要在 restore 前对所有值做 sanitization，或改为逐条发送（牺牲原子性换安全性）。

> **决策**：restore 改为用 Drizzle ORM 逐条 insert（带参数绑定），外层不做事务。如果中途失败，用 D1 Time Travel 恢复到操作前的时间点。这样既安全又利用了 D1 的内置恢复能力。

---

## Test Strategy

### Unit Tests (L1) — 不走网络

单元测试继续使用本地 `:memory:` SQLite（通过 `bun:sqlite`），不改变。

**实现**：`createTestDb()` 在 test 环境下走原有的 `bun:sqlite` + `drizzle-orm/bun-sqlite` 路径，与 D1 完全隔离。这保持了：
- 极速执行（无网络延迟）
- 无外部依赖
- 现有的 `resetTestDb()` 逻辑不变

**关键问题**：Repository 方法变为 async 后，单元测试也需要 `await`，但底层仍是 `:memory:` SQLite。需要 `sqlite-proxy` 在 test 环境下包装同步 `bun:sqlite` 为 async 接口，或在 `db` Proxy 中对 test env 做特殊处理。

**方案**：test 环境下 `createTestDb()` 使用 `drizzle-orm/bun-sqlite`（同步），但 repo 方法签名统一为 async。由于 `async function` 返回值即使底层是同步的也会被包装为 Promise，这在 Bun test runner 中透明工作。具体做法是 repo 方法全部加 `async` 关键字，底层调用不变 — `await db.select()...` 无论 db 是同步还是异步都能正确工作（同步值被 Promise.resolve 包装）。

> ⚠️ **待验证**：Drizzle ORM 的 `bun-sqlite` driver 返回值是否可以被 `await`。如果 `.all()` 返回的是裸数组而非 Promise，`await` 会将其包装为 `Promise.resolve(array)` — 这在 JS 中是安全的。需要在 commit 1 中用 spike test 验证。

### API E2E Tests (L3) — 指向 `surety-db-dev`

```bash
# E2E 测试通过环境变量指向 dev D1 database
CLOUDFLARE_DATABASE_ID=$CLOUDFLARE_DATABASE_ID_DEV bun run test:e2e
```

E2E 测试前清空 dev 数据库（替代原来的 `resetE2EDb()`）：

```typescript
// scripts/seed-e2e.ts — 改为通过 D1 HTTP API 清空 + 种子
async function resetDevDb() {
  const statements = [
    "DELETE FROM coverage_items",
    "DELETE FROM cash_values",
    // ... (FK-safe order)
  ];
  await d1Client.batch(statements);
  // Then seed with test data
}
```

### Browser E2E Tests (L4) — 同样指向 `surety-db-dev`

Playwright 测试的 dev server 启动时设置 `CLOUDFLARE_DATABASE_ID` 为 dev database ID。

---

## Atomic Commits Plan

### Commit 1: `feat: add d1 http client and sqlite-proxy foundation`

**Files**:
- New: `src/db/d1-client.ts`
- New: `src/db/d1-client.test.ts`
- Update: `package.json` (remove `better-sqlite3`, `@types/better-sqlite3`)
- Update: `.env.example` (add Cloudflare env vars)

**Test**: Unit test for D1Client (mock fetch, verify request format)

### Commit 2: `refactor: rewrite db/index.ts for d1 sqlite-proxy`

**Files**:
- Rewrite: `src/db/index.ts`
  - Production: `sqlite-proxy` + D1 HTTP
  - Test: `bun:sqlite` + `:memory:` (保留)
  - 移除 `resolveDbPath`, `DATABASE_FILES`, `PROTECTED_FILES`, `getRawSqlite`
  - `switchDatabase()` 改为切换 D1 database ID
- Update: `drizzle.config.ts` (driver: `d1-http`)

**Test**: Spike test 验证 `await db.select()` 在 bun-sqlite 下的行为

### Commit 3: `refactor: async repositories (members, insurers, assets)`

**Files**:
- Update: `src/db/repositories/members.ts`
- Update: `src/db/repositories/insurers.ts`
- Update: `src/db/repositories/assets.ts`
- Update: corresponding test files

**Test**: 现有单元测试加 await，验证通过

### Commit 4: `refactor: async repositories (policies, beneficiaries, payments)`

**Files**:
- Update: `src/db/repositories/policies.ts`
- Update: `src/db/repositories/beneficiaries.ts`
- Update: `src/db/repositories/payments.ts`
- Update: corresponding test files

**Test**: 现有单元测试加 await，验证通过

### Commit 5: `refactor: async repositories (cashValues, coverageItems, settings)`

**Files**:
- Update: `src/db/repositories/cashValues.ts`
- Update: `src/db/repositories/coverageItems.ts`
- Update: `src/db/repositories/settings.ts`
- Update: corresponding test files

**Test**: 现有单元测试加 await，验证通过

### Commit 6: `refactor: async api routes (members, insurers, assets, policies)`

**Files**:
- Update: all API route handlers in `src/app/api/` for these entities
- Add `await` to all repo calls

**Test**: `bun run lint` pass (no floating promises)

### Commit 7: `refactor: async api routes (remaining + dashboard + settings)`

**Files**:
- Update: remaining API routes (beneficiaries, payments, cash-values, coverage-items)
- Update: `src/app/api/dashboard/route.ts`
- Update: `src/app/api/settings/*/route.ts`
- Update: `src/app/api/coverage-lookup/route.ts`
- Update: `src/app/api/live/route.ts`

**Test**: `bun run lint` pass

### Commit 8: `refactor: async backup, health, backy service`

**Files**:
- Rewrite: `src/db/backup.ts` (remove raw SQL, use Drizzle ORM)
- Update: `src/lib/health.ts`
- Update: `src/services/backy.ts`
- Update: `src/app/api/backup/route.ts`
- Update: corresponding test files

**Test**: backup/restore unit tests pass

### Commit 9: `refactor: async proxy, db-switching, api-helpers`

**Files**:
- Update: `src/proxy.ts` (D1 database ID switching)
- Update: `src/lib/api-helpers.ts`
- Update: `src/app/api/database/*/route.ts`
- Update: `src/components/layout/db-selector.tsx` (UI: production/dev)

**Test**: DB switching behavior test

### Commit 10: `refactor: async mcp tools and server`

**Files**:
- Update: `mcp/tools/*.ts` (4 files)
- Update: `mcp/server.ts`
- Update: `mcp/__tests__/*.test.ts`

**Test**: MCP unit tests pass

### Commit 11: `refactor: async seed scripts and e2e utils`

**Files**:
- Update: `src/db/seed.ts`
- Update: `src/db/seed-example.ts`
- Update: `scripts/seed-e2e.ts`
- Update: `scripts/e2e-utils.ts` (remove WAL/SHM cleanup)
- Update: `scripts/run-e2e.ts`

**Test**: seed scripts execute successfully

### Commit 12: `chore: update dockerfile, remove native sqlite deps`

**Files**:
- Update: `Dockerfile` (remove python3/make/g++, remove /data volume)
- Update: `package.json` (remove better-sqlite3 from dependencies if not needed for tests)

**Test**: `docker build` succeeds

### Commit 13: `docs: update project description for self-host model`

**Files**:
- Update: `README.md` (SQLite → D1, 本地化 → Self-host)
- Update: `CLAUDE.md` (技术栈表、常用命令、retrospective)
- Update: `docs/02-database-design.md` (D1 architecture)
- New: `docs/11-sqlite-to-d1-migration.md` (this document)

**Test**: N/A (docs only)

### Commit 14: `test: update e2e tests for d1-dev database`

**Files**:
- Update: `src/__tests__/e2e/*.test.ts` (point to surety-db-dev)
- Update: `e2e/` Playwright tests
- Update: `scripts/run-e2e.ts` and `scripts/run-e2e-ui.ts`

**Test**: Full test suite pass (`bun run test:all`)

---

## Rollback Plan

如果迁移过程中发现 D1 HTTP API 延迟不可接受或有未预见的兼容性问题：

1. 所有本地 `.db` 文件保留在 `database/` 目录中不删除
2. Git history 中保留迁移前的完整代码
3. 可通过 `git revert` 回退到 SQLite 版本
4. D1 数据可通过 `wrangler d1 export` 导出为 SQL，再导入本地 SQLite

---

## Open Questions

1. **D1 HTTP API 延迟**：每次查询增加 100-300ms 网络往返。Surety 的页面加载通常触发 1-3 次查询，可能导致页面变慢 300-900ms。是否可接受？
2. **D1 Free Plan 限制**：每天 100,000 行读取 / 1,000 行写入。Surety 作为家庭工具流量极低，应足够。但 E2E 测试频繁执行可能消耗配额。
3. **`sqlite_sequence` 在 D1 中的行为**：`DELETE FROM sqlite_sequence` 用于重置自增 ID。需要验证 D1 是否支持。
