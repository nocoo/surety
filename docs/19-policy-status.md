# 19. Policy Status & Transitions

> v1 极简方案。删掉了"PendingSurrender 作为 DB status"、"payments Cancelled enum"、"D1 batch / fake batch shim"、"终止日期单调向前"等被审计 tombstone 绑架的复杂度，专注三件事：(1) 终止时记录 `terminatedAt` / `terminationReason`；(2) 终止后未来未缴费用、提醒、timeline 不再误显示为有效事项；(3) 阻止 CRUD 旁路写出脏状态。其它扩展放 v2。

## Context

`policies.status` 是单字符串枚举 `Active / Lapsed / Surrendered / Claimed`，display 层再派生 `Expired`。空洞：

- **审计盲区**：终止动作（退保 / 理赔 / 失效）没有 `terminated_at` / `termination_reason` 记录，事后无法追溯何时、为何终止。
- **缴费悬挂**：用户把状态切到终止态后，已生成的未来期 `Pending` / `Overdue` 缴费记录仍挂在 policy 上，列表 / 统计 / 提醒继续把这些"鬼缴费"算进来。
- **时间线失真**：`apps/web/src/components/policy-detail/timeline-column.tsx` 不读 `policy.status`，已退保保单的未来缴费、续期、到期事件仍按 `future` 渲染，"今天"标记照常画在终止日之后。
- **元数据易丢失**：`apps/web/src/components/policy-detail/meta-column.tsx` 状态下拉直接选 `Surrendered/Claimed/Lapsed` 会触发普通 PUT，没有二次确认 / 字段补录入口。
- **状态旁路**：通用 POST/PUT `/api/policies` 接受任何枚举值，可写出 `Surrendered` 但缺 `terminated_at` 的非法组合。
- **"想退但没退"无处可记**：用户有时已决定退保但没办完手续（等客服回电、等现金价值结算），需要一个可见标记，但**不**应混入 DB status —— 这是用户意向，不是合同状态。

## Scope

In scope：

- 终止动作三态：`Surrendered` / `Claimed` / `Lapsed`，统一走同一条 terminate 工作流（区别仅在按钮 / 标题 / 图标）
- 新增列：
  - `policies.terminated_at` (TEXT, ISO date) + `policies.termination_reason` (TEXT, nullable)
  - `policies.planned_surrender_at` (TEXT, ISO date, nullable) + `policies.planned_surrender_note` (TEXT, nullable) —— 仅作为 **UI 标记**承载"想退但没退"的意向，**不影响**任何业务逻辑（status / payments / coverage / 提醒一律按现 status 处理）
- 新 API：
  - `POST /api/policies/:id/terminate`：单表 UPDATE，写 `status` + `terminated_at` + `termination_reason`（无 batch、无 payments 副作用）
  - `PUT /api/policies/:id/planned-surrender`：单表 UPDATE，写 `planned_surrender_at` + `planned_surrender_note`（可设可清，纯标记）
- **未来未缴的缴费记录在终止后由读路径过滤**：列表 / 统计 / 提醒按 `policy.terminated_at` 过滤掉 `dueDate > terminated_at && status !== "Paid"` 的行；**不**改 payments enum、**不**永久 tombstone、**不**翻转 DB 数据。`Paid` 行永久保留作为真实历史。
- 终止对话框：捕获 `terminatedAt` (必填) + `terminationReason` (可选)
- 三个动作按钮（退保 / 理赔 / 失效）+ 一个"标记拟退保"链接，挂在 `MetaColumn`
- BasicInfoSection 状态下拉变为 readonly（避免与四个按钮 + dialog 形成两套互相拦截的入口）
- 反向操作：从终止态切回 `Active` 走 `AlertDialog` 二次确认，清空 `terminated_at` / `termination_reason`；过滤规则自动失效，原 Pending/Overdue 行重新可见
- Timeline 在 `terminated_at` 当天插入一个 milestone；终止态下未来事件（payments / 续期 / 到期）整体过滤掉不渲染，"今天"标记在终止日之后抑制
- `PolicyDetail` 接口新增 `terminatedAt` / `terminationReason` / `plannedSurrenderAt` / `plannedSurrenderNote` 四个字段；`PolicySummary` 不动

Out of scope (v2 候选)：

- 把 `PendingSurrender` 升级为正式 DB status（v1 仅用前述两个标记列承载）
- payments 引入 `Cancelled` enum 与永久审计保护
- 退保金 / 理赔金额字段
- `cash_values` 联动建议
- 失效日期从最早 `Overdue` 自动推断
- 终止动作的撤销审计 / `status_history` 表
- 拟退保到期未行动的自动提醒（cron 检测 `today >= planned_surrender_at`）

## Status Catalog

| 状态 | 来源 | 中文 | 含义 | Badge variant | metadata |
|------|------|------|------|---------------|----------|
| `Active` | DB | 生效中 | 保单正常运转，缴费正常生成 | `success` | `terminated_at` / `termination_reason` 必为 NULL |
| `Surrendered` | DB | 已退保 | 终止态：现金价值已结算或已发起退保 | `warning` | `terminated_at` 必填；`termination_reason` 可空 |
| `Claimed` | DB | 已理赔 | 终止态：理赔结案 | `purple` | 同上 |
| `Lapsed` | DB | 已失效 | 终止态：连续未缴 / 中止 / 其它原因失效 | `outline` | 同上 |
| `Expired` | derived | 已过期 | `dbStatus="Active"` 且 `expiryDate < now` 时派生 | `destructive` | 不参与 DB 校验 |

