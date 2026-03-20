# SQLite → Cloudflare D1 Migration

## Overview

将 Surety 的数据库从本地 SQLite 文件迁移到 Cloudflare D1，通过 **Cloudflare Worker proxy** 访问 D1。部署架构（Railway）保持不变。

- **运行时访问**：Next.js → Worker proxy → D1 binding（推荐路径，无需账户级 Token）
- **管理面访问**：`drizzle-kit` + `d1-http` driver 做 schema push/migrate（账户级 API Token，仅开发时使用）

### Goals

- 数据存储从本地文件系统迁移到 Cloudflare D1
- 线上（Railway）和本地开发环境通过同一个 Worker proxy 访问 D1
- 现有数据完整保留和迁移
- MCP Server 通过 Worker proxy 访问数据
- 项目定位从"本地化"转变为"Self-host"

### Non-goals

- 不迁移 Next.js 部署平台（保持 Railway）
- 不将 Next.js 部署到 Cloudflare Workers/Pages

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
┌─ Railway ──────────┐     ┌─ Local Dev ──────────┐
│  Next.js App        │     │  Next.js App          │
│    ↓ sqlite-proxy   │     │    ↓ sqlite-proxy     │
└────┼────────────────┘     └────┼──────────────────┘
     │                           │
     └──────────┬────────────────┘
                ↓
   ┌─ Cloudflare Worker proxy ─────────┐
   │  Auth (shared secret)              │
   │  Rate limit                        │
   │  /query  → D1 binding (prepared)   │
   │  /batch  → D1 binding (batch)      │
   │  /health → D1 binding (SELECT 1)   │
   │                                    │
   │  Request header: X-Target-DB       │
   │    → surety-db | surety-db-*-e2e   │
   └────┼───────────────────────────────┘
        ↓
   ┌─ Cloudflare D1 ──────────────────────────┐
   │  surety-db           (production)         │
   │  surety-db-api-e2e   (API E2E test)       │
   │  surety-db-ui-e2e    (Playwright E2E)     │
   │  surety-db-mcp-e2e   (MCP E2E test)       │
   └───────────────────────────────────────────┘

   Management plane (dev-time only):
   ┌─ Developer Machine ─────────────────────────┐
   │  drizzle-kit push/migrate (d1-http driver)   │
   │  wrangler d1 execute (import/export)         │
   │    ↓ CF Account API Token                    │
   │  Cloudflare D1 REST API                      │
   └──────────────────────────────────────────────┘
```

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime access path | `sqlite-proxy` → Worker proxy → D1 binding | 应用不持有账户级 D1 Token；Worker 层可鉴权/限流/日志；符合 CF 推荐用法；后续换实现应用层改动最小 |
| Schema management | `drizzle-kit` with `driver: "d1-http"` | 仅开发时用账户级 API Token 做 push/migrate/studio |
| Database count | 1 production + 3 isolated E2E | 生产数据安全隔离；不同类型 E2E 不互相干扰 |
| Multi-db switching | **Request-scoped**：每个请求通过 header 显式指定目标库 | 消除全局可变状态 `process.env.SURETY_DB`；并发安全 |
| Unit test DB | `:memory:` SQLite (本地 `bun:sqlite`) | 单元测试不走网络，保持极速 |
| Transaction support | Worker 内部 D1 `batch()` | D1 binding 的 `batch()` 是原子操作；Worker proxy 暴露 `/batch` 端点 |
| MCP Server | 通过 Worker proxy 访问 | 与主应用共享同一 Worker，无需独立 D1 Token |
| **Repo DB injection** | **Factory pattern**: `createMembersRepo(db)` | Repo 不再模块级导入全局 `db`；调用方传入 request-scoped db instance |

---

## Repository DB Injection Design

### Problem

当前所有 repository 在模块顶层导入全局 `db`：

```typescript
// src/db/repositories/members.ts (BEFORE)
import { db } from "../index";           // ← module-level global import

export const membersRepo = {
  findAll(): Member[] {
    return db.select().from(members).all(); // ← uses global db
  },
  // ...
};
```

如果只把方法改成 async 但保留模块级 `import { db }`，request-scoped 设计无法穿透到 repo 层——要么退回全局可变状态，要么用 `AsyncLocalStorage` 隐式传递（增加复杂度）。

### Decision: Factory Pattern

每个 repo 改为 **factory function**，由调用方传入 db instance：

```typescript
// src/db/repositories/members.ts (AFTER)
import { eq } from "drizzle-orm";
import { members, type Member, type NewMember } from "../schema";
import type { DbInstance } from "../index";

export function createMembersRepo(db: DbInstance) {
  return {
    async findAll(): Promise<Member[]> {
      return db.select().from(members).all();
    },

    async findById(id: number): Promise<Member | undefined> {
      return db.select().from(members).where(eq(members.id, id)).get();
    },

    async create(data: NewMember): Promise<Member> {
      return db.insert(members).values(data).returning().get();
    },

    async update(id: number, data: Partial<NewMember>): Promise<Member | undefined> {
      return db.update(members).set({ ...data, updatedAt: new Date() })
        .where(eq(members.id, id)).returning().get();
    },

    async delete(id: number): Promise<boolean> {
      const result = await db.delete(members).where(eq(members.id, id)).run();
      return (result as unknown as { changes: number }).changes > 0;
    },
  };
}

