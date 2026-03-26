# 14 — Policy PDF Attachment (R2 Storage)

## Context

Surety 的保单（policies）表有一个 `policyFilePath` 文本字段，但没有实际的文件上传功能。用户需要拖拽上传保单 PDF，附加到保单上，并在页面内直接预览。文件存储在 Cloudflare R2（私有桶），只能通过应用的认证链路访问。

## Architecture

```
Browser (drag-drop → XHR upload → iframe preview)
    │
    ▼
Next.js API  /api/policies/[id]/attachments/*
    │  Session auth + validation
    ▼
CF Worker  /r2/:key  (PUT / GET / DELETE)
    │  Bearer auth + X-Target-DB
    ▼
R2 Bucket  surety (prod) / surety-test (test)
```

**Key decisions:**
- **No public R2 URL** — 所有文件访问走 Next.js → Worker 双重认证
- **Buffering strategy** — Next.js `request.formData()` 会在内存中缓冲整个 multipart body（框架限制，无法绕过）。上传路由在调用 `formData()` 之前先检查 `Content-Length` header，对声明超过 51MB 的请求直接返回 413（不分配内存）。这是 advisory guard——`Content-Length` 可被省略或伪造，真正的权威校验是 `formData()` 之后的 `file.size` 检查。对于没有 `Content-Length` 或伪造的恶意请求，仍会先缓冲再拒绝。完全杜绝内存型 DoS 需要放弃 `formData()` 转为流式 multipart 解析，对家庭应用来说过度设计。随后用 `file.stream()` 流式传输到 Worker，避免二次缓冲。总内存占用约 1x 文件大小。Worker 侧真正 end-to-end streaming（`request.body` → `bucket.put()`）。
- **Browser native PDF viewer** — `<iframe>` + `Content-Disposition: inline`，无需 PDF.js
- **XHR upload** — fetch API 不支持上传进度，50MB 文件必须有进度条

## 1. Worker Extension

### 1.1 wrangler.toml — 新增 R2 binding

```toml
# worker/wrangler.toml (append)
[[r2_buckets]]
binding = "R2_PROD"
bucket_name = "surety"

[[r2_buckets]]
binding = "R2_TEST"
bucket_name = "surety-test"
```

### 1.2 Env type — 新增 R2

**File: `worker/src/db.ts`** — Env interface 添加 R2 字段:

```typescript
export interface Env {
  DB_PROD: D1Database;
  DB_TEST: D1Database;
  R2_PROD: R2Bucket;    // NEW
  R2_TEST: R2Bucket;    // NEW
  WORKER_SHARED_SECRET: string;
}
```

### 1.3 R2 resolver

**New: `worker/src/r2.ts`** — 复用 X-Target-DB header 解析目标 bucket:

```typescript
export function resolveR2(request: Request, env: Env):
  { bucket: R2Bucket } | { error: Response } {
  const targetDb = request.headers.get("X-Target-DB") || "production";
  const bucket = targetDb === "test" ? env.R2_TEST : env.R2_PROD;
  // ...
}
```

### 1.4 R2 routes

**New: `worker/src/routes/r2.ts`**

| Method | Path | Handler | 说明 |
|--------|------|---------|------|
| PUT | `/r2/:key` | `handleR2Put` | Stream `request.body` → `bucket.put()` |
| GET | `/r2/:key` | `handleR2Get` | `bucket.get()` → stream response body |
| DELETE | `/r2/:key` | `handleR2Delete` | `bucket.delete()` → 204 |

Key 可包含 `/`，如 `policies/42/uuid.pdf`，Worker 从 `/r2/` 之后截取全部路径。

**Modify: `worker/src/index.ts`** — 添加 `/r2/*` 路由分发（auth required）

## 2. Database Schema

### 2.1 新增 `attachments` 表

**File: `src/db/schema.ts`** (在现有 schema 文件中新增)