**"拟退保"标记**是 Active 保单上的一对可选字段（`planned_surrender_at` + `planned_surrender_note`），不进入 status 枚举。Badge 行为：当 **DB status = Active** 且 `planned_surrender_at` 非空时，badge 在主标签后追加一个玫红色 `rose` 副标签 "拟退保 YYYY-MM-DD"（共用已存在的 `--badge-red` token，无需新增 css 变量；Badge variant 增加 `rose` 一项）。所有业务判定（活跃统计、保障速查、续保提醒、缴费生成）**完全无视**这对字段。

> **Display Active vs DB Active 的判定边界**：GET `/api/policies/:id` 返回的 `status` 已经被 `deriveDisplayStatus(...)` 派生过，过期的 Active 保单显示为 `Expired`（`apps/worker/src/routes/policies.ts:125`）。前端 / 后端在不同场景采用不同口径：
>
> - **后端准入**（terminate、planned-surrender、CRUD 旁路守卫）：一律读 DB 原值 `policy.status`，过期的 Active 保单**仍能**被 terminate / 标记拟退保（用户主动收尾过期保单是常见场景）
> - **前端展示**（badge 渲染、按钮可见性、timeline milestone）：一律按 display status，**Active 与 Expired 两种 display 状态都允许展示拟退保副 badge / 显示拟退保链接 / 在 timeline 插入计划退保 milestone**（Expired 本质是 DB Active，业务上仍可承载拟退保意向）
>
> 终止三态（Surrendered / Claimed / Lapsed）不论 DB 还是 display 都不展示拟退保 UI（terminate 端点已自动清空两个标记字段）。

## Transition Matrix

| from → to | Active | Surrendered | Claimed | Lapsed |
|-----------|--------|-------------|---------|--------|
| **Active** | — | ✅ `POST /terminate` | ✅ `POST /terminate` | ✅ `POST /terminate` |
| **Surrendered** | ✅ PUT `status=Active`（AlertDialog 二次确认；清 metadata） | — | ❌ | ❌ |
| **Claimed** | ✅ 同上 | ❌ | — | ❌ |
| **Lapsed** | ✅ 同上 | ❌ | ❌ | — |
| **Expired** (display) | DB 仍是 Active，按 Active 的迁出规则处理 | 同左 | 同左 | 同左 |

硬约束：