export type MembersRepo = ReturnType<typeof createMembersRepo>;
```

### Request Flow (API route → repo)

```typescript
// src/app/api/members/route.ts (AFTER)
import { getDbForRequest } from "@/db";
import { createMembersRepo } from "@/db/repositories/members";

export async function GET(request: Request) {
  const db = getDbForRequest(request);          // request-scoped
  const membersRepo = createMembersRepo(db);    // scoped repo
  const members = await membersRepo.findAll();  // async
  return Response.json(members);
}
```

### Convenience: `createAllRepos(db)`

`src/db/repositories/index.ts` 导出一个 helper 一次性创建全部 repo：

```typescript
// src/db/repositories/index.ts (AFTER)
export function createAllRepos(db: DbInstance) {
  return {
    members: createMembersRepo(db),
    insurers: createInsurersRepo(db),
    assets: createAssetsRepo(db),
    policies: createPoliciesRepo(db),
    beneficiaries: createBeneficiariesRepo(db),
    payments: createPaymentsRepo(db),
    cashValues: createCashValuesRepo(db),
    coverageItems: createCoverageItemsRepo(db),
    settings: createSettingsRepo(db),
  };
}

export type AllRepos = ReturnType<typeof createAllRepos>;
```

API route 可简化为：

```typescript
const db = getDbForRequest(request);
const { members, policies } = createAllRepos(db);
const allMembers = await members.findAll();
```

### Unit Test Compatibility

单元测试中 `createTestDb()` 返回 `:memory:` db instance，直接传入 factory：

```typescript
// test
const db = createTestDb();
const membersRepo = createMembersRepo(db);
await membersRepo.create({ name: "张三", ... });
const all = await membersRepo.findAll();
expect(all).toHaveLength(1);
```

无需 mock，无需 AsyncLocalStorage，无需全局状态。

### Why Not AsyncLocalStorage

| Approach | Pros | Cons |
|----------|------|------|
| **Factory (chosen)** | 显式依赖、可测试、零 magic | 每个 route handler 多一行 `createAllRepos(db)` |
| AsyncLocalStorage | 调用方不感知 db 来源 | 隐式依赖、调试困难、Bun 兼容性待验证、MCP Server 不在 Next.js 请求链中 |
| Global Proxy (current) | 零改动 | 并发不安全、全局可变状态、测试隔离差 |

Factory 是最显式、最安全的选择。额外的一行代码是值得的。

---

## Worker Proxy Design

### 概述

一个轻量 Cloudflare Worker，绑定多个 D1 数据库，暴露有限的 SQL 执行接口。应用侧通过 shared secret 鉴权。

### 目录结构

```
worker/
├── src/
│   ├── index.ts          # Worker entry, routing
│   ├── auth.ts           # Shared secret verification
│   ├── routes/
│   │   ├── query.ts      # POST /query — single prepared statement
│   │   ├── batch.ts      # POST /batch — atomic multi-statement
│   │   └── health.ts     # GET /health — SELECT 1
│   └── db.ts             # D1 binding resolver (by request header)
├── wrangler.toml          # D1 bindings, secrets
├── package.json
└── tsconfig.json
```

### API 端点

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/query` | 执行单条 prepared statement | Shared secret |
| POST | `/batch` | 执行多条 prepared statement（原子） | Shared secret |
| GET | `/health` | Worker + D1 存活检查 | None |

### 请求/响应格式

**POST /query**

```json
// Request
{
  "sql": "SELECT * FROM members WHERE id = ?",
  "params": [1]
}

// Response
{
  "success": true,
  "results": [{ "id": 1, "name": "张三", ... }],
  "meta": { "changes": 0, "duration": 1.2 }
}
```

**POST /batch**

```json
// Request
{
  "statements": [
    { "sql": "DELETE FROM members WHERE id = ?", "params": [1] },
    { "sql": "INSERT INTO members (name, ...) VALUES (?, ...)", "params": ["李四", ...] }
  ]
}

// Response
{
  "success": true,
  "results": [
    { "results": [], "meta": { "changes": 1 } },
    { "results": [{ "id": 2, ... }], "meta": { "changes": 1 } }
  ]
}
```

### 鉴权

```
Authorization: Bearer <WORKER_SHARED_SECRET>
```

Worker 的 `WORKER_SHARED_SECRET` 通过 `wrangler secret put` 设置。应用侧通过环境变量 `SURETY_WORKER_SECRET` 持有同一值。

### 多库路由

Worker 根据请求头 `X-Target-DB` 选择 D1 binding：

| Header Value | D1 Binding | Purpose |
|---|---|---|
| `production` (default) | `DB_PROD` | 生产数据 |
| `api-e2e` | `DB_API_E2E` | API E2E 测试 |
| `ui-e2e` | `DB_UI_E2E` | Playwright E2E 测试 |
| `mcp-e2e` | `DB_MCP_E2E` | MCP E2E 测试 |