```typescript
export const attachments = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  policyId: integer("policy_id")
    .notNull()
    .references(() => policies.id),
  filename: text("filename").notNull(),        // 原始文件名
  r2Key: text("r2_key").notNull().unique(),     // R2 object key
  contentType: text("content_type").notNull(),  // MIME type
  size: integer("size").notNull(),              // bytes
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

**Index**: `idx_attachments_policy_id` on `policy_id`（在 `initSchema()` 中通过 `CREATE INDEX IF NOT EXISTS` 创建）。`r2_key` 通过 Drizzle `.unique()` 自动保证唯一。

> Note: Drizzle schema 的 `.references()` 声明 FK 关系用于 ORM 类型推导，但 SQLite 的实际 FK enforcement 取决于 `PRAGMA foreign_keys`。D1 默认启用 `foreign_keys=ON`，单元测试的 bun:sqlite 也启用。DB cascade delete 不依赖 FK cascade action（代码显式按顺序删除子表）。

### 2.2 Repository

**New: `src/db/repositories/attachments.ts`** — Factory pattern `createAttachmentsRepo(db)`

Methods:
- `findByPolicyId(policyId)` — 列出保单的所有附件
- `findByIdAndPolicyId(id, policyId)` — 按 ID 查找并验证归属（防 IDOR）
- `create(data)` — 新增记录
- `delete(id)` — 删除记录
- `deleteByPolicyId(policyId)` — 删除保单所有附件记录（返回被删行，用于清理 R2）
- `countByPolicyId(policyId)` — 计数（检查上限）

**Modify: `src/db/repositories/index.ts`** — 注册 `attachments` 到 `createAllRepos()`

## 3. Next.js API Layer

### 3.1 R2 Client

**New: `src/lib/r2-client.ts`**

Worker R2 endpoint 的 fetch wrapper，自动设置 `Authorization: Bearer` + `X-Target-DB` header:

```typescript
export function createR2Client(targetDb: string) {
  return {
    upload(key, body, contentType): Promise<R2UploadResult>,
    download(key): Promise<Response>,
    delete(key): Promise<void>,
  };
}
```

### 3.2 Validation

**New: `src/lib/attachment-validation.ts`**

```typescript
export const ALLOWED_CONTENT_TYPES = ["application/pdf"] as const;
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const MAX_ATTACHMENTS_PER_POLICY = 20; // soft limit (see note below)