- **终止态之间禁止互转**：互转语义不清，强制走 Active 中转
- **`Active → 任一终止态` 必须走 `POST /terminate`**：通用 PUT 拒绝写入非 Active 状态（见 [通用 POST / PUT 禁写非 Active 状态](#通用-post--put-禁写非-active-状态旁路封堵)）
- `planned_surrender_at` / `planned_surrender_note` 与 status 完全解耦：在 Active 状态下可随时通过 `PUT /api/policies/:id/planned-surrender` 设置或清除；进入终止态时自动清空（terminate handler 顺手 `planned_surrender_at = null, planned_surrender_note = null`，意向已被终止动作"履行"）

## Data Model

### Policies 表

不动 status enum（保持现有 `Active / Lapsed / Surrendered / Claimed`）。新增四列：

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `terminated_at` | TEXT | NULLABLE | ISO date (`YYYY-MM-DD`)，实际终止日 |
| `termination_reason` | TEXT | NULLABLE | 自由文本，长度上限 500 字符（前端 + API 层校验，DB 不约束） |
| `planned_surrender_at` | TEXT | NULLABLE | ISO date，UI 标记"打算退保的日期"，允许未来日 |
| `planned_surrender_note` | TEXT | NULLABLE | 自由文本，长度上限 500 字符 |

业务约束（API 层强校验，DB schema 不约束）：

| status | terminated_at | termination_reason | planned_surrender_at | planned_surrender_note |
|--------|---------------|---------------------|----------------------|------------------------|
| `Active` | 必须 NULL | 必须 NULL | 可空 / 可有 | 可空 / 可有 |
| `Surrendered` / `Claimed` / `Lapsed` | 必填，`[effectiveDate, today]` | 可空 | 必须 NULL（terminate 时自动清空） | 必须 NULL |

### Payments 表

**不动**。不引入 `Cancelled` enum，不翻转 DB 数据。终止后未来未缴的过滤完全在读路径完成（见 [Payments 过滤规则](#payments-过滤规则纯读路径)）。

### INIT_SQL 同步

`packages/db/src/index.ts:280-313` 的 `policies` CREATE TABLE 追加：

```sql
terminated_at TEXT,
termination_reason TEXT,
planned_surrender_at TEXT,
planned_surrender_note TEXT,
```

> 参考 CLAUDE.md Retrospective "INIT_SQL 是单源真值"约定。

### Drizzle Migration

`drizzle/` 追加 1 个 migration 文件（`bunx drizzle-kit generate` 产出），包含 4 条 `ALTER TABLE policies ADD COLUMN`。部署：`bun run db:push`。Commit 1 落地后 push 到 dev D1，才能跑通 L2 HTTP 套件。

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
| `existing.status` ∈ {`Surrendered`, `Claimed`, `Lapsed`} 且与 body 中 `status` 不同 | 400 `Cannot transition between terminal statuses; reactivate to Active first` |
| `status` 不是三种终止态之一 | 400 `Invalid termination status` |
| `terminatedAt` 不符合 `^\d{4}-\d{2}-\d{2}$` regex | 400 `Invalid terminatedAt` |
| `terminatedAt` regex 通过但 round-trip 不一致（如 `2026-99-99`） | 400 `Invalid terminatedAt` |
| `terminatedAt < policy.effectiveDate` | 400 `Terminated date must be on or after effective date` |
| `terminatedAt > today` (`todayInTimeZone("Asia/Shanghai")` 比较) | 400 `Terminated date cannot be in the future` |
| `terminationReason.length > 500` | 400 `Reason too long` |

> **日期校验的可执行定义**：`parseLocalDate` 对越界数值容忍（`new Date("2026-99-99")` 会被 JS 引擎滚到 2034 年），不能单独使用。必须用 regex 先卡死格式再做 round-trip：`const d = parseLocalDate(s); if (formatLocalDate(d) !== s) reject(...)`（`formatLocalDate` 见 `packages/db/src/lib/date-utils.ts:40`）。`today` 一律走 `todayInTimeZone("Asia/Shanghai")` (`packages/db/src/lib/date-utils.ts:63`)。
>
> **校验的是 DB status，不是 display**：判断"是否处于终止态"必须直接读 `policy.status`，**不要** `deriveDisplayStatus()`。Expired 是纯展示语义，业务层应允许过期 Active 保单走 terminate 流程。
>
> **terminatedAt 可改方向**：v1 允许任意修改（向前向后均可），因为没有 payments tombstone 要维护一致性。修改 terminatedAt 后读路径过滤窗口自动跟随，原本被过滤的 Pending/Overdue 会重新可见或重新隐藏。同一终止态下二次 POST 视为"编辑终止信息"，允许覆写 `terminatedAt` / `terminationReason`。
>
> **老数据补录例外**：migration 只是把新列加成 nullable，不做 backfill。schema 升级前可能已存在 `status` 是终止态但 `terminated_at IS NULL` 的老数据，业务约束又要求终止态 `terminated_at` 必填 —— 不开例外这些保单会永久停在非法组合，且因为 status 相同（终止态 → 同一终止态），上方的"互转"检查不会拦它们。所以 terminate handler 显式允许：**当 `existing.status` 与 body `status` 相同时（含老数据 + 修改终止信息两条路径），无视 existing 的 metadata 状态，覆写 `terminatedAt` / `terminationReason` 即可**。前端在终止态保单上显示的"修改终止信息"按钮就是给这条路径用的；老数据用户首次打开 dialog 时 `terminatedAt` 字段为空（无预填），用户填好 today 或回忆的日期，提交即补录成功。

**Behavior：**

单条 Drizzle UPDATE，与现有 PUT 同风格：

```typescript
await repos.policies.update(policyId, {
  status,
  terminatedAt,
  terminationReason: terminationReason ?? null,
  plannedSurrenderAt: null,        // 自动清空意向标记，已被终止动作"履行"
  plannedSurrenderNote: null,
});
```

无 batch、无 raw `.bind()`、无 fake D1 shim 改造 —— `apps/worker/__tests__/e2e/setup.ts` 的现有 `prepare().first()` shim 足够。

**Response：**

```typescript
{
  id: number;
  status: "Surrendered" | "Claimed" | "Lapsed";
  terminatedAt: string;
  terminationReason: string | null;
}
```

### 新增：PUT /api/policies/:id/planned-surrender

**Request body：**

```typescript
{
  plannedSurrenderAt: string | null;     // ISO date or null to clear
  plannedSurrenderNote?: string | null;  // optional, max 500 chars
}
```

**Validation：**

| 检查 | 错误响应 |
|------|----------|
| 保单不存在 | 404 |
| `existing.status !== "Active"`（按 DB status 判定） | 400 `Planned surrender can only be set on Active policies` |
| `plannedSurrenderAt` 非 null 且不符合 regex + round-trip | 400 |
| `plannedSurrenderAt` 非 null 且 `< policy.effectiveDate` | 400 `Planned surrender date must be on or after effective date` |
| `plannedSurrenderNote.length > 500` | 400 |

> `plannedSurrenderAt > today` 不校验 —— 允许未来日（典型场景：用户记一笔"3 个月后准备退保"作为提醒）。

**Behavior：** 单条 UPDATE。Note 缺省 normalize 为 `null`。

### 反向操作：复用 PUT /api/policies/:id

切回 `Active` 走现有 PUT，body 里 `status="Active"`；PUT handler 当 `body.status === "Active"` 且 DB 当前为终止态时，强制 `terminatedAt=null` / `terminationReason=null`。

PUT **不**触碰 payments —— 不需要恢复任何东西，原 Pending/Overdue 行从未被改过 DB 值，过滤规则解除后自动重新可见。

### 通用 POST / PUT 禁写非 Active 状态（旁路封堵）

`POST /api/policies` 与 `PUT /api/policies/:id` 现接受任意 `body.status`；任何前端跳过 dialog 都能写出 `status=Surrendered, terminated_at=null` 的非法组合。

API 层强约束：

- `POST /api/policies`：当 `body.status` ∈ {`Surrendered`, `Claimed`, `Lapsed`} 时返回 400 `Cannot create a policy in a terminated state — use POST /api/policies/:id/terminate after creation`。新建只允许 Active（默认）。**同样禁止 POST body 携带 `terminatedAt` / `terminationReason` / `plannedSurrenderAt` / `plannedSurrenderNote` 任一字段**，任一非 undefined 即返回 400 `Cannot set termination or planned-surrender metadata on create — use the dedicated transition endpoints after creation`。不走 silent-ignore 路径：silent-ignore 会让前端误以为数据已落地，对账时才发现字段没写入，更难排查。
- `PUT /api/policies/:id`：当 `body.status` ∈ {`Surrendered`, `Claimed`, `Lapsed`} 且与 DB 不一致时返回 400 `Use POST /api/policies/:id/terminate to transition into a terminal status`；即便 `body.status` 与现有相等，也不允许通过 PUT 修改 `terminatedAt` / `terminationReason` / `plannedSurrenderAt` / `plannedSurrenderNote`（这四个字段只能由专用端点改），任一非 undefined 即 400。
- `PUT` 切回 Active 仍强制清空 metadata。

UI 层呼应：

- `apps/web/src/app/policies/policy-sheet.tsx:65` 的 `statusOptions` 收窄到 Active-only（新建保单不再渲染 status 字段）。
- "编辑保单" sheet 的状态字段移除 / readonly；状态变更只能走详情页 MetaColumn 的按钮 + dialog。

### PolicyDetail 响应

`apps/worker/src/routes/policies.ts` 的 GET single (line 125-128) 与 `apps/web/src/lib/types/policy.ts:9-41` 的 `PolicyDetail` interface 均新增：

```typescript
terminatedAt: string | null;
terminationReason: string | null;
plannedSurrenderAt: string | null;
plannedSurrenderNote: string | null;
```

**GET list 不动**：列表只渲染 status badge + 关键展示字段（见 `PolicySummary`），不需要 metadata。所有需要这些字段的 UI（详情 dialog / Timeline / MetaColumn）都通过详情接口拿。

## Payments 过滤规则（纯读路径）

终止保单的未来 Pending/Overdue 不应再出现在 UI / 统计 / 提醒里，但 DB 值不改。规则集中在读路径，一处实现，多处复用。

**新增 helper**（`packages/db/src/types.ts` 与 `isEffectivelyActive` 同位置）：

```typescript
/**
 * Whether a payment row should be hidden / excluded after the policy's
 * termination has invalidated future unpaid installments.
 *
 * Pure derivation — does not mutate the row. Returns true only when:
 *   - policy is in a terminal state (terminatedAt is non-null), AND
 *   - dueDate falls strictly after terminatedAt, AND
 *   - the row was never actually paid (status !== "Paid").
 *
 * Paid rows are always real history and never filtered, regardless of
 * dueDate vs terminatedAt.
 */
export function isObsoletedByTermination(
  payment: { dueDate: string; status: "Pending" | "Paid" | "Overdue" },
  policyTerminatedAt: string | null,
): boolean {
  if (!policyTerminatedAt) return false;
  if (payment.status === "Paid") return false;
  return payment.dueDate > policyTerminatedAt;  // 字符串比较即可，ISO date 形如 "YYYY-MM-DD"
}
```

消费点：

| 文件 | 当前 | 改为 |
|------|------|------|
| `apps/web/src/components/policy-detail/payments-section.tsx` 行列表 | 渲染所有缴费行 | 过滤掉 `isObsoletedByTermination` 为 true 的行（或灰显并加 "已随终止失效" 标签 —— 见 UI 节） |
| 同上：统计 paidCount / 未结清等 | 数全表 | 排除 `isObsoletedByTermination` 行 |
| 同上：缴费写入入口（add / generate / 行级 PUT / DELETE） | 永远显示 | 当 `policy.status` ∈ 终止态时隐藏 add / generate，行级编辑禁用（见 [Payments 写入路径在终止态下的封禁](#payments-写入路径在终止态下的封禁)） |
| 提醒 / 续保日历（若读 payments） | 全部计入 | 同样过滤 |

> **为什么不直接删未来未缴行**：留着原行避免"反向切回 Active 又得重新 generate"的麻烦 —— PUT `status=Active` 解除终止后，过滤规则自动失效，原 Pending/Overdue 重新可见，零数据丢失。代价是 DB 里多一些"潜在被过滤"的行，但 payments 表本就是按 policy id 分组的小集合（一张保单几十期到顶），无性能问题。

## 终止后非破坏字段的写入封禁

终止保单不应继续接受缴费扩张操作。语义与 v1 简化方向一致：**只封死扩张 / 破坏**，**不**做"Cancelled 行级永久保护"那种重型规则。

| 路由 | 终止态行为 |
|------|------------|
| `POST /api/policies/:id/payments` (`apps/worker/src/routes/policies.ts:232`) | 400 `Cannot add payments to a terminated policy` |
| `POST /api/policies/:id/payments/generate` (`apps/worker/src/routes/policies.ts:301`) | 400 `Cannot generate payments for a terminated policy` |
| `PUT /api/policies/:id/payments/:paymentId` (`apps/worker/src/routes/policies.ts:258`) | 终止态下 body 严格限定为 `{ status: "Paid", paidDate?, paidAmount? }` 形状：(1) `status` 字段缺失或非 `"Paid"` → 400；(2) 出现 `dueDate` / `amount` / `periodNumber` 等结构字段 → 400 `Cannot modify payment structure in a terminated policy`；(3) 允许 `paidDate` / `paidAmount` 任意值。用于补录历史已缴 |
| `DELETE /api/policies/:id/payments/:paymentId` (`apps/worker/src/routes/policies.ts:287`) | 400 `Cannot delete payments of a terminated policy`；整张保单的 `DELETE /api/policies/:id` 级联删除不受影响 |

L2 必须覆盖：终止后 POST/generate/DELETE → 400；PUT body 含 `dueDate`/`amount`/`periodNumber` → 400；PUT Paid→Pending → 400；PUT 仅传 `{status:"Paid", paidDate}` → 200；PUT Overdue→Paid → 200。

## UI

### 1. Badge `rose` variant 注册

只用于"拟退保"标记的副标签。`apps/web/src/components/ui/badge.tsx` 的 `badgeVariants.variant` 增加：

```typescript
rose: "border-transparent bg-[hsl(var(--badge-red))] text-[hsl(var(--badge-red-foreground))] hover:bg-[hsl(var(--badge-red)/0.9)]",
```

复用已存在的 `--badge-red` token（hue 340° 玫红，比 `--destructive` 0° 纯红柔和），无需改 globals.css。

`apps/web/src/lib/constants/policy.ts` 的 `statusConfig` 不动（status 没扩）；新增小工具 `renderPolicyStatusBadges(policy)` 返回数组（主 badge 来自 `statusConfig[status]`；若 `policy.plannedSurrenderAt` 非空且 `policy.status` ∈ {`Active`, `Expired`}，追加 `{ variant: "rose", label: \`拟退保 ${plannedSurrenderAt}\` }`）。

> **副 badge 的可见范围**：拟退保副 badge **仅在保单详情页**显示（详情接口返回 `plannedSurrenderAt`）。列表 / dashboard / 速查卡片所用的 `PolicySummary` 不含 `plannedSurrenderAt` 字段，`renderPolicyStatusBadges` 在该字段为 `undefined` 时静默退化为单 badge —— 不抛错、不假阳性。这是有意取舍：列表视图本就是"扫一眼当前状态"，把 N 张 Active 保单全部挂"拟退保"副 badge 会污染视觉密度；用户想看哪一张谁标了拟退保，进详情页一目了然。哥若以后真的要在列表页显示拟退保旗标，再把 `plannedSurrenderAt` 升入 `PolicySummary` + list 路由返回。

### 2. Action Buttons in MetaColumn

挂载位置：`apps/web/src/components/policy-detail/meta-column.tsx:1044-1077` Header 区块下方。按钮渲染由 `policy.status` 驱动：

| 当前 status | 显示按钮 |
|-------------|----------|
| `Active` / `Expired` | 退保 / 理赔 / 失效（三按钮横排）+ "标记/编辑拟退保"（链接样式，secondary） |
| `Surrendered` / `Claimed` / `Lapsed` | "修改终止信息"（复用 dialog 预填）+ "恢复 Active"（AlertDialog 二次确认） |

按钮配置：

| 按钮 | Label | Icon | Variant | 目标 |
|------|-------|------|---------|------|
| 退保 | 退保 | `CircleSlash` | `outline` | `POST /terminate` Surrendered |
| 理赔 | 理赔 | `BadgeCheck` | `outline` | `POST /terminate` Claimed |
| 失效 | 标记失效 | `CircleX` | `destructive` | `POST /terminate` Lapsed |
| 拟退保 | 标记/编辑拟退保 | `Clock` | `link` text-`rose` | 打开 PlannedSurrenderDialog |
| 修改终止信息 | 修改终止信息 | `Pencil` | `outline` | 复用 TerminationDialog 预填 |
| 恢复 Active | 恢复 Active | `RotateCcw` | `outline` | AlertDialog → PUT |

### 3. Dialogs

**`TerminationDialog`**（`apps/web/src/components/policy-detail/termination-dialog.tsx`，CREATE）：

| Props | 类型 |
|-------|------|
| `policy` | `PolicyDetail` |
| `open` | `boolean` |
| `targetStatus` | `"Surrendered" \| "Claimed" \| "Lapsed"` |
| `onOpenChange` | `(open: boolean) => void` |
| `onSuccess` | `() => void`（触发 refreshPolicy + refreshPayments） |

字段：`terminatedAt`（必填，`[effectiveDate, today]`，默认 today；预填路径下复用 `policy.terminatedAt`）；`terminationReason`（可选，最多 500 字符，预填 `policy.terminationReason ?? ""`）。

标题文案：

| `targetStatus` | Dialog title |
|----------------|--------------|
| `Surrendered` | 退保 - {productName} |
| `Claimed` | 理赔结案 - {productName} |
| `Lapsed` | 标记失效 - {productName} |

确认按钮 `variant="destructive"`，提交 `POST /terminate`，成功后 toast `已退保 / 已理赔 / 已失效（N 笔未来缴费已隐藏）`，N = 当时被读路径过滤掉的 Pending/Overdue 数量（前端直接根据 `payments` 列表 + `isObsoletedByTermination` 算，不需要 API 返回）。

**`PlannedSurrenderDialog`**（同目录，CREATE）：

| 字段 | 类型 | 校验 |
|------|------|------|
| `plannedSurrenderAt` | date | 必填，`>= effectiveDate`，允许未来日 |
| `plannedSurrenderNote` | text | 可选，最多 500 字符 |

底部除"取消" / "保存"外，多一个 ghost 按钮 "清除拟退保标记" → PUT `{plannedSurrenderAt: null, plannedSurrenderNote: null}`。

### 4. Status 字段在 BasicInfoSection 改 readonly

`apps/web/src/components/policy-detail/meta-column.tsx:53-58, 257-264` 当前用 `EditableInfoRow` 渲染状态下拉；改为 readonly 标签（显示 `statusConfig[status].label` + 拟退保副 badge），不再可编辑。所有状态变更只走 MetaColumn 的按钮 + dialog 入口，避免"下拉拦截 + 弹窗"两套互相干预的入口。

### 5. Payments Section

`apps/web/src/components/policy-detail/payments-section.tsx`：

- `PaymentsSectionProps` (line 24) 新增必填 `policyStatus: PolicyStatus` + `policyTerminatedAt: string | null`
- 行列表过滤：`policy.terminatedAt` 非空时，把 `isObsoletedByTermination` 为 true 的行**默认折叠**到表尾 "N 笔已随终止失效"折叠区（点击展开后整行加 `line-through text-muted-foreground` 灰显）；用户不会误以为这些是当前要处理的项，但也能查
- 统计：paidCount / 未结清等忽略被 `isObsoletedByTermination` 标记的行
- 新增 / 生成入口：`policy.status` ∈ 终止态时，"添加缴费记录" (line 455) 与"生成本年度缴费" (line 529) 整体隐藏
- 行级编辑（terminate 后）：编辑表单的 status `<Select>` 仅显示 `Paid` 一个选项（呼应 API `* → Paid` 规则）；行级删除按钮隐藏
- payments 类型 `PaymentStatus` 不扩 enum（仍是 `Pending | Paid | Overdue`），不引入 `Cancelled`

## Timeline Rendering

`apps/web/src/components/policy-detail/timeline-column.tsx:7-13` 的 `TimelineEvent` 类型保持现有 `type: "past" | "today" | "future"` 三态，**不**新增枚举。改造 `buildTimeline`：

1. 函数从 `policy` 读 `policy.status` / `policy.terminatedAt`（已经接收 policy 全量，无需改 props）
2. 若 `policy.terminatedAt` 非空且 `policy.status` ∈ 终止态：
   - 计算 `terminatedTime = parseLocalDate(policy.terminatedAt).getTime()`
   - 过滤掉 `eventTime > terminatedTime` 的 payments / 续期事件（与 payments-section 的过滤规则同源）
   - 在 list 中插入一个 milestone：`{ date: terminatedDate, dateStr: terminatedAt, label: { Surrendered: "退保", Claimed: "理赔结案", Lapsed: "失效" }[status], type: "today" }`（复用现有 `today` 渲染分支的强调样式，无需新分支）
   - 抑制原本的 `today` 标记（保单已终止，"今天"在 timeline 语义里失效）
3. 若 `policy.plannedSurrenderAt` 非空且 display status ∈ {`Active`, `Expired`}：在该日期插入一个 milestone `{ label: "计划退保", type: "future" }`，**不**抑制 today、**不**过滤未来事件 —— 仅作为视觉提示

不引入 `cancelled` / `terminated` / `plannedSurrender` 新事件类型，不需要扩展排序 map。简单实现，简单回退。

## File Changes

### Phase 1: Data Layer

| File | Action | Description |
|------|--------|-------------|
| `packages/db/src/schema.ts` | MODIFY | `policies` table 追加 4 列：`terminatedAt`, `terminationReason`, `plannedSurrenderAt`, `plannedSurrenderNote` |
| `packages/db/src/index.ts` | MODIFY | INIT_SQL 中 `policies` CREATE TABLE 同步追加 4 列 (line 280-313) |
| `packages/db/src/types.ts` | MODIFY | 新增 `TerminalPolicyStatus = "Surrendered" \| "Claimed" \| "Lapsed"` 与 `isObsoletedByTermination(payment, policyTerminatedAt)` helper |
| `drizzle/000X_policy_status.sql` | CREATE | drizzle-kit generate 产出 4 条 `ALTER TABLE policies ADD COLUMN` |

### Phase 2: API Layer

| File | Action | Description |
|------|--------|-------------|
| `apps/worker/src/routes/policies.ts` | MODIFY | 新增 `POST /api/policies/:id/terminate`（单表 UPDATE 风格同 PUT）；新增 `PUT /api/policies/:id/planned-surrender`；GET single 响应 shape 增加 4 个新字段 (line 125-128) |
| `apps/worker/src/routes/policies.ts` | MODIFY | PUT handler 内追加：当 `body.status === "Active"` 时强制 `terminatedAt=null`, `terminationReason=null` |
| `apps/worker/src/routes/policies.ts` | MODIFY | `POST /api/policies` (line 50) 与 `PUT /api/policies/:id` (line 131) 加守卫拒绝通用 CRUD 直接写终止态；同时拒绝 PUT 修改 4 个 metadata 字段（必须走专用端点） |
| `apps/worker/src/routes/policies.ts` | MODIFY | `POST /api/policies/:id/payments` (line 232)、`POST /api/policies/:id/payments/generate` (line 301)、`DELETE /api/policies/:id/payments/:paymentId` (line 287) 终止态返回 400；`PUT /api/policies/:id/payments/:paymentId` (line 258) 终止态仅允许 `* → Paid` |

> Phase 2 **无** fake D1 batch shim、**无** raw `.bind()`、**无** D1 binding.batch 调用 —— 单表 UPDATE 走现有 Drizzle 路径即可。

### Phase 3: UI Core

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/lib/types/policy.ts` | MODIFY | `PolicyDetail` 接口新增 4 个字段；`PolicySummary` 不动 |
| `apps/web/src/components/ui/badge.tsx` | MODIFY | `badgeVariants.variant` 增加 `rose` 分支 |
| `apps/web/src/lib/constants/policy.ts` | MODIFY | 新增 `renderPolicyStatusBadges(policy)` 工具函数返回主+副 badge 数组 |
| `apps/web/src/components/policy-detail/termination-dialog.tsx` | CREATE | 三种终止态共用 |
| `apps/web/src/components/policy-detail/planned-surrender-dialog.tsx` | CREATE | display status ∈ {`Active`, `Expired`} 时可见（按钮 / 链接同步） |
| `apps/web/src/components/policy-detail/meta-column.tsx` | MODIFY | Header 下新增 "操作" 区块挂三按钮 + 拟退保链接 + 反向恢复；BasicInfoSection 的 status `EditableInfoRow` 改为 readonly 显示，含主+副 badge；切回 Active 走 `AlertDialog` 二次确认 |
| `apps/web/src/components/policy-detail/payments-section.tsx` | MODIFY | `PaymentsSectionProps` 新增 `policyStatus` + `policyTerminatedAt`；未来未缴行折叠到表尾 "已随终止失效" 区；统计排除被过滤行；终止态下 add/generate 按钮隐藏，行级编辑 status select 仅留 Paid，删除按钮隐藏 |
| `apps/web/src/app/policies/[id]/page.tsx` | MODIFY | `<MetaColumn>` 传入 `onTransitionSuccess` 回调；`<PaymentsSection>` 补传 `policyStatus`、`policyTerminatedAt` |
| `apps/web/src/app/policies/policy-sheet.tsx` | MODIFY | `statusOptions` (line 65) 收窄为 Active-only |

### Phase 4: Timeline Component

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/components/policy-detail/timeline-column.tsx` | MODIFY | `buildTimeline` 接收 policy 后，终止态下过滤 `eventTime > terminatedTime` 的事件、抑制 today、插入终止 milestone（复用 `today` 渲染分支）；display status ∈ {`Active`, `Expired`} 且 `plannedSurrenderAt` 非空时插入 "计划退保" milestone（type=`future`） |
| `apps/web/src/__tests__/timeline.test.ts` | CREATE | 覆盖：终止后未来事件被过滤 / today 标记被抑制 / 终止 milestone 出现在正确位置 / 拟退保 milestone 在 display Active 下出现且不影响其它事件 / 拟退保 milestone 在 display Expired 下同样出现（DB Active + expiryDate 已过）|

## Verification

### L1 单元测试 (`bun run test`)

- `packages/db/__tests__/types.test.ts`（如不存在则 CREATE）：`isObsoletedByTermination` 的边界（terminatedAt 为 null / Paid 永不过滤 / dueDate 等于 / 早于 / 晚于 terminatedAt）
- `apps/web/src/__tests__/timeline.test.ts`：上方 4 点
- `apps/web/src/__tests__/termination-dialog.test.ts`：表单 validation（日期范围、reason 长度、预填路径）
- `apps/web/src/__tests__/planned-surrender-dialog.test.ts`：表单 validation + 清除按钮 emits `{plannedSurrenderAt: null, plannedSurrenderNote: null}`

`bun run test:coverage` 行 / 函数覆盖率仍需 ≥ 95%。

### G1 静态 (`bun run typecheck` + `bun run lint`)

- 新 `PolicyDetail` 字段在所有消费者编译通过
- 零 ESLint 警告

### L2 集成 (`bun run test` 覆盖 `apps/worker/__tests__/e2e/policies.e2e.test.ts`)

收窄到核心目标：

**Terminate：**

| 用例 | 期望 |
|------|------|
| POST terminate 成功 | 200，policy 状态变为目标终止态，metadata 写入；`plannedSurrenderAt` / `plannedSurrenderNote` 被自动清空 |
| POST terminate 幂等 | 二次调用同一终止态覆写 metadata，仍 200（"修改终止信息"路径） |
| POST terminate 把 terminatedAt=NULL 的老数据补录 | 200，写入 metadata，不报互转错（前后 status 相同） |
| POST terminate 非法 `terminatedAt`（regex / round-trip / 早于 effective / 未来日期） | 400 |
| POST terminate 非法 status（Active） | 400 |
| POST terminate 不存在的 policy | 404 |
| POST terminate 在不同终止态之间互转（如 Surrendered → Lapsed） | 400 |
| POST terminate 对 DB Active 但 display Expired 的保单 | 200（校验 DB status） |
| terminate 后 GET payments 原始数据 | 所有行 status 保持原值（不翻转） |
| terminate 后再 terminate 同保单改 terminatedAt 前 / 后移 | 都允许（v1 不维护单调） |

**Planned surrender：**

| 用例 | 期望 |
|------|------|
| PUT planned-surrender 成功（未来日） | 200 |
| PUT planned-surrender 清空（null） | 200 |
| PUT planned-surrender 在终止态保单上 | 400 |
| PUT planned-surrender 非法日期 | 400 |
| 直接 terminate 后 GET policy | `plannedSurrenderAt` / `plannedSurrenderNote` 已被清空 |

**通用 CRUD 旁路：**

| 用例 | 期望 |
|------|------|
| POST `/api/policies` body.status="Surrendered" | 400 |
| POST `/api/policies` body 携带 `terminatedAt` / `terminationReason` / `plannedSurrenderAt` / `plannedSurrenderNote` 任一字段 | 400 `Cannot set termination or planned-surrender metadata on create — use the dedicated transition endpoints after creation` |
| PUT `/api/policies/:id` 把 Active 直接改成 Lapsed | 400 |
| PUT `/api/policies/:id` 修改 `terminatedAt` / `plannedSurrenderAt` 等 metadata | 400（必须走专用端点） |

**Payments 写入封禁：**

| 用例 | 期望 |
|------|------|
| 终止后 POST `/api/policies/:id/payments` | 400 |
| 终止后 POST `/api/policies/:id/payments/generate` | 400 |
| 终止后 DELETE 行级 payment | 400 |
| 终止后 DELETE 整张保单 | 200 |
| 终止后 PUT Pending 行改 Paid | 200 |
| 终止后 PUT Overdue 行改 Paid | 200 |
| 终止后 PUT Paid 行改 Pending | 400 |
| 终止后 PUT body 含 `dueDate` / `amount` / `periodNumber` | 400 `Cannot modify payment structure in a terminated policy` |
| 终止后 PUT 仅传 `{status:"Paid", paidDate, paidAmount}` | 200 |

**反向切回：**

| 用例 | 期望 |
|------|------|
| 终止后 PUT status=Active | 200，metadata 清空 |
| 反向切回 Active 后 GET payments | 原 Pending/Overdue 行的 DB status 始终保持原值（从未被改） |
| 反向切回 Active 后 POST payments | 200（守卫解除） |

L2 HTTP 套件 `bun run test:l2:http` 走一遍 terminate + planned-surrender 路径，验证 D1 binding 与 sqlite-proxy 行为一致 —— 跑前先 `bun run db:push` 把新列推到 dev D1。

### L3 浏览器 E2E (`bun run test:e2e:browser`, 可选)

`apps/web/e2e/policy-status.spec.ts`：

1. 创建保单 → 生成 12 期月缴 → 标记拟退保（填未来日 + note）→ 验证主 badge 仍 "生效中"，副 badge 显示 "拟退保 YYYY-MM-DD"
2. 清除拟退保 → 副 badge 消失
3. 点 "退保" → 填今日 + reason → 提交 → 验证 Timeline 出现 "退保" milestone、未来缴费折叠到 "已随终止失效" 区、状态 Badge 变 "已退保"
4. 切回 Active → AlertDialog 出现 → 确认 → 状态变 Active，原 Pending 行重新出现在主列表

## Atomic Commit Sequence

| # | Message | Scope |
|---|---------|-------|
| 1 | `feat(db): add terminated_at / termination_reason / planned_surrender_at / planned_surrender_note columns` | `packages/db/src/schema.ts`, INIT_SQL, drizzle migration |
| 2 | `feat(db): add isObsoletedByTermination helper + TerminalPolicyStatus type` | `packages/db/src/types.ts` + L1 test |
| 3 | `feat(api): add /terminate and /planned-surrender; lock down CRUD bypass routes` | `apps/worker/src/routes/policies.ts`（两个 handler + PUT auto-clear + status & metadata 守卫 + payments 路由的终止态守卫），`apps/web/src/lib/types/policy.ts` PolicyDetail 4 个字段 |
| 4 | `test(e2e): cover terminate, planned-surrender, bypass guards, payments lockdown, reactivate` | `apps/worker/__tests__/e2e/policies.e2e.test.ts` |
| 5 | `feat(ui): badge rose variant + dual-badge renderer; termination + planned-surrender dialogs` | `apps/web/src/components/ui/badge.tsx`, `apps/web/src/lib/constants/policy.ts`, `apps/web/src/components/policy-detail/termination-dialog.tsx`, `apps/web/src/components/policy-detail/planned-surrender-dialog.tsx` + L1 tests |
| 6 | `feat(ui): wire action buttons in MetaColumn; status field readonly` | `apps/web/src/components/policy-detail/meta-column.tsx`, `apps/web/src/app/policies/[id]/page.tsx`, `apps/web/src/app/policies/policy-sheet.tsx` 收窄 statusOptions |
| 7 | `feat(ui): payments section filters obsoleted rows in terminated state` | `apps/web/src/components/policy-detail/payments-section.tsx` |
| 8 | `feat(ui): timeline filters future events in terminated state; planned-surrender milestone` | `apps/web/src/components/policy-detail/timeline-column.tsx` + L1 test |

每个 commit 独立通过 `bun run typecheck` + `bun run lint` + `bun run test`。Commit 1 (DB-only) 是 hot-path：单独 push 到 dev D1 + 跑 schema check。Commit 3-4 形成 API 闭环；Commit 5-8 形成 UI 闭环，互不阻塞。

## Open Questions / Future Extensions

| 议题 | v1 决策 | v2 候选 |
|------|---------|---------|
| **PendingSurrender 是否升 DB status？** | 不升，仅用 `planned_surrender_at` 标记字段 | v2 若有"拟退保下停止生成 / 自动提醒到期未行动 / 拟退保计入 funnel 分析"等真实需求再说，届时把标记字段升 enum |
| **payments Cancelled enum + 永久审计** | 不引入，未来未缴在读路径过滤 | v2 若引入"已发生的 Pending 期次也要保留作为不缴费证据"则升级 |
| **terminatedAt 单调约束** | 不约束（无 payments tombstone 要维护一致性） | v2 若 v2 加 Cancelled enum 才需要再讨论 |
| **退保金额 / 现金价值联动** | 不在 schema | v2 dialog 中读 `cashValues` 表展示当前现金价值；可选填入 `refundAmount` 列 |
| **理赔金额 / 出险信息** | 不在 schema | v2 加 `claim_amount` + R2 附件挂理赔材料 |
| **Lapsed 自动检测** | 手动触发 | v2 cron 检测连续 N 个 Overdue 自动建议进入 Lapsed |
| **拟退保到期未行动提醒** | timeline milestone 视觉提示 | v2 cron 检测 `today >= planned_surrender_at` 在 dashboard 红点 / 邮件提醒 |
| **审计日志表** | 无 | v2 通用 `audit_log` 记录所有 terminate / reactivate 动作 |