**wrangler.toml 示例**：

```toml
name = "surety-db-proxy"
main = "src/index.ts"
compatibility_date = "2024-09-26"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB_PROD"
database_name = "surety-db"
database_id = "<prod-db-id>"

[[d1_databases]]
binding = "DB_API_E2E"
database_name = "surety-db-api-e2e"
database_id = "<api-e2e-db-id>"

[[d1_databases]]
binding = "DB_UI_E2E"
database_name = "surety-db-ui-e2e"
database_id = "<ui-e2e-db-id>"

[[d1_databases]]
binding = "DB_MCP_E2E"
database_name = "surety-db-mcp-e2e"
database_id = "<mcp-e2e-db-id>"
```

---

## Application-side DB Client Design

### `src/db/worker-db-client.ts` (new file)

封装对 Worker proxy 的 HTTP 调用，提供给 `sqlite-proxy` 使用。

```
WorkerDbClient
├── constructor(workerUrl, sharedSecret, targetDb)
├── query(sql, params) → Promise<{ rows: any[], meta }>
│   └── POST <workerUrl>/query  +  X-Target-DB header
├── batch(statements[]) → Promise<{ rows: any[], meta }[]>
│   └── POST <workerUrl>/batch  +  X-Target-DB header
└── health() → Promise<boolean>
    └── GET <workerUrl>/health
```

**Request-scoped 创建**：不再使用全局单例。每个请求根据 cookie/env 确定 `targetDb`，创建对应的 client 实例（实际可用轻量 pool/cache）。

### 环境变量

| Variable | Purpose | Required |
|----------|---------|----------|
| `SURETY_WORKER_URL` | Worker proxy URL (e.g., `https://surety-db-proxy.<account>.workers.dev`) | Yes |
| `SURETY_WORKER_SECRET` | Shared secret for Worker auth | Yes |
| `SURETY_TARGET_DB` | Override target DB (用于 E2E 测试启动 dev server) | No, default `production` |

管理面（仅 `drizzle-kit` 使用）：

| Variable | Purpose | Required |
|----------|---------|----------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account identifier | drizzle-kit only |
| `CLOUDFLARE_DATABASE_ID` | Target D1 database ID | drizzle-kit only |
| `CLOUDFLARE_D1_TOKEN` | API token with D1 Edit permission | drizzle-kit only |

### `src/db/index.ts` (rewrite)

```
createDatabase(targetDb?)
├── 构建 WorkerDbClient(workerUrl, secret, targetDb)
├── 创建 drizzle(sqlite-proxy query callback, batch callback)
└── 返回 async DbInstance

getDbForRequest(request | targetDb)
├── 从 cookie 或参数确定 targetDb
├── 从 cache 获取或创建 DbInstance
└── 返回 request-scoped DbInstance
```

**关键变化**：
- **移除全局可变状态**：不再有 `process.env.SURETY_DB`、`currentDbFile`、全局 `sqlite`/`dbInstance` 变量
- **Request-scoped**：API route 通过 `getDbForRequest(request)` 获取 db instance
- **移除**：`resolveDbPath()`, `DATABASE_FILES`, `PROTECTED_FILES`, `getRawSqlite()`, `switchDatabase()`
- **保留 `createTestDb()`**：单元测试继续用本地 `:memory:` SQLite（`bun:sqlite`），保持极速
- `DbInstance` 所有 `.all()` / `.get()` / `.run()` 返回 `Promise`

### sqlite-proxy 回调实现

```typescript
import { drizzle } from "drizzle-orm/sqlite-proxy";

function createRemoteDb(client: WorkerDbClient) {
  return drizzle(
    // single query
    async (sql, params, method) => {
      const result = await client.query(sql, params);
      return { rows: method === "get" ? result.rows.slice(0, 1) : result.rows };
    },
    // batch
    async (queries) => {
      const results = await client.batch(
        queries.map(q => ({ sql: q.sql, params: q.params }))
      );
      return results.map(r => ({ rows: r.rows }));
    }
  );
}
```

---

## Affected Files — Complete Inventory

### New files

| File | Purpose |
|------|---------|
| `worker/src/index.ts` | Worker entry, routing |
| `worker/src/auth.ts` | Shared secret verification |
| `worker/src/db.ts` | D1 binding resolver by `X-Target-DB` header |
| `worker/src/routes/query.ts` | `/query` endpoint |
| `worker/src/routes/batch.ts` | `/batch` endpoint |
| `worker/src/routes/health.ts` | `/health` endpoint |
| `worker/wrangler.toml` | D1 bindings, secrets config |
| `worker/package.json` | Worker dependencies |
| `worker/tsconfig.json` | Worker TypeScript config |
| `src/db/worker-db-client.ts` | Application-side HTTP client for Worker proxy |

### Critical (rewrite)

