# 19. Policy Termination Workflow

## Context

保单的三种终止状态 (`Surrendered` 退保 / `Claimed` 理赔 / `Lapsed` 失效) 目前只是 `policies.status` 枚举里的字面值，缺少配套的工作流：

- **审计盲区**：没有 `terminated_at` / `termination_reason`，事后无法追溯保单何时、为何终止，未来想统计退保率或理赔触发原因都没有数据基础。
- **缴费悬挂**：用户把状态切到终止态后，已经生成的未来期 `Pending` 缴费记录仍然挂在 policy 上，列表 / 统计 / 提醒会继续把这些"鬼缴费"算进来。
- **时间线失真**：`apps/web/src/components/policy-detail/timeline-column.tsx` 完全不读 `policy.status`，即使是已退保保单，未来缴费、续期、到期事件仍然按 `"future"` 渲染，"今天" 标记也照常画在终止日之后，让用户以为保单还在跑。
- **元数据易丢失**：`apps/web/src/components/policy-detail/meta-column.tsx` 的状态下拉里直接选 `Surrendered/Claimed/Lapsed` 会触发普通 PUT，没有任何二次确认或字段补录入口，用户切错状态没有回放手段。

本提案补齐终止动作的最小数据 + 流程闭环：新增两列、扩 1 个 payments 枚举、加 1 个 atomic API、加 1 个对话框、改 1 个 timeline 渲染分支。其他延伸（退保金额、理赔金额、自动失效检测）留到 v2。

## Scope

In scope：

- 三个终止态：`Surrendered` / `Claimed` / `Lapsed`，统一走同一条工作流（区别仅在按钮 / 标题文案 / 图标）
- 新增列：`policies.terminated_at` (TEXT, ISO date) + `policies.termination_reason` (TEXT, nullable)
- payments 枚举扩展：`Pending|Paid|Overdue` → `Pending|Paid|Overdue|Cancelled`
- 终止后批量翻转**未实际缴费**的缴费（`Pending` / `Overdue`）→ `Cancelled`（只针对 `dueDate > terminated_at`；`Paid` 永不动）
- 新 API：`POST /api/policies/:id/terminate`，原子化执行 (policy 状态 + 元数据 + payments 批量翻转)
- 终止对话框：捕获 `terminated_at` (必填) + `termination_reason` (可选)
- 三个动作按钮 (退保 / 理赔 / 失效)，挂在 `MetaColumn` 顶部
- BasicInfoSection 状态下拉拦截：选中任一终止值改为打开对话框而不是直发 PUT
- 反向操作：从终止态切回 `Active` 走 `AlertDialog` 二次确认，清空 `terminated_at` / `termination_reason`，但**不**主动恢复已 `Cancelled` 的缴费
- Timeline 第 4 种事件类型 `"cancelled"`，渲染删除线 + 灰色 + 警示图标，并在 `terminated_at` 当天插入终止 milestone
- `PolicyDetail` 接口新增 `terminatedAt` / `terminationReason` 字段，所有相关 GET 响应回填

Out of scope (v2)：

- 退保金 / 理赔金金额字段（不在 schema）
- `cash_values` 联动建议（v2 可在对话框里展示当前现金价值作参考）
- 失效日期从最早 `Overdue` 缴费自动推断（v1 仍由用户在对话框里手填）
- `Cancelled` 缴费的物理删除 / tombstone 保留窗口（v1 永久保留 `Cancelled` 行，作为审计痕迹）
- 终止动作的撤销审计 / 审计日志表

## Data Model

### Policies 表新增列

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `terminated_at` | TEXT | NULLABLE | ISO date (`YYYY-MM-DD`)，仅在终止态下有值；切回 Active 时清空 |
| `termination_reason` | TEXT | NULLABLE | 自由文本，对话框中可选填，长度上限 500 字符（前端 + API 层校验，DB 不约束） |

业务约束（API 层强校验，DB schema 不约束）：

- `terminated_at` 必须在 `[effectiveDate, today]` 区间内
- 当 `status === "Active"` 时，`terminated_at` 与 `termination_reason` 必须为 NULL
- 当 `status` 为终止态时，`terminated_at` 必填，`termination_reason` 可空

### Payments 枚举扩展

`packages/db/src/schema.ts:194` 当前：

```typescript
status: text("status", { enum: ["Pending", "Paid", "Overdue"] })
```

改为：

```typescript
status: text("status", { enum: ["Pending", "Paid", "Overdue", "Cancelled"] })
```

Drizzle 的 `enum` 仅做 TS 层类型校验，SQLite 表本身不会生成 CHECK 约束 —— 现有列升级无需 DDL，新增 `Cancelled` 值直接可写入。但所有消费 `payment.status` 的 switch / map 必须补 exhaustiveness 分支，TS 编译会报错引导补全。

`Cancelled` 语义：保单终止后留下的"作废"标记，原值保留供审计；列表展示时单独样式（参见 UI 节）。

### INIT_SQL 同步

`packages/db/src/index.ts:280-313` 的 `policies` 建表语句同步追加新列：

```sql
terminated_at TEXT,
termination_reason TEXT,
```

> Schema 与 INIT_SQL 不同步会导致 bun-sqlite L1 测试通过、D1 远程失败（或反之）。新增列时必须两边同改 —— 参考 CLAUDE.md Retrospective 中"INIT_SQL 是单源真值"约定。

### Drizzle Migration

`drizzle/` 顶层目录追加 1 个 migration 文件（`bunx drizzle-kit generate` 自动产出），包含两条 `ALTER TABLE policies ADD COLUMN ...`。