export function validateFile(contentType: string, size: number): ValidationResult;
export function validatePdfMagicBytes(file: File): Promise<ValidationResult>;
export function generateR2Key(policyId: number, filename: string): string;
// key format: "policies/{policyId}/{uuid}.{ext}"
// ext extracted from filename, defaults to "pdf"
```

> **Soft limit**: `MAX_ATTACHMENTS_PER_POLICY` 通过 `countByPolicyId()` 预检查实现。两个并发上传可能同时读到 19 → 双双通过 → 实际达到 21。对家庭应用可接受（用户不会并发上传 20 个文件）。严格约束需要 DB 级 CHECK constraint 或事务化 count+insert，复杂度不值得。

### 3.3 API Endpoints

**New: `src/app/api/policies/[id]/attachments/route.ts`**

| Method | Action | 关键逻辑 |
|--------|--------|----------|
| POST | Upload PDF | Content-Length pre-check (413) → parse multipart → validate type/size → validate PDF magic bytes → check count limit (soft) → stream to R2 → insert DB |
| GET | List | Query DB by policyId |

**New: `src/app/api/policies/[id]/attachments/[attachmentId]/route.ts`**

| Method | Action |
|--------|--------|
| DELETE | Delete from DB → best-effort R2 cleanup |

**New: `src/app/api/policies/[id]/attachments/[attachmentId]/file/route.ts`**

| Method | Action |
|--------|--------|
| GET | Stream file from R2 via Worker. `?download=true` → `Content-Disposition: attachment`, 否则 `inline` |

### 3.4 Policy delete cascade

**Modify: `src/app/api/policies/[id]/route.ts`**

DELETE handler 步骤：
1. 查询所有 attachments（收集 R2 keys）
2. 代码显式按顺序删除子表 DB 记录（attachments → beneficiaries → payments → ...），不依赖 SQLite FK cascade action
3. **DB 删除成功后**，`Promise.allSettled` 清理 R2 objects（**best-effort**: R2 失败不影响已完成的 DB 删除，可能留下 orphan R2 objects）

## 4. UI Components

### 4.1 Component tree

```
PolicyDetailDialog (existing)
├── ... existing fields ...
├── AttachmentSection              ← 协调器
│   ├── AttachmentDropZone         ← 拖拽上传 + 进度条
│   ├── AttachmentList             ← 文件列表
│   │   └── item × N (icon + name + size + date + preview/download/delete)
│   └── AttachmentPreviewDialog    ← PDF 预览 (<iframe>)
```

### 4.2 Components

**New: `src/components/attachments/attachment-section.tsx`**

协调器，管理附件列表 state、上传回调、预览/删除 dialog state。使用 `useState` + `useEffect` + `fetch` 模式（与项目现有模式一致，不引入 SWR）。

**New: `src/components/attachments/attachment-drop-zone.tsx`**

使用 `react-dropzone`（~9KB, 零子依赖）处理拖拽：
- Drag active 时边框高亮
- 上传中显示 Progress bar
- 错误信息展示（类型/大小不合规）

**New: `src/components/attachments/attachment-list.tsx`**

每个附件行：`FileText` icon + filename + `formatBytes(size)` + date + 3 个操作按钮（Preview/Download/Delete）

**New: `src/components/attachments/attachment-preview-dialog.tsx`**

`Dialog` + `<iframe src="/api/policies/{id}/attachments/{aid}/file">` 全屏预览，利用浏览器原生 PDF 渲染器。

### 4.3 Upload progress

**New: `src/lib/upload-with-progress.ts`**

XHR wrapper — fetch API 不支持 upload progress，对 50MB 文件必须用 `XMLHttpRequest.upload.onprogress`。

### 4.4 Integration

**Modify: `src/app/policies/policy-detail-dialog.tsx`**

在保单详情底部（现有 `policyFilePath` 区域之后）添加 `<AttachmentSection policyId={policy.id} />`。

### 4.5 New dependency

| Package | 大小 | 用途 |
|---------|------|------|
| `react-dropzone` | ~9KB gzipped | Drag-and-drop 文件处理 |

不需要 PDF.js — 浏览器原生 PDF viewer 通过 iframe 加载已足够。

## 5. Test Plan (六维质量体系)

### L1 Unit (bun test, pre-commit, ≥90%)

| File | Tests |
|------|-------|
| `src/__tests__/attachment-validation.test.ts` | validateFile (valid/type/size/empty), generateR2Key (format/uniqueness/extension) |
| `src/__tests__/r2-client.test.ts` | URL encoding, header setting, error handling (mock fetch) |
| `src/__tests__/db/attachments.test.ts` | Repository CRUD (bun:sqlite :memory:) |
| `worker/src/__tests__/r2.test.ts` | resolveR2 (prod/test routing) |

### L2 API E2E (real HTTP, pre-push)

| Test | Expected |
|------|----------|
| Upload valid PDF | 201 + attachment in list |
| Upload wrong type | 400 |
| Upload oversized | 400 |
| Upload no file | 400 |
| Exceed count limit | 400 |
| GET file | Correct Content-Type + body |
| GET file `?download=true` | `Content-Disposition: attachment` |
| DELETE | 204, then GET → 404 |
| Cross-policy access | 404 (IDOR protection) |

All L2 tests 使用 `X-Target-DB: test` → `surety-test` R2 bucket。

### G1 Static Analysis (pre-commit)
- `tsc --noEmit` — 新文件类型正确
- ESLint strict — 零警告

### G2 Security (pre-push)
- `osv-scanner` — 扫描 react-dropzone
- `gitleaks` — 无硬编码 secret

### D1 Test Isolation
- **R2 buckets**: `surety` (prod) / `surety-test` (test)
- Worker 通过 `X-Target-DB` header 路由到对应 bucket（与 D1 隔离模式一致）
- L2 测试专用 test bucket

### L3 Playwright E2E (on-demand)
- 拖拽上传 → 进度条 → 列表出现 → 点预览 → iframe PDF → 下载 → 删除

## 6. Atomic Commit Sequence

| # | Message | Scope | Status |
|---|---------|-------|--------|
| 1 | `feat: add R2 bucket bindings to Worker` | worker/wrangler.toml, Env type, resolveR2 | ✅ Done |
| 2 | `feat: add Worker R2 route handlers` | worker/src/routes/r2.ts, worker/src/index.ts | ✅ Done |
| 3 | `feat: add attachments schema and repository` | schema, migration, repository, unit test | ✅ Done |
| 4 | `feat: add attachment validation and R2 client` | lib files + unit tests | ✅ Done |
| 5 | `feat: add attachment API routes` | API routes + policy cascade delete | ✅ Done |
| 6 | `feat: add attachment UI components` | components + react-dropzone dep | ✅ Done |
| 7 | `feat: integrate attachments into policy detail` | policy-detail-dialog.tsx + docs update | ✅ Done |
| 8 | `test: add Playwright E2E for attachments` | e2e/ | Deferred |

每个 commit 独立通过 pre-commit hooks (tsc + eslint + L1 tests)。Coverage 91.66% (threshold 90%)。

## 7. Legacy `policyFilePath` Migration

| Phase | Action | When |
|-------|--------|------|
| 1 | 同时显示旧 `policyFilePath` 链接和新附件区 | Commit 7 |
| 2 | Migration script 下载旧 URL 的 PDF → 上传到 R2 | Optional |
| 3 | 移除 `policyFilePath` 字段 | 确认迁移完成后 |

**建议**: 家庭应用保单数量少，Phase 1 + 手动重新上传最务实。

## 8. Security Summary

| Layer | Protection |
|-------|-----------|
| Client | react-dropzone accept filter + validateFile() |
| Next.js API | Type + size + magic bytes + count validation, policy existence check |
| Next.js → Worker | Bearer WORKER_SHARED_SECRET + `duplex: "half"` for streaming |
| Worker | Auth verify, X-Target-DB → bucket isolation |
| R2 | Private bucket, no public URL, binding-only access |
| Preview | `Content-Disposition: inline` + validated Content-Type |
| Filename | RFC 5987 `filename*=UTF-8''...` encoding for non-ASCII filenames |

## 9. R2/DB Consistency Strategy

R2 和 DB 是两个独立存储，无法原子操作。每个路径的失败策略如下：

| Path | 顺序 | Failure mode | 后果 |
|------|------|-------------|------|
| **Upload** | R2 → DB | R2 失败 → 500, 不写 DB | 无 orphan |
| **Upload** | R2 → DB | DB 失败 → 清理 R2 orphan (best-effort) → 500 | 可能留 R2 orphan（无 DB 引用，无害） |
| **Single delete** | DB → R2 | DB 失败 → 500, R2 不动 | 完全一致，用户可重试 |
| **Single delete** | DB → R2 | R2 失败 → 已删 DB, R2 orphan 无害 | 用户看到已删除 |
| **Cascade delete** | DB → R2 (allSettled) | R2 失败 → orphan R2 objects（DB 已干净） | 只浪费存储，无用户可见问题 |

**设计原则**: 偏好 R2 orphan（只浪费存储）而非 DB 悬空记录（用户可见的幽灵附件）。