| File | Change | Reason |
|------|--------|--------|
| `src/db/index.ts` | **Rewrite** | 移除本地 SQLite driver；移除全局可变状态；request-scoped client via `sqlite-proxy` + Worker proxy |
| `src/db/backup.ts` | **Rewrite** | `getRawSqlite()` 不再可用；改用 Drizzle ORM 查询 + Worker `/batch` 端点 |
| `drizzle.config.ts` | **Update** | `driver: "d1-http"` + Cloudflare management credentials |
| `.env.example` | **Update** | 新增 `SURETY_WORKER_URL`, `SURETY_WORKER_SECRET`；管理面变量 |

### Repository layer (9 files — global singleton → factory + async)

| File | Change |
|------|--------|
| `src/db/repositories/members.ts` | `membersRepo` → `createMembersRepo(db)`; all methods async |
| `src/db/repositories/insurers.ts` | `insurersRepo` → `createInsurersRepo(db)`; all methods async |
| `src/db/repositories/assets.ts` | `assetsRepo` → `createAssetsRepo(db)`; all methods async |
| `src/db/repositories/policies.ts` | `policiesRepo` → `createPoliciesRepo(db)`; all methods async |
| `src/db/repositories/beneficiaries.ts` | `beneficiariesRepo` → `createBeneficiariesRepo(db)`; all methods async |
| `src/db/repositories/payments.ts` | `paymentsRepo` → `createPaymentsRepo(db)`; all methods async |
| `src/db/repositories/cashValues.ts` | `cashValuesRepo` → `createCashValuesRepo(db)`; all methods async |
| `src/db/repositories/coverageItems.ts` | `coverageItemsRepo` → `createCoverageItemsRepo(db)`; all methods async |
| `src/db/repositories/settings.ts` | `settingsRepo` → `createSettingsRepo(db)`; all methods async |
| `src/db/repositories/index.ts` | Add `createAllRepos(db)` helper; remove global re-exports |

### API routes (add `await` + request-scoped db via factory)

| File | Repo calls |
|------|-----------|
| `src/app/api/members/route.ts` | `membersRepo.findAll/create` |
| `src/app/api/members/[id]/route.ts` | `membersRepo.findById/update/delete` |
| `src/app/api/policies/route.ts` | `policiesRepo.findAll/create`, `membersRepo.findAll`, `assetsRepo.findAll` |
| `src/app/api/policies/[id]/route.ts` | `policiesRepo.findById/update/delete`, `membersRepo.findAll`, `assetsRepo.findAll` |
| `src/app/api/policies/[id]/beneficiaries/route.ts` | `beneficiariesRepo.findByPolicyId/create/replaceForPolicy` |
| `src/app/api/policies/[id]/payments/route.ts` | `paymentsRepo.findByPolicyId/create/update/deleteByPolicyId` |
| `src/app/api/policies/[id]/coverage-items/route.ts` | `coverageItemsRepo.findByPolicyId/replaceForPolicy` |
| `src/app/api/policies/[id]/coverage-items/[itemId]/route.ts` | `coverageItemsRepo.*` |
| `src/app/api/assets/route.ts` | `assetsRepo.findAll/create` |
| `src/app/api/assets/[id]/route.ts` | `assetsRepo.findById/update/delete` |
| `src/app/api/insurers/route.ts` | `insurersRepo.findAll/create` |
| `src/app/api/insurers/[id]/route.ts` | `insurersRepo.findById/update/delete` |
| `src/app/api/settings/route.ts` | `settingsRepo.findAll/set` |
| `src/app/api/settings/[key]/route.ts` | `settingsRepo.get/set/delete` |
| `src/app/api/settings/2fa/status/route.ts` | TOTP via `settingsRepo` |
| `src/app/api/settings/2fa/setup/route.ts` | TOTP via `settingsRepo` |
| `src/app/api/settings/2fa/verify-setup/route.ts` | TOTP via `settingsRepo` |
| `src/app/api/settings/2fa/disable/route.ts` | TOTP via `settingsRepo` |
| `src/app/api/settings/backy/route.ts` | `settingsRepo.get/set` |
| `src/app/api/settings/backy/push/route.ts` | `buildBackup()`, `settingsRepo` |
| `src/app/api/settings/backy/test/route.ts` | `settingsRepo` |
| `src/app/api/settings/backy/history/route.ts` | `settingsRepo` |
| `src/app/api/backup/route.ts` | `buildBackup()`, `restoreBackup()` |
| `src/app/api/database/switch/route.ts` | DB switching logic rewrite (cookie → `targetDb`) |
| `src/app/api/dashboard/route.ts` | `policiesRepo`, `membersRepo` |
| `src/app/api/coverage-lookup/route.ts` | `membersRepo`, `policiesRepo`, `insurersRepo`, `assetsRepo` |
| `src/app/api/renewal-calendar/route.ts` | `policiesRepo.findAll`, `membersRepo.findAll` |
| `src/app/api/live/route.ts` | Health check async |
| `src/app/api/auth/verify-2fa/route.ts` | `getDbForRequest()`, `getTotpService()` → `settingsRepo` |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth config (may need DB for callbacks) |