部署：`bun run db:push`（schema push，绕过 Worker）。Commit 1 落地后 push 到 dev D1，才能跑通 L2 HTTP 套件。

## API

### 新增：POST /api/policies/:id/terminate

挂在 `apps/worker/src/routes/policies.ts` 与 PUT / DELETE 同级。

**Request body：**

```typescript
{
  status: "Surrendered" | "Claimed" | "Lapsed";
  terminatedAt: string;          // ISO date "YYYY-MM-DD"
  terminationReason?: string;    // optional, max 500 chars
}
```

**Validation：**

| 检查 | 错误响应 |
|------|----------|
| `id` 不是数字 | 400 `Invalid id` |
| 保单不存在 | 404 `Policy not found` |
| `status` 不是三种终止态之一 | 400 `Invalid termination status` |
| `terminatedAt` 不符合 `^\d{4}-\d{2}-\d{2}$` regex | 400 `Invalid terminatedAt` |
| `terminatedAt` regex 通过但 round-trip 不一致（如 `2026-99-99`、`2026-02-31`） | 400 `Invalid terminatedAt` |
| `terminatedAt < policy.effectiveDate` | 400 `Terminated date must be on or after effective date` |
| `terminatedAt > today` (`todayInTimeZone("Asia/Shanghai")` 比较) | 400 `Terminated date cannot be in the future` |
| `terminationReason.length > 500` | 400 `Reason too long` |
| 当前已是终止态且 `existing.terminatedAt != null` 且新 `terminatedAt > existing.terminatedAt` | 400 `Cannot extend the termination date forward` |

> **日期校验的可执行定义**：`parseLocalDate` 对越界数值容忍（`new Date("2026-99-99")` 会被 JS 引擎滚到 2034 年），不能单独使用。必须用 regex 先卡死格式，再做 round-trip：`const d = parseLocalDate(s); if (formatDateString(d) !== s) reject(...)`。`today` 一律走 `todayInTimeZone("Asia/Shanghai")`（`packages/db/src/lib/date-utils.ts:63`）取项目标准时区当日，避免 Worker 容器 UTC 与用户本地日期相差一天。

> **terminatedAt 单调向前**：v1 不允许把已有的终止日期向后挪。原因：`cancelPendingAfter` 的 SQL 只把 `Pending → Cancelled`，不把 `Cancelled → Pending`；如果允许把 2026-03-01 改成 2026-06-01，3–6 月之间被取消的缴费会继续保持 Cancelled，与 "只取消 `dueDate > terminated_at`" 的约定相悖，产生静默不一致。允许的修改方向：(1) 同一终止日只改 reason / status；(2) 把 terminatedAt 向**更早**的日期挪 —— 这时只会有"更多"未来 Pending 被翻成 Cancelled，仍然单向收敛。把日期后移的真实需求按"先 PUT 回 Active 再重新 terminate"的路径处理（用户必须显式经过 reactivate 步骤，并自行重新生成需要的缴费）。
>
> **老数据补录例外**：旧版本可能已存在 `status` 是终止态但 `terminated_at IS NULL` 的保单（schema 升级前写入的）。此时**允许**首次通过 terminate 端点补录任何合法的 `terminatedAt`（视为初始化，不触发单调校验）。单调校验只在 `existing.terminatedAt != null` 时生效。这条规则保证 schema 迁移后用户能补齐审计字段。

**Behavior（D1 batch 原子执行）：**

使用 D1 binding 的 `db.batch([...])` 把以下两条语句作为单一 atomic 事务发出（D1 batch 提供 all-or-nothing 语义，参见 `packages/db/src/backup.ts:351` 与 `packages/db/src/index.ts:149-162`）：

1. `UPDATE payments SET status='Cancelled' WHERE policy_id=? AND status IN ('Pending','Overdue') AND due_date > ?`
2. `UPDATE policies SET status=?, terminated_at=?, termination_reason=?, updated_at=? WHERE id=?`

batch 整个失败时两条都回滚，DB 保持 terminate 前的状态，前端收到 500 后用户可以原样重试，**不会出现** "Active policy + Cancelled payments" 的中间态。

> **为什么连同 Overdue 一起翻**：用户允许把 terminatedAt 回溯到任意 `[effectiveDate, today]` 区间，这意味着回溯点之前可能已经积累了一批 `Overdue` 的缴费。如果只翻 `Pending`，那些 `Overdue` 行会继续出现在 dashboard、未结清统计、续保提醒里，制造"已退保的保单还在催缴"的鬼影。规则就一句话：**任何 `dueDate > terminated_at` 且尚未实际缴费（`Pending` 或 `Overdue`）的行，都按"作废"处理**，`Paid` 行无论日期都不动（已发生事实不可改）。

实现要点：