### Server components and lib

| File | Change | Reason |
|------|--------|--------|
| `src/app/page.tsx` | `ensureDatabaseFromCookie()` → `getDbForRequest()` | Request-scoped DB access |
| `src/lib/dashboard-data.ts` | `policiesRepo.findAll()` / `membersRepo.findAll()` → add `await` | Dynamic import + async repo |
| `src/lib/totp.ts` | Adapter: `settingsRepo.get/set/delete` → add `await` | TOTP store adapter async |
| `src/lib/api-helpers.ts` | `ensureDbFromRequest()` → return request-scoped client | 移除全局 env 切换 |
| `src/lib/health.ts` | `SELECT 1` → async via Worker proxy | No more raw SQLite |
| `src/services/backy.ts` | `buildBackup()` call → `await` | Backup async |
| `src/proxy.ts` | 移除 `process.env.SURETY_DB` 切换 | Request-scoped; DB routing via header |

### MCP Server

| File | Change |
|------|--------|
| `mcp/guard.ts` | `settingsRepo.get()` → `await settingsRepo.get()` |
| `mcp/tools/members.ts` | All repo calls → async |
| `mcp/tools/policies.ts` | All repo calls → async |
| `mcp/tools/assets.ts` | All repo calls → async |
| `mcp/tools/coverage.ts` | All repo calls → async |
| `mcp/server.ts` | Tool handlers → async |

### Scripts

| File | Change |
|------|--------|
| `src/db/seed.ts` | seed functions → async |
| `src/db/seed-example.ts` | seed functions → async |
| `scripts/seed-e2e.ts` | 改为通过 Worker proxy 清空 + 种子 |
| `scripts/run-e2e.ts` | 设置 `SURETY_TARGET_DB` 而非 `SURETY_DB` |
| `scripts/run-e2e-ui.ts` | 同上 |
| `scripts/e2e-utils.ts` | 移除 WAL/SHM 文件清理逻辑 |
| `scripts/import-csv.ts` | **不改**（保持本地 SQLite，离线迁移工具） |

### Cleanup / Low impact

| File | Change |
|------|--------|
| `database/` directory | 保留 `.db` 文件作为迁移源；迁移完成后归档 |
| `Dockerfile` | 移除 `python3 make g++`（不再编译 native module）；移除 `/data` volume |
| `package.json` | 移除 `better-sqlite3`、`@types/better-sqlite3` from dependencies |
| `src/components/layout/db-selector.tsx` | UI 文案更新：production/api-e2e/ui-e2e/mcp-e2e |

### Test files (async adaptation)

| File Pattern | Count | Change |
|---|---|---|
| `src/__tests__/db/*.test.ts` | ~9 | Repo 调用加 `await` |
| `src/__tests__/backup.test.ts` | 1 | Backup/restore tests rewrite (no raw SQLite) |
| `src/__tests__/totp-module.test.ts` | 1 | `settingsRepo` calls → async |
| `src/__tests__/backy-service.test.ts` | 1 | `buildBackup()` → async |
| `src/__tests__/health.test.ts` | 1 | Health check → async |
| `src/__tests__/proxy-logic.test.ts` | 1 | DB routing logic update |
| `src/__tests__/e2e/*.test.ts` | ~14 | 指向各自的 E2E D1 database |
| `e2e/tests/*.spec.ts` | ~9 | Playwright tests → `surety-db-ui-e2e` |
| `mcp/__tests__/*.test.ts` | ~6 | MCP tool tests → async |

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

### After (Worker proxy + D1 binding)

Worker 内部使用 D1 binding 的 `batch()` 方法——这是真正的原子操作（D1 保证 batch 内的所有 statement 要么全部成功，要么全部回滚）。

**`restoreBackup()` 策略**：

1. 通过 Worker `/batch` 端点发送所有 DELETE + INSERT 语句
2. Worker 内部将这些语句包装为 `env.DB.batch([...])` 执行
3. 如果任何语句失败，D1 自动回滚整个 batch
4. 如果 batch 因 D1 限制（如语句数上限）无法一次完成，改为分批执行：
   - 先 batch DELETE 所有表
   - 再按 FK 安全顺序分批 INSERT
   - 如果中途失败，使用 D1 Time Travel 恢复到操作前的时间点
5. 所有 INSERT 使用参数绑定（`?` placeholder），**不拼接用户数据到 SQL 字符串**

**影响范围**：仅 `backup.ts` 的 `restoreBackup()` 需要 batch 操作。其他所有操作都是单条 CRUD，无需事务。

---

## Test Strategy — Remote E2E Database Isolation

### Unit Tests (L1) — 本地 `:memory:` 不走网络

单元测试继续使用本地 `:memory:` SQLite（通过 `bun:sqlite`）。

**实现**：`createTestDb()` 在 test 环境下走 `bun:sqlite` + `drizzle-orm/bun-sqlite` 路径，与 Worker proxy / D1 完全隔离。保持：
- 极速执行（无网络延迟）
- 无外部依赖
- 现有 `resetTestDb()` 逻辑不变

**Async 兼容**：Repo 方法统一为 `async`。`await` 一个同步值在 JS 中是安全的（`await 42` === `Promise.resolve(42)`），因此 `await db.select()...` 无论 db 底层是同步 `bun-sqlite` 还是异步 `sqlite-proxy` 都能正确工作。

> ⚠️ 需在 Commit 1 spike test 中验证 Drizzle `bun-sqlite` driver 的 `.all()` / `.get()` 返回值是否可被 `await`。

### E2E Tests — 按类型隔离到独立 D1 数据库

| Test Type | D1 Database | `SURETY_TARGET_DB` | Port |
|-----------|------------|---------------------|------|
| API E2E | `surety-db-api-e2e` | `api-e2e` | 7016 |
| Playwright UI E2E | `surety-db-ui-e2e` | `ui-e2e` | 7017 |
| MCP E2E | `surety-db-mcp-e2e` | `mcp-e2e` | — |

每种 E2E 测试在独立的 D1 数据库上运行，互不干扰。

**测试前清空 + 种子**：

```typescript
// scripts/seed-e2e.ts
async function resetE2EDb(targetDb: string) {
  const client = new WorkerDbClient(workerUrl, secret, targetDb);
  // Worker /batch → D1 batch() — 原子清空
  await client.batch([
    { sql: "DELETE FROM coverage_items", params: [] },
    { sql: "DELETE FROM cash_values", params: [] },
    { sql: "DELETE FROM payments", params: [] },
    { sql: "DELETE FROM beneficiaries", params: [] },
    { sql: "DELETE FROM policies", params: [] },
    { sql: "DELETE FROM assets", params: [] },
    { sql: "DELETE FROM insurers", params: [] },
    { sql: "DELETE FROM members", params: [] },
    { sql: "DELETE FROM settings", params: [] },
  ]);
  // Then seed with test data via Drizzle ORM
}
```

### Lint (L2) — 不变

ESLint 配置不受数据库迁移影响。

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

# Create E2E test databases
wrangler d1 create surety-db-api-e2e
wrangler d1 create surety-db-ui-e2e
wrangler d1 create surety-db-mcp-e2e
```

### Phase 2: Push Schema

```bash
# Use drizzle-kit to push schema to all databases
# (set CLOUDFLARE_DATABASE_ID to each DB's ID in turn)
CLOUDFLARE_DATABASE_ID=<prod-id> bun drizzle-kit push
CLOUDFLARE_DATABASE_ID=<api-e2e-id> bun drizzle-kit push
CLOUDFLARE_DATABASE_ID=<ui-e2e-id> bun drizzle-kit push
CLOUDFLARE_DATABASE_ID=<mcp-e2e-id> bun drizzle-kit push
```

### Phase 3: Export Local Data

```bash
# Export production data (schema + data)
sqlite3 database/surety.db .dump > /tmp/surety-prod-dump.sql

# Export example data (for E2E seed reference)
sqlite3 database/surety.example.db .dump > /tmp/surety-example-dump.sql
```

**导入前预处理**（critical）：

- `sqlite3 .dump` 输出包含 `BEGIN TRANSACTION` / `COMMIT`——D1 不支持，需移除
- 大批量 `INSERT` 语句可能超过 D1 单次请求限制（100KB/statement），需拆分
- `CREATE TABLE` 语句与 `drizzle-kit push` 冲突——如果已 push schema，需从 dump 中移除 DDL（只保留 INSERT）

```bash
# Strip transaction wrappers and DDL, keep only INSERT statements
grep '^INSERT' /tmp/surety-prod-dump.sql > /tmp/surety-prod-data.sql
```

### Phase 4: Import to D1

```bash
# Import production data
wrangler d1 execute surety-db --remote --file=/tmp/surety-prod-data.sql
```

### Phase 5: Verify (not just COUNT)

```bash
# Row counts
wrangler d1 execute surety-db --remote --command="SELECT 'members' AS t, COUNT(*) AS c FROM members UNION ALL SELECT 'policies', COUNT(*) FROM policies UNION ALL SELECT 'insurers', COUNT(*) FROM insurers"

# Spot-check FK relationships
wrangler d1 execute surety-db --remote --command="SELECT p.id, p.policy_number, m.name AS applicant FROM policies p JOIN members m ON p.applicant_id = m.id LIMIT 5"

# Verify autoincrement behavior
wrangler d1 execute surety-db --remote --command="SELECT MAX(id) FROM members"
wrangler d1 execute surety-db --remote --command="INSERT INTO members (name, relation, created_at, updated_at) VALUES ('_test_', 'Self', 0, 0) RETURNING id"
wrangler d1 execute surety-db --remote --command="DELETE FROM members WHERE name = '_test_'"