- Worker 路由通过 `c.env.DB.batch(...)` 直接发 batch；不要写在 repository 里逐条 `await`。`paymentsRepo.cancelPendingAfter` 仅作为单元测试入口和文档化的纯函数语义（构造 UPDATE 语句、用 `IN ('Pending','Overdue')` 选行），不在 terminate 路径上单独调用。
- bun:sqlite L1 单测里用 `db.transaction(() => { ... })` 替代 batch（drizzle bun-sqlite driver 支持同步事务），保持 atomic 语义一致。
- 受影响行数：D1 batch 返回 `D1Result[]`，每条 statement 的 `meta.changes` 即对应行数。`cancelledPaymentCount` 取 batch[0].meta.changes。
- **`.bind()` 参数细节**（绕过 Drizzle 的类型转换后必须手动处理）：
  - `updated_at` 列是 `integer("updated_at", { mode: "timestamp" })`，Drizzle 平时把 `Date` 序列化为 unix epoch **seconds**（见 `drizzle-orm/sqlite-core` timestamp mode）。raw bind 必须显式传 `Math.floor(Date.now() / 1000)` 而不是 `new Date()`，否则会写入字符串 "2026-06-22T..." 破坏后续读取。
  - `termination_reason` 缺省必须显式 `null`，不能让 `undefined` 进 `.bind()` —— D1 binding 对 `undefined` 行为未定义，可能转成字符串 "undefined" 或抛错。Worker 路由收 body 后立刻 normalize：`const reason = body.terminationReason ?? null`。
  - `terminated_at` 始终是 string（已通过 regex + round-trip 校验），直接 bind。
  - 完整调用示例：
    ```typescript
    const nowEpoch = Math.floor(Date.now() / 1000);
    const cancelStmt = c.env.DB.prepare(
      `UPDATE payments SET status='Cancelled'
       WHERE policy_id=? AND status IN ('Pending','Overdue') AND due_date > ?`,
    ).bind(policyId, terminatedAt);
    const updateStmt = c.env.DB.prepare(
      `UPDATE policies SET status=?, terminated_at=?, termination_reason=?, updated_at=?
       WHERE id=?`,
    ).bind(status, terminatedAt, reason, nowEpoch, policyId);
    const [cancelResult] = await c.env.DB.batch([cancelStmt, updateStmt]);
    const cancelledPaymentCount = cancelResult.meta.changes;
    ```

**Idempotency：**

- 二次调用（用户重新打开对话框确认）：
  - policies UPDATE 直接覆写 `terminatedAt` / `terminationReason`，幂等
  - payments UPDATE 用 `WHERE status IN ('Pending','Overdue')` 过滤，已经 `Cancelled` 的行不会被再次翻转；`cancelledPaymentCount` 在二次调用中为 0
- 因此 `terminate` 端点可安全重试，无累加副作用

**Response：**

```typescript
{
  id: number;
  status: "Surrendered" | "Claimed" | "Lapsed";
  terminatedAt: string;
  terminationReason: string | null;
  cancelledPaymentCount: number;  // 这次调用实际翻转的行数
}
```

### 反向操作：复用 PUT /api/policies/:id

切回 `Active` 走现有 `apps/worker/src/routes/policies.ts:130-174` 的 PUT，body 里 `status="Active"`、`terminatedAt=null`、`terminationReason=null` 一起送上来。PUT handler 需要补一条规则：当请求 body 包含 `status="Active"` 且 DB 当前是终止态时，强制把 `terminatedAt` / `terminationReason` 写为 NULL（防止前端忘传或老 client 提交）。

PUT **不** 自动恢复 `Cancelled` 缴费 —— 用户切回 Active 后如需补回缴费记录，请走 payments 模块手工重建，避免误恢复历史"作废"凭证。

### 通用 POST / PUT 禁写终止态（旁路封堵）

数据模型约束规定终止态必须有 `terminated_at`，否则审计就有空洞。光加 terminate 路由不够 —— `POST /api/policies` (`apps/worker/src/routes/policies.ts:50`) 和 `PUT /api/policies/:id` (`apps/worker/src/routes/policies.ts:131`) 现在都直接接受 `body.status`，新建表单 `apps/web/src/app/policies/policy-sheet.tsx:65` 还把四个状态选项摆在用户面前；任何前端跳过 dialog 都能写出 `status=Surrendered, terminated_at=null` 的非法数据。

API 层强约束：

- `POST /api/policies`：当 `body.status` ∈ {`Surrendered`, `Claimed`, `Lapsed`} 时返回 400 `Cannot create a policy in a terminated state — use POST /api/policies/:id/terminate after creation`。新建保单只允许进入 `Active`（默认）。
- `PUT /api/policies/:id`：当 `body.status` ∈ {`Surrendered`, `Claimed`, `Lapsed`} 且与 DB 现有 status 不一致时返回 400 `Use POST /api/policies/:id/terminate to transition into a terminal status`。仅在 `body.status` 与现有相等时透传（让其它字段更新可继续走 PUT），且即便相等也不允许通过 PUT 修改 `terminatedAt` / `terminationReason`（必须走 terminate）。
- `PUT` 切回 Active 仍按上一节规则强制清空 metadata。

UI 层呼应：

- `apps/web/src/app/policies/policy-sheet.tsx` 新建保单流程的 `statusOptions` (line 65) 收窄为单一 `Active`（或直接移除 status 字段，新建默认 Active）。
- 已存在的"编辑保单" sheet 在已 Active 时也不再渲染终止态选项；终止动作只能走详情页 MetaColumn 的三按钮 dialog。

> **L2 必须覆盖**：直接 `POST /api/policies { status: "Surrendered" }` → 400；直接 `PUT { status: "Lapsed" }` 在 Active 保单上 → 400；`PUT { status: "Active", terminatedAt: "2026-01-01" }`（试图通过 PUT 伪造 metadata）→ Active 路径下 metadata 被强制清空。

### PolicyDetail 响应

`apps/worker/src/routes/policies.ts` GET single (line 125-128) + GET list 的返回 shape，以及 `apps/web/src/lib/types/policy.ts:9-41` 的 `PolicyDetail` interface，均新增：

```typescript
terminatedAt: string | null;
terminationReason: string | null;
```

### Payments 写入路径在终止态下的封禁

终止保单的缴费记录已是历史快照，必须封死所有从 API / UI 重新生成 Pending 的入口；否则用户能在退保后又"手动新加一笔 2027 年的 Pending"，把缴费悬挂问题倒灌回来。