# Verify settings (especially TOTP keys)
wrangler d1 execute surety-db --remote --command="SELECT key FROM settings"
```

### Railway Migration

Railway 环境需要配置新的环境变量并部署新版本代码。

1. 在 Railway 中设置 `SURETY_WORKER_URL` 和 `SURETY_WORKER_SECRET`
2. 部署新版本代码
3. 验证线上服务正常（全功能回归）
4. 移除 Railway Volume mount（`/data` 目录）
5. 清理 Dockerfile 中的 native module 编译步骤

> **注意**：Railway 线上迁移需确认后再执行。

---

## Atomic Commits Plan

### Commit 1: `feat: add cloudflare worker d1 proxy`

**Files**:
- New: `worker/` 目录 (index.ts, auth.ts, db.ts, routes/query.ts, routes/batch.ts, routes/health.ts)
- New: `worker/wrangler.toml`
- New: `worker/package.json`, `worker/tsconfig.json`

**Test**: Worker 本地测试 (`wrangler dev` + curl)

### Commit 2: `feat: add worker-db-client and sqlite-proxy foundation`

**Files**:
- New: `src/db/worker-db-client.ts`
- New: `src/db/worker-db-client.test.ts`
- Update: `.env.example` (add `SURETY_WORKER_URL`, `SURETY_WORKER_SECRET`)

**Test**: Unit test for WorkerDbClient (mock fetch, verify request/response format)

### Commit 3: `refactor: rewrite db/index.ts for request-scoped d1 access`

**Files**:
- Rewrite: `src/db/index.ts`
  - Production: `sqlite-proxy` + Worker proxy (request-scoped)
  - Test: `bun:sqlite` + `:memory:` (保留)
  - 移除全局 `sqlite`/`dbInstance`/`currentDbFile` 变量
  - 移除 `resolveDbPath`, `DATABASE_FILES`, `PROTECTED_FILES`, `getRawSqlite`
  - 新增 `getDbForRequest()` (request-scoped)
- Update: `drizzle.config.ts` (driver: `d1-http`)

**Test**: Spike test 验证 `await db.select()` 在 bun-sqlite 下的行为

### Commit 4: `refactor: repo factory pattern (members, insurers, assets)`

**Files**:
- Update: `src/db/repositories/members.ts` — `membersRepo` → `createMembersRepo(db)`, all methods async
- Update: `src/db/repositories/insurers.ts` — same pattern
- Update: `src/db/repositories/assets.ts` — same pattern
- Update: corresponding `src/__tests__/db/*.test.ts` — pass `createTestDb()` to factory, add `await`

**Test**: 现有单元测试改用 factory + await，验证通过

### Commit 5: `refactor: repo factory pattern (policies, beneficiaries, payments)`

**Files**:
- Update: `src/db/repositories/policies.ts` — same factory pattern
- Update: `src/db/repositories/beneficiaries.ts` — same factory pattern
- Update: `src/db/repositories/payments.ts` — same factory pattern
- Update: corresponding test files

**Test**: 现有单元测试改用 factory + await，验证通过

### Commit 6: `refactor: repo factory pattern (cashValues, coverageItems, settings)`

**Files**:
- Update: `src/db/repositories/cashValues.ts` — same factory pattern
- Update: `src/db/repositories/coverageItems.ts` — same factory pattern
- Update: `src/db/repositories/settings.ts` — same factory pattern
- Update: `src/db/repositories/index.ts` — add `createAllRepos(db)` helper
- Update: corresponding test files + `src/__tests__/totp-module.test.ts`

**Test**: 现有单元测试改用 factory + await，验证通过

### Commit 7: `refactor: async api routes (members, policies, assets, insurers)`

**Files**:
- Update: `src/app/api/members/route.ts`, `src/app/api/members/[id]/route.ts`
- Update: `src/app/api/policies/route.ts`, `src/app/api/policies/[id]/route.ts`
- Update: `src/app/api/policies/[id]/beneficiaries/route.ts`
- Update: `src/app/api/policies/[id]/payments/route.ts`
- Update: `src/app/api/policies/[id]/coverage-items/route.ts`
- Update: `src/app/api/policies/[id]/coverage-items/[itemId]/route.ts`
- Update: `src/app/api/assets/route.ts`, `src/app/api/assets/[id]/route.ts`
- Update: `src/app/api/insurers/route.ts`, `src/app/api/insurers/[id]/route.ts`
- All routes: `import { db }` → `getDbForRequest(request)` + `createAllRepos(db)`

**Test**: `bun run lint` pass (no floating promises)

### Commit 8: `refactor: async api routes (settings, lookup, calendar, live)`

**Files**:
- Update: `src/app/api/settings/route.ts`, `src/app/api/settings/[key]/route.ts`
- Update: `src/app/api/settings/backy/route.ts`, `.../push/route.ts`, `.../test/route.ts`, `.../history/route.ts`
- Update: `src/app/api/coverage-lookup/route.ts`
- Update: `src/app/api/renewal-calendar/route.ts`
- Update: `src/app/api/dashboard/route.ts`
- Update: `src/app/api/live/route.ts`

**Test**: `bun run lint` pass

### Commit 9: `refactor: async dashboard, totp, auth routes`

**Files**:
- Update: `src/app/page.tsx` (request-scoped DB)
- Update: `src/lib/dashboard-data.ts` (async repo calls)
- Update: `src/lib/totp.ts` (TOTP store adapter → async)
- Update: `src/app/api/auth/verify-2fa/route.ts`
- Update: `src/app/api/settings/2fa/*/route.ts`

**Test**: Unit tests pass; TOTP tests pass

### Commit 10: `refactor: async backup, health, backy service`

**Files**:
- Rewrite: `src/db/backup.ts` (remove raw SQL → Drizzle ORM + Worker `/batch`)
- Update: `src/lib/health.ts` → async via Worker `/health`
- Update: `src/services/backy.ts` → async
- Update: `src/app/api/backup/route.ts`
- Update: corresponding test files

**Test**: Backup/restore unit tests pass

### Commit 11: `refactor: request-scoped db switching, remove global state`

**Files**:
- Update: `src/proxy.ts` (remove `process.env.SURETY_DB`; pass `targetDb` via request context)
- Update: `src/lib/api-helpers.ts` (`ensureDbFromRequest()` → `getDbForRequest()`)
- Update: `src/app/api/database/switch/route.ts` (cookie sets `targetDb` name, no global state)
- Update: `src/components/layout/db-selector.tsx` (UI: production / api-e2e / ui-e2e / mcp-e2e)

**Test**: DB switching behavior test; proxy-logic tests pass

### Commit 12: `refactor: async mcp tools and server`

**Files**:
- Update: `mcp/guard.ts` → `await settingsRepo.get()`
- Update: `mcp/tools/*.ts` (4 files) → async repo calls
- Update: `mcp/server.ts` → async tool handlers
- Update: `mcp/__tests__/*.test.ts`

**Test**: MCP unit tests pass

### Commit 13: `refactor: async seed scripts and e2e utils`

**Files**:
- Update: `src/db/seed.ts` → async
- Update: `src/db/seed-example.ts` → async
- Update: `scripts/seed-e2e.ts` → Worker proxy based reset
- Update: `scripts/e2e-utils.ts` (remove WAL/SHM cleanup)
- Update: `scripts/run-e2e.ts` (set `SURETY_TARGET_DB=api-e2e`)
- Update: `scripts/run-e2e-ui.ts` (set `SURETY_TARGET_DB=ui-e2e`)

**Test**: Seed scripts execute successfully

### Commit 14: `chore: update dockerfile, remove native sqlite deps`

**Files**:
- Update: `Dockerfile` (remove python3/make/g++, remove /data volume)
- Update: `package.json` (remove `better-sqlite3`, `@types/better-sqlite3` from prod deps)

**Test**: `docker build` succeeds

### Commit 15: `test: update e2e tests for isolated d1 databases`

**Files**:
- Update: `src/__tests__/e2e/*.test.ts` → `SURETY_TARGET_DB=api-e2e`
- Update: `e2e/tests/*.spec.ts` → `SURETY_TARGET_DB=ui-e2e`
- Update: `mcp/__tests__/mcp.e2e.test.ts` → `SURETY_TARGET_DB=mcp-e2e`

**Test**: Full test suite pass (`bun run test:all`)

### Commit 16: `docs: update project description for self-host + d1 model`

**Files**:
- Update: `README.md` (SQLite → D1, 本地化 → Self-host, architecture diagram)
- Update: `CLAUDE.md` (技术栈表、常用命令、retrospective)
- Update: `docs/02-database-design.md` (D1 architecture)

**Test**: N/A (docs only)

---

## Rollback Plan

如果迁移过程中发现 Worker proxy 延迟不可接受或有未预见的兼容性问题：

1. 所有本地 `.db` 文件保留在 `database/` 目录中不删除
2. Git history 中保留迁移前的完整代码
3. 可通过 `git revert` 回退到 SQLite 版本
4. D1 数据可通过 `wrangler d1 export` 导出为 SQL，再导入本地 SQLite

---

## Open Questions

1. **Worker proxy 延迟**：每次查询经过一次额外 HTTP 往返（应用 → Worker → D1）。Worker 到 D1 的延迟约 1ms（同 Colo），主要延迟在应用到 Worker 的网络往返（取决于 Railway 和 Worker 的地理位置，预估 50-200ms）。Surety 页面通常触发 1-3 次查询——是否可接受？
2. **D1 Free Plan 配额**：每天 5 million 行读取 / 100,000 行写入（[官方 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)）。家庭工具流量极低，绰绰有余。4 个 D1 数据库 + 频繁 E2E 测试需关注写入消耗。
3. **D1 batch 规模限制**：官方文档未给出固定的 batch statement 数量上限。已知限制为：单条 SQL 最大 100KB、最多 100 个 bound parameter、每次 Worker invocation 最多 1000 次查询（Paid）/ 50 次（Free）、单次查询最长 30 秒（[官方 Limits](https://developers.cloudflare.com/d1/platform/limits/)）。`restoreBackup()` 的实际 batch 规模需按这些限制验证，不应假设固定上限。
4. **`sqlite_sequence` 在 D1 中的行为**：`DELETE FROM sqlite_sequence` 用于重置自增 ID——需验证 D1 是否支持。