| 路由 | 现状 | 变更 |
|------|------|------|
| `POST /api/policies/:id/payments` (`apps/worker/src/routes/policies.ts:232`) | 直接 create | 加守卫：当 `policy.status` ∈ {`Surrendered`, `Claimed`, `Lapsed`} 时返回 400 `Cannot add payments to a terminated policy` |
| `PUT /api/policies/:id/payments/:paymentId` (`apps/worker/src/routes/policies.ts:258`) | 任意更新 | 加守卫：终止保单下，body 中若把 `Paid` 改回 `Pending` / `Overdue` / `Cancelled`，或把 `Cancelled` 改成除 `Paid` 以外的状态，返回 400。**允许的方向：任何非 `Paid` 状态（`Pending` / `Overdue` / `Cancelled`）→ `Paid`**，用于补录终止日**之前**实际已缴的真实历史（典型场景：用户已经线下交了一期但忘了在系统里 mark paid 就直接退保了）。同时允许编辑 paidDate / paidAmount / 备注 |
| `DELETE /api/policies/:id/payments/:paymentId` (`apps/worker/src/routes/policies.ts:287`) | 直接 delete | 加守卫：终止保单下一律返回 400 `Cannot delete payments of a terminated policy`，保护 `Cancelled` 行作为审计痕迹永久留存；保留 `DELETE /api/policies/:id`（全保单级联删除）路径不变 |
| `POST /api/policies/:id/payments/generate` (`apps/worker/src/routes/policies.ts:301`) | 按 schedule 生成 | 加守卫：终止保单直接返回 400 `Cannot generate payments for a terminated policy`；自动批量生成路径完全关闭 |
| 反向 PUT policy → Active | 仅清字段 | 不主动恢复 Cancelled 缴费（详见 [反向操作](#反向操作复用-put-apipoliciesid)）；用户切回 Active 后才能继续走 generate 路径 |

UI 同步：

- `apps/web/src/components/policy-detail/payments-section.tsx` 中"添加缴费记录" (line 455) 与"生成本年度缴费" (line 529) 两个按钮在 `policy.status` ∈ 终止态时隐藏
- 已存在的缴费行：`Pending` / `Overdue` / `Cancelled` 行都保留"标记已缴"入口（对应允许 `* → Paid` 的补录方向）；`Paid` 行保留"编辑 paidDate / 备注"入口；编辑表单中状态字段在终止态下整体 readonly，只能通过"标记已缴"按钮触发 `→ Paid` 转换（参见 [Payments Section 更新](#4-payments-section-更新)）
- 行级删除按钮在终止态下隐藏（呼应 DELETE 守卫）；用户若要批量清理只能删除整张保单

L2 E2E 必须覆盖：终止后 POST payments → 400、generate → 400、PUT 把 Cancelled 改 Pending → 400。

## UI

### 1. Action Buttons in MetaColumn

挂载位置：`apps/web/src/components/policy-detail/meta-column.tsx:1044-1077` 的 Header 区块下方、`<Separator />` (line 1074) 之前，新增 "操作" 区段，仅在 `policy.status === "Active"` 或 `"Expired"` 时显示三按钮；已经终止的保单隐藏三按钮，改为单按钮 "修改终止信息" 复用同一对话框。

按钮配置：

| 按钮 | Label | Icon (`lucide-react`) | Variant | 终止态 |
|------|-------|-----------------------|---------|--------|
| 退保 | 退保 | `CircleSlash` | `outline` | `Surrendered` |
| 理赔 | 理赔 | `BadgeCheck` | `outline` | `Claimed` |
| 失效 | 标记失效 | `CircleX` | `destructive` | `Lapsed` |

复用现有 `apps/web/src/components/ui/button.tsx` 的 `<Button>` 原语，三按钮横排 `flex gap-2`。

### 2. Termination Dialog

新建 `apps/web/src/components/policy-detail/termination-dialog.tsx`，基于 `apps/web/src/components/ui/dialog.tsx` 原语（非 AlertDialog，因为需要输入字段）。

**Props：**

```typescript
interface TerminationDialogProps {
  policy: PolicyDetail;
  open: boolean;
  targetStatus: "Surrendered" | "Claimed" | "Lapsed";
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void; // 触发 refreshPolicy + refreshPayments
}
```

**字段：**

| 字段 | 类型 | 校验 | UI |
|------|------|------|-----|
| `terminatedAt` | date | 必填，在 `[policy.effectiveDate, today]` 区间内；默认值 = `today` | `<input type="date">` 或现有 `DatePicker`（参见 `EditableInfoRow`） |
| `terminationReason` | text | 可选，最长 500 字符 | `<Textarea>`，placeholder 按终止态分别提示（退保："退保原因，例如 现金价值已超..." / 理赔："出险经过 / 理赔说明" / 失效："失效原因，例如 连续未缴..."） |

**标题文案：**

| `targetStatus` | Dialog title |
|----------------|--------------|
| `Surrendered` | 退保 - {productName} |
| `Claimed` | 理赔结案 - {productName} |
| `Lapsed` | 标记失效 - {productName} |

**Footer：**

- "取消" 按钮 `variant="ghost"` 关闭
- "确认终止" 按钮 `variant="destructive"`，提交 `POST /api/policies/:id/terminate`，成功后 `onSuccess()` + 关闭
- 提交中显示 spinner（参考现有 `EditableInfoRow` 编辑态的 loading 模式）
- API 失败时把 error message 渲染在 footer 上方红色文本

提交成功后 toast 提示 `已退保 / 已理赔 / 已失效（取消 N 笔未来缴费）`，N 来自 API 响应的 `cancelledPaymentCount`。

### 3. Status Dropdown Interception

`apps/web/src/components/policy-detail/meta-column.tsx:53-58` 定义 `statuses` 列表，`:257-264` 的 `EditableInfoRow` 渲染状态下拉。

改造 `BasicInfoSection`：

- 下拉选项保持不变（`Active/Lapsed/Surrendered/Claimed`），保证 Surrendered 保单加载后下拉显示 "已退保"
- 包装一层 `onEditChange` 拦截：
  - 当前态是 `Active` / `Expired`，新选值是 `Lapsed/Surrendered/Claimed` → **不写入** `formData.status`（即下拉 UI 立刻回弹到原值），转而打开 `TerminationDialog`，`targetStatus` = 新选值；对话框提交成功后由 `refreshPolicy` 拉新数据反映回 UI
  - 当前态是终止态，新选值是 `Active` → 打开 `AlertDialog`（复用 `apps/web/src/components/ui/alert-dialog.tsx:146-180`）二次确认 "确认恢复为 Active？已取消的缴费不会自动恢复"。确认后 `formData.status="Active"`、`formData.terminatedAt=null`、`formData.terminationReason=null`，走现有 PUT 流程
  - 当前态是终止态，新选值是另一种终止态 → 打开 `TerminationDialog` 复用 termination 流程（视为重新终止，重写元数据）
  - 当前态是终止态，新选值是同一终止态 → no-op

### 4. Payments Section 更新

`apps/web/src/components/policy-detail/payments-section.tsx` 现有结构假设 status 三态，需要系统升级到四态：

**类型层（`apps/web/src/lib/types/policy.ts:85`）：**

```typescript
export type PaymentStatus = "Pending" | "Paid" | "Overdue" | "Cancelled";
export interface Payment {
  // ...
  status: PaymentStatus;
}
```

**Form 数据层（payments-section.tsx 内部）：**

`PaymentFormData.status` / `originalStatus` 也扩到四态，但 form 仅在 `originalStatus !== "Cancelled"` 时挂载编辑 UI；`Cancelled` 行根本不进入 `paymentToForm` 路径。

```typescript
interface PaymentFormData {
  periodNumber: string;
  dueDate: string;
  amount: string;
  status: PaymentStatus;
  paidDate: string;
  originalStatus: PaymentStatus | undefined;
}
```

**显示 / 交互（行级）：**

- `StatusBadge` (~line 191) `switch` 增加一支 `case "Cancelled"`：灰色 `outline` badge，文案 "已取消"
- `Cancelled` 行整行加 `line-through text-muted-foreground` 视觉降权
- 终止保单下所有行（`Pending` / `Overdue` / `Cancelled` / `Paid`）的"编辑"按钮**仅暴露非破坏字段**：`paidDate` / `paidAmount` / 备注；状态 `<Select>` 整体 readonly，不渲染交互；状态变更只能通过单独的"标记已缴"按钮触发 `* → Paid` 的单向转换（呼应 [Payments 写入路径在终止态下的封禁](#payments-写入路径在终止态下的封禁)）
- `Cancelled` 行的"标记已缴"按钮默认显示，用于补录终止日**之前**实际已缴的真实历史；hover 提示 "保单已终止，仅可标记已缴（用于历史补录）"
- 行级删除按钮在终止保单下隐藏（呼应 DELETE 守卫）

**新增 / 生成入口：**

- `PaymentForm` 的状态 `<SelectItem>` 列表 (~line 142-146) **不** 暴露 `Cancelled` —— `Cancelled` 仅由 terminate API 产生
- `policy.status` ∈ 终止态时，"添加缴费记录" (line 455) 与"生成本年度缴费" (line 529) 两个按钮整体隐藏

**统计：**

- 列表筛选 / 统计 (~line 227-230) 计算 paidCount / totalDueCount 等忽略 `Cancelled` 行；`Cancelled` 单独显示在表尾灰色区域 "N 笔已作废（保单终止）"

文案集中在 `apps/web/src/lib/constants/policy.ts` 新增 `paymentStatusLabels: Record<PaymentStatus, string>` 与 `statusConfig` 并列。

> **TS 编译指南**：由于 `PaymentStatus` 是 string union，扩第 4 个值后，所有现存 `switch (status)` 或 `Record<PaymentStatus, T>` 会触发 exhaustiveness 检查，编译器会自动指引补全分支。`paymentToForm` 函数当前有 `status === "Overdue" ? "Pending" : p.status` 的特判，新增 `Cancelled` 时不进入这个三元（因为 Cancelled 行不会被编辑），但仍需要在类型上让 form 接收完整 union。

## Timeline Rendering

`apps/web/src/components/policy-detail/timeline-column.tsx:7-13` 的 `TimelineEvent` 类型：

```typescript
interface TimelineEvent {
  date: Date;
  dateStr: string;
  label: string;
  type: "past" | "today" | "future" | "cancelled" | "terminated";
}
```

新增 `"cancelled"`（被终止覆盖的原计划事件）和 `"terminated"`（终止动作本身的 milestone）两种 type。

### `buildTimeline` 改造 (line 31-169)

1. 函数从 `policy` 读 `policy.status` / `policy.terminatedAt`（已经接收 policy 全量，无需改 props）
2. 计算 `terminatedTime = policy.terminatedAt ? parseLocalDate(policy.terminatedAt).getTime() : null`
3. 每个事件 push 时，若 `terminatedTime != null` 且 `eventTime > terminatedTime`，`type="cancelled"`（覆盖原本的 `future` / `past` 判定）
4. 当 `terminatedTime != null` 时，在 list 末尾追加 milestone：

   ```typescript
   {
     date: parseLocalDate(policy.terminatedAt),
     dateStr: policy.terminatedAt,
     label: { Surrendered: "退保", Claimed: "理赔结案", Lapsed: "失效" }[policy.status],
     type: "terminated",
   }
   ```

5. `today` 标记抑制规则：当 `terminatedTime != null && terminatedTime <= todayTime`，**不** push `today` 事件（保单已终止，"今天"在 timeline 语义里失效）
6. 排序 map (line 164) 扩展：`{ past: 0, today: 1, future: 2, cancelled: 3, terminated: 4 }`，保证同日终止 milestone 排在同日其他事件之后

### Render 改造 (line 188-236)

新增 `event.type === "cancelled"` 分支：

| 元素 | 样式 |
|------|------|
| Icon | `CircleX` (lucide) `text-muted-foreground/50` 颜色 |
| Date span | `line-through text-muted-foreground/50` |
| Label span | `line-through text-muted-foreground/50` |
| Vertical connecting line | 改为 `border-l-dashed` 提示中断 |

新增 `event.type === "terminated"` 分支：

| 元素 | 样式 |
|------|------|
| Icon | `CircleSlash` `text-warning` 实心填充 |
| Date span | `text-warning font-semibold` |
| Label span | `text-warning font-semibold`，鼠标 hover 显示 `policy.terminationReason`（tooltip） |

## File Changes

### Phase 1: Data Layer

| File | Action | Description |
|------|--------|-------------|
| `packages/db/src/schema.ts` | MODIFY | `policies` table 追加 `terminatedAt` / `terminationReason`，`payments.status` enum 扩展 `Cancelled` (line 127-131, 194) |
| `packages/db/src/index.ts` | MODIFY | INIT_SQL 中 `policies` CREATE TABLE 同步追加两列 (line 280-313) |
| `packages/db/src/types.ts` | MODIFY | 新增 export `TerminalPolicyStatus = "Surrendered" \| "Claimed" \| "Lapsed"` 供 API / Dialog 复用 (line 11) |
| `packages/db/src/repositories/payments.ts` | MODIFY | 新增 `cancelPendingAfter(policyId, dateStr)`：`UPDATE payments SET status='Cancelled' WHERE policy_id=? AND status IN ('Pending','Overdue') AND due_date > ?`；返回受影响行数 |
| `packages/db/__tests__/payments.test.ts` | MODIFY/CREATE | 覆盖 `cancelPendingAfter` 边界（Pending 与 Overdue 都翻、Paid 不动、只翻 dueDate > terminatedAt、idempotency） |
| `drizzle/000X_policy_termination.sql` | CREATE | `bunx drizzle-kit generate` 产出两条 `ALTER TABLE policies ADD COLUMN` |

### Phase 2: API Layer

| File | Action | Description |
|------|--------|-------------|
| `apps/worker/src/routes/policies.ts` | MODIFY | 新增 `POST /api/policies/:id/terminate` handler，紧挨 PUT 之后；用 `c.env.DB.batch([cancelPendingStmt, updatePolicyStmt])` 一次发出两条语句以保证原子性；GET single / GET list 响应 shape 增加 `terminatedAt` / `terminationReason` (line 125-128) |
| `apps/worker/src/routes/policies.ts` | MODIFY | PUT handler 内追加规则：当 `body.status === "Active"` 时强制 `terminatedAt=null`, `terminationReason=null` (line 148-162) |
| `apps/worker/src/routes/policies.ts` | MODIFY | `POST /api/policies` (line 50) 与 `PUT /api/policies/:id` (line 131) 加守卫拒绝通用 CRUD 直接写终止态（详见 [通用 POST / PUT 禁写终止态](#通用-post--put-禁写终止态旁路封堵)） |
| `apps/worker/src/routes/policies.ts` | MODIFY | `POST /api/policies/:id/payments` (line 232)、`PUT /api/policies/:id/payments/:paymentId` (line 258)、`DELETE /api/policies/:id/payments/:paymentId` (line 287)、`POST /api/policies/:id/payments/generate` (line 301) 四条路由头部加 `policy.status` 终止态守卫，返回 400（详见 [Payments 写入路径在终止态下的封禁](#payments-写入路径在终止态下的封禁)） |
| `apps/worker/__tests__/e2e/setup.ts` (line 88) | MODIFY | fake D1 当前只暴露 `prepare(sql).first()` 一个分支，terminate handler 会调用 `prepare(sql).bind(...params)` 拿到 statement 再丢给 `batch([...])`。需要同时补两件事：(1) `prepare(sql)` 返回的对象增加 `bind(...params)` 方法，返回一个 `{ sql, params }` 形状的 statement 持有者；(2) 顶层 D1 上增加 `batch(stmts)`，顺序在 bun:sqlite `db.transaction(() => ...)` 内执行每条 statement，返回 `[{ meta: { changes } }, ...]` 形状。失败回滚靠 bun:sqlite 事务保证；用塞入一条违反约束的 statement 验证 atomicity 测试 |
| `packages/api/src/policies.ts` (如存在) | MODIFY | 如有 framework-agnostic 业务层则在此实现 `terminatePolicy(repos, id, input)`，Worker 路由薄壳调用；坚守 CLAUDE.md "路由是薄壳" 原则。如不存在则直接写在 worker 路由内（与现有 PUT 一致风格） |

### Phase 3: UI Core

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/lib/types/policy.ts` | MODIFY | `PolicyDetail` 接口新增 `terminatedAt` / `terminationReason` (line 9-41) |
| `apps/web/src/lib/constants/policy.ts` | MODIFY | 新增 `paymentStatusLabels`（含 `Cancelled: "已取消"`）；如需为终止态按钮配置 icon，集中放此处 |
| `apps/web/src/components/policy-detail/termination-dialog.tsx` | CREATE | Dialog component（基于 `components/ui/dialog.tsx`），三种终止态共用一个组件，标题 / 文案 / placeholder 按 `targetStatus` 分支 |
| `apps/web/src/components/policy-detail/meta-column.tsx` | MODIFY | Header 下新增 "操作" 区块挂三个按钮 (line 1044-1077)；BasicInfoSection 的 status select onChange 拦截 (line 53-58, 257-264)；切回 Active 走 `AlertDialog` 二次确认 |
| `apps/web/src/components/policy-detail/payments-section.tsx` | MODIFY | `PaymentsSectionProps` 接口 (line 24) 新增必填 `policyStatus: PolicyStatus`（直接传整个 display status 而不是 `isTerminated: boolean`，让组件内部用 `["Surrendered","Claimed","Lapsed"].includes(policyStatus)` 自行判定，且 tooltip 文案能区分三态）；`StatusBadge` 增加 `Cancelled` 分支 (line ~191)；列表行加 line-through 样式；统计计数排除 `Cancelled`；`PaymentForm` 不暴露 `Cancelled` 作为用户可选项 (line ~142-146)；终止态下 add / generate 按钮整体不渲染，行级编辑表单 status 字段 readonly |
| `apps/web/src/app/policies/[id]/page.tsx` | MODIFY | `<MetaColumn>` 调用处传入 `onTerminationSuccess` 回调，内部 `refreshPolicy + refreshPayments` 并发刷新 (line 96-109, 155-194)；`<PaymentsSection>` 调用 (line 183) 补传 `policyStatus={policy.status}` |

### Phase 4: Timeline Component

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/components/policy-detail/timeline-column.tsx` | MODIFY | `TimelineEvent.type` 增加 `"cancelled"` / `"terminated"` (line 7-13)；`buildTimeline` 计算 `terminatedTime` 并覆盖事件 type；插入终止 milestone；抑制 `today` 标记 (line 31-169)；排序 map 增加新类型 (line 159-166)；渲染分支加 cancelled / terminated 样式 (line 188-236) |
| `apps/web/src/__tests__/timeline.test.ts` | CREATE | 覆盖：终止后未来事件渲染为 cancelled / today 标记被抑制 / milestone 出现在正确位置 / 排序稳定 |

## Verification

### L1 单元测试 (`bun run test`)

- `packages/db/__tests__/payments.test.ts`：`cancelPendingAfter` 的边界（多状态混合、日期边界、空结果、幂等重放）
- `apps/web/src/__tests__/timeline.test.ts`：`buildTimeline` 在 `terminatedAt` 存在时的输出（事件类型、milestone 注入、`today` 抑制、排序）
- `apps/web/src/__tests__/termination-dialog.test.ts`：表单 validation（日期范围、reason 长度）

`bun run test:coverage` 行 / 函数覆盖率仍需 ≥ 95%。

### G1 静态 (`bun run typecheck` + `bun run lint`)

- 新 `PolicyDetail` 字段在所有消费者编译通过
- `payments.status` enum 扩展后所有 switch / map 都补 `Cancelled` 分支（TypeScript 会报 exhaustiveness 错）
- 零 ESLint 警告

### L2 集成 (`bun run test`，覆盖 `apps/worker/__tests__/e2e/policies.e2e.test.ts`)

新增测试用例（参考现有 `apps/worker/__tests__/e2e/policies.e2e.test.ts:42-114` 创建 policy + payments 的 pattern）：

| 用例 | 期望 |
|------|------|
| POST terminate 成功 | 200，policy 状态变为目标终止态，`terminatedAt` / `terminationReason` 写入，返回 `cancelledPaymentCount` |
| POST terminate 后 GET payments | 所有 `dueDate > terminatedAt` 的 `Pending` / `Overdue` 变 `Cancelled`，`Paid` 行保持不动 |
| POST terminate 后 GET policy | `terminatedAt` / `terminationReason` 出现在响应里 |
| POST terminate 幂等 | 二次调用同 status + 不同 reason，policy 元数据更新，`cancelledPaymentCount=0` (已经 Cancelled 的不再翻) |
| POST terminate 非法 `terminatedAt`（早于 effective / `2026-99-99` / 未来日期） | 400 |
| POST terminate 非法 status（如 `Active`） | 400 |
| POST terminate 不存在的 policy | 404 |
| POST terminate 后将 terminatedAt 后移 | 400 `Cannot extend the termination date forward` |
| POST terminate 后将 terminatedAt 前移 | 200，额外区间内的 Pending/Overdue 被翻成 Cancelled |
| POST terminate 对老数据（status 已终止但 terminatedAt NULL） | 200，允许首次补录任意合法日期，不触发单调校验 |
| POST terminate 把 Overdue 翻成 Cancelled | 终止日之后的 Overdue 行被翻；终止日之前的 Overdue 保留 Overdue（已属于"真实历史欠缴"，不能洗白） |
| POST terminate batch atomicity | 模拟 policies UPDATE 失败（例如向只读副本注入错误）后 GET payments：原 Pending 仍为 Pending，policy 状态未改 |
| POST `/api/policies` body.status="Surrendered" 创建 | 400（旁路被堵） |
| PUT `/api/policies/:id` 把 Active 直接改成 Lapsed | 400（必须走 terminate） |
| PUT `/api/policies/:id` 在终止态下尝试修改 `terminatedAt` / `terminationReason` | 400（这两个字段只能通过 terminate 路径改） |
| 终止后 POST `/api/policies/:id/payments` | 400 `Cannot add payments to a terminated policy` |
| 终止后 POST `/api/policies/:id/payments/generate` | 400 |
| 终止后 PUT 把 Cancelled 行改 Pending | 400 |
| 终止后 PUT 把 Paid 行改回 Pending | 400 |
| 终止后 PUT 把 Pending 行改 Paid | 200（允许补录历史已缴） |
| 终止后 PUT 把 Overdue 行改 Paid | 200（允许补录终止日前真实欠缴后来线下补缴的场景） |
| 终止后 PUT 把 Cancelled 行改 Paid | 200（允许补录历史已缴） |
| 终止后 DELETE 行级 payment | 400 `Cannot delete payments of a terminated policy` |
| 终止后 DELETE 整张保单 | 200（级联删除路径不受守卫影响） |
| PUT policy status=Active 反向切回 | terminatedAt / terminationReason 被清空；Cancelled 缴费保持 Cancelled（不自动恢复） |
| 反向切回 Active 后再 POST payments | 200（守卫解除） |

L2 HTTP 套件 `bun run test:l2:http` 同样运行一遍 terminate 路径，验证 D1 binding 与 sqlite-proxy 行为一致 —— 跑此套件前需先 `bun run db:push` 把新列推到 dev D1。

### L3 浏览器 E2E (`bun run test:e2e:browser`, 可选)

`apps/web/e2e/policy-termination.spec.ts`：

1. 创建保单 → 生成 12 期月缴 → 点 "退保" 按钮
2. 填日期 + reason → 提交
3. 验证 Timeline 出现 "退保" milestone、未来缴费灰显带删除线、状态 Badge 变 "已退保"
4. 验证 Payments 区已取消缴费 "已取消" badge 出现
5. 切状态 Active → AlertDialog 出现 → 取消 → 状态保持

## Atomic Commit Sequence

| # | Message | Scope | Status |
|---|---------|-------|--------|
| 1 | `feat(db): add terminated_at / termination_reason to policies; extend payments enum with Cancelled` | `packages/db/src/schema.ts`, `packages/db/src/index.ts` INIT_SQL, `packages/db/src/types.ts`, drizzle migration | pending |
| 2 | `feat(db): add paymentsRepo.cancelPendingAfter` | `packages/db/src/repositories/payments.ts` + L1 test | pending |
| 3 | `feat(api): add POST /api/policies/:id/terminate; expose terminatedAt / terminationReason; lock down all status bypass routes` | `apps/worker/src/routes/policies.ts` (terminate handler with D1 `batch()`, PUT auto-clear, terminal-status guards on POST/PUT policies + POST/PUT/DELETE/generate payments), `apps/worker/__tests__/e2e/setup.ts` (fake D1 `batch()` shim), `packages/api/...`, `apps/web/src/lib/types/policy.ts` PolicyDetail + PaymentStatus | pending |
| 4 | `test(e2e): cover policy terminate endpoint and payments side-effect` | `apps/worker/__tests__/e2e/policies.e2e.test.ts` (terminate path + bypass guards + Overdue handling + atomicity) | pending |
| 5 | `feat(ui): termination dialog component` | `apps/web/src/components/policy-detail/termination-dialog.tsx` + L1 test | pending |
| 6 | `feat(ui): wire action buttons and status dropdown interception in MetaColumn` | `apps/web/src/components/policy-detail/meta-column.tsx`, `apps/web/src/app/policies/[id]/page.tsx` refresh callbacks, `apps/web/src/app/policies/policy-sheet.tsx` 收窄 `statusOptions` 到 Active-only（line 65） | pending |
| 7 | `feat(ui): render Cancelled payment status; lock down payment writes when policy is terminated` | `apps/web/src/components/policy-detail/payments-section.tsx` (StatusBadge / row readonly / hide add+generate buttons), `apps/web/src/lib/constants/policy.ts` (paymentStatusLabels), `apps/web/src/lib/types/policy.ts` (PaymentStatus = 4-tuple) | pending |
| 8 | `feat(ui): timeline renders terminated milestone and cancels future events` | `apps/web/src/components/policy-detail/timeline-column.tsx` + L1 test | pending |

每个 commit 独立通过 `bun run typecheck` + `bun run lint` + `bun run test`。Commit 1 (DB-only，无消费者) 是 hot-path：单独 push 到 dev D1 + 跑 schema check。Commit 3-4 形成 API 闭环；Commit 5-8 形成 UI 闭环，互不阻塞。

## Open Questions / Future Extensions

| 议题 | 当前决策 | v2 候选方案 |
|------|----------|-------------|
| **Active → Active 恢复后 Cancelled 缴费如何回滚？** | 不自动恢复 (审计安全) | v2 可加 `paymentsRepo.uncancelByPolicy(policyId)` + AlertDialog 二选项 "保留取消" / "恢复缴费" |
| **terminatedAt 是否允许后移？** | 不允许（单调向前）。后移真实需求走 "PUT → Active → 再 terminate" 双跳，用户必须显式经过 reactivate 步骤 | v2 若加入 `Cancelled → Pending` 的可控回滚，则可允许 terminatedAt 后移并按区间回填 |
| **退保金额 / 现金价值联动** | 不在 schema | v2 在对话框中读 `cashValues` 表展示当前现金价值作参考；可选填入 `refundAmount` 列 |
| **理赔金额 / 出险信息** | 不在 schema | v2 加 `claim_amount` 列 + R2 附件挂理赔材料 |
| **Lapsed 自动检测** | 手动触发 | v2 cron job：检测连续 N 个 Overdue 缴费自动建议进入 Lapsed 流程，仍由用户确认 |
| **审计日志表** | 无 | v2 通用 `audit_log` 表记录所有 terminate / reactivate 动作的 actor + timestamp + diff |
