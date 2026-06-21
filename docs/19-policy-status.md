# 19. Policy Status & Transitions

## Context

`policies.status` 是单字符串枚举，存了 `Active / Lapsed / Surrendered / Claimed`，display 层再派生出 `Expired`。这套状态机的几个空洞：

- **审计盲区**：终止动作（退保 / 理赔 / 失效）没有 `terminated_at` / `termination_reason` 记录，事后无法追溯何时、为何终止；未来想统计退保率或理赔触发原因都没数据基础。
- **缺少决策中间态**：现实里"想退但还没到手续日"是常见状态 —— 用户已经决定退保，正在等现金价值结算 / 等客服回电 / 拍照存档。这段时间保单数据上仍是 `Active`，提醒和缴费照常发，但用户心智上已经"放弃"了；缺少一个明面上的"拟退保"状态承接这段过渡期。
- **缴费悬挂**：用户把状态切到终止态后，已经生成的未来期 `Pending` / `Overdue` 缴费记录仍然挂在 policy 上，列表 / 统计 / 提醒会继续把这些"鬼缴费"算进来。
- **时间线失真**：`apps/web/src/components/policy-detail/timeline-column.tsx` 完全不读 `policy.status`，即使是已退保保单，未来缴费、续期、到期事件仍然按 `"future"` 渲染，"今天" 标记也照常画在终止日之后，让用户以为保单还在跑。
- **元数据易丢失**：`apps/web/src/components/policy-detail/meta-column.tsx` 的状态下拉里直接选 `Surrendered/Claimed/Lapsed` 会触发普通 PUT，没有任何二次确认或字段补录入口，用户切错状态没有回放手段。
- **状态旁路**：通用 POST/PUT `/api/policies` 接受 `body.status` 写入任何枚举值，普通 CRUD 路径可绕过专用 transition 接口，写出 `Surrendered` 但缺 `terminated_at` 的非法组合。

本文档把所有保单状态、迁移规则、UI 表现、API 守卫、数据副作用集中描述成一个完整的状态机方案，作为单一真值源（之前散落在多处的 status 处理代码以此为准）。新增 1 个状态（`PendingSurrender` 拟退保）、2 列审计字段、1 个 payments 枚举值、1 个 atomic transition API、1 个对话框、1 套 timeline 渲染分支；其他延伸（退保金额、理赔金额、自动失效检测、`status_history` 审计表）留到 v2。

## Scope

In scope：

- 状态枚举扩展：新增 `PendingSurrender`（"拟退保"），DB enum 从 `Active|Lapsed|Surrendered|Claimed` 扩到 `Active|PendingSurrender|Lapsed|Surrendered|Claimed`；display 派生维持 `Expired`
- 三个终止态：`Surrendered` / `Claimed` / `Lapsed`，统一走同一条 terminate 工作流（区别仅在按钮 / 标题文案 / 图标）
- 中间态 `PendingSurrender` 走单独的 mark-pending-surrender 工作流，**不**翻转缴费记录；缴费**新增 / 生成 / 删除**入口同终止态收紧（保单已表明退保意向，不该再扩张缴费），但**既有缴费行编辑（mark Paid 等）仍按 Active 行为**（保单还在跑，可能补录线下已缴）
- 新增列：`policies.terminated_at` (TEXT, ISO date) + `policies.termination_reason` (TEXT, nullable)；这两列同时承担 `PendingSurrender` 的"计划日 / 原因"语义（详见 [Data Model](#data-model)）
- payments 枚举扩展：`Pending|Paid|Overdue` → `Pending|Paid|Overdue|Cancelled`
- 终止后批量翻转**未实际缴费**的缴费（`Pending` / `Overdue`）→ `Cancelled`（只针对 `dueDate > terminated_at`；`Paid` 永不动）
- 新 API：
  - `POST /api/policies/:id/terminate`：原子化执行（policy 状态 + 元数据 + payments 批量翻转）
  - `POST /api/policies/:id/mark-pending-surrender`：仅写 policy 元数据，不动 payments
- 终止 / 拟退保对话框：捕获 `terminated_at` (必填) + `termination_reason` (可选)
- 四个动作按钮 (拟退保 / 退保 / 理赔 / 失效)，挂在 `MetaColumn` 顶部
- BasicInfoSection 状态下拉拦截：选中任一非 `Active` 值改为打开对应对话框而不是直发 PUT
- 反向操作：
  - 从 `PendingSurrender` 切回 `Active`：直接 PUT，清空 metadata（无 cancel 副作用要回滚）
  - 从终止态切回 `Active`：`AlertDialog` 二次确认，清空 metadata，但**不**主动恢复已 `Cancelled` 的缴费
  - 从 `PendingSurrender` → 任一终止态：直接走 terminate 路径（视为"最终生效"，复用 dialog）
- Timeline 第 4 种事件类型 `"cancelled"`，渲染删除线 + 灰色 + 警示图标，并在 `terminated_at` 当天插入终止 milestone；`PendingSurrender` 不抑制 future 事件（保单还在跑），但在 `terminated_at`（计划日）插入"计划退保"软 milestone
- `PolicyDetail` 接口新增 `terminatedAt` / `terminationReason` 字段，所有相关 GET 响应回填
- 新 Badge variant `rose`：登记到 `@/components/ui/badge` variants，hue 取已存在的 `--badge-red`（玫红，柔于 `destructive`），专供 `PendingSurrender` 视觉

Out of scope (v2)：

- 退保金 / 理赔金金额字段（不在 schema）
- `cash_values` 联动建议（v2 可在对话框里展示当前现金价值作参考）
- 失效日期从最早 `Overdue` 缴费自动推断（v1 仍由用户在对话框里手填）
- `Cancelled` 缴费的物理删除 / tombstone 保留窗口（v1 永久保留 `Cancelled` 行，作为审计痕迹）
- 终止动作的撤销审计 / `status_history` 表
- `PendingSurrender` 到期未行动的自动提醒（v2 cron 检测 `today >= terminated_at` 且状态仍是 `PendingSurrender` 的保单提醒用户确认）

## Status Catalog

完整的 5 个 DB 状态 + 1 个 display-only 派生状态：

| 状态 | 来源 | 中文 | 含义 | Badge variant | 颜色 token | 是否终止 | metadata 要求 |
|------|------|------|------|---------------|------------|----------|----------------|
| `Active` | DB | 生效中 | 保单正常运转，缴费正常生成 | `success` | `--success` 142 71% 35% (绿) | 否 | `terminated_at` / `termination_reason` 必为 NULL |
| `PendingSurrender` | DB | 拟退保 | 用户已决定退保但未到手续日 / 等结算；缴费**不**自动取消，但**不允许**新增/生成 | `rose` (新增) | `--badge-red` 340 82% 55% (玫红) | 否（仍计入活跃统计） | `terminated_at` = 计划退保日（必填）；`termination_reason` 可选 |
| `Surrendered` | DB | 已退保 | 终止态：现金价值已结算或已发起退保 | `warning` | `--warning` 45 93% 47% (琥珀) | 是 | `terminated_at` 必填；`termination_reason` 可选 |
| `Claimed` | DB | 已理赔 | 终止态：理赔结案 | `purple` | `--purple` 270 70% 60% (紫) | 是 | 同上 |
| `Lapsed` | DB | 已失效 | 终止态：连续未缴 / 中止 / 其它原因失效 | `outline` | `--muted-foreground/30` (灰) | 是 | 同上 |
| `Expired` | derived | 已过期 | `dbStatus="Active"` 且 `expiryDate < now` 时派生（见 `packages/db/src/types.ts:24`） | `destructive` | `--destructive` 0 72% 51% (红) | 否（仅展示语义） | 不参与 DB 校验 |

> **颜色选择说明（拟退保）**：哥要求"类似红色但没那么红"。`destructive` 是纯红（hue 0°），用在删除 / 错误等强警示语义上；新增 `rose` variant 复用已存在的 `--badge-red`（hue 340°，玫红 / 浅红），色温接近红但偏粉、饱和度收一档，符合"决定退保但尚未行动"的中等警示语义 —— 比 Active 紧迫，比 `destructive`/`Expired` 柔和。同 palette 里 `--warning` 是琥珀色（已被 `Surrendered` 占用），不复用以免视觉撞色。Badge `rose` variant 注册细节见 [UI](#1-badge-rose-variant-注册)。

## Transition Matrix

横轴=新状态，纵轴=当前状态。✅=允许并明确路径；❌=禁止；—=无意义（同态）。

| from → to | Active | PendingSurrender | Surrendered | Claimed | Lapsed |
|-----------|--------|------------------|-------------|---------|--------|
| **Active** | — | ✅ `POST /mark-pending-surrender` | ✅ `POST /terminate` | ✅ `POST /terminate` | ✅ `POST /terminate` |
| **PendingSurrender** | ✅ PUT `status=Active`（清 metadata，无副作用） | — | ✅ `POST /terminate`（复用 dialog；`terminatedAt` 默认值规则见 [Transition Dialog 字段](#3-transition-dialog)） | ✅ `POST /terminate` | ✅ `POST /terminate` |
| **Surrendered** | ✅ PUT `status=Active`（AlertDialog 二次确认；不恢复 Cancelled 缴费） | ❌（终止后无意义） | — | ❌ | ❌ |
| **Claimed** | ✅ 同上 | ❌ | ❌ | — | ❌ |
| **Lapsed** | ✅ 同上 | ❌ | ❌ | ❌ | — |
| **Expired** (display) | 不可直接迁移；DB 仍是 Active，按 Active 的迁出规则处理 | 同左 | 同左 | 同左 | 同左 |

迁移规则的硬约束（与状态机一起强制）：

- **终止态之间禁止互转**（`Surrendered ↔ Claimed ↔ Lapsed`）：互转语义不清，强制走 Active 中转（PUT → Active → POST /terminate），用户必须显式经过 reactivate
- **`Active → 任一非 Active` 必须走专用 transition 端点**：`POST /mark-pending-surrender` 或 `POST /terminate`；通用 PUT 拒绝写入非 Active 状态（详见 [通用 POST / PUT 禁写非 Active 状态](#通用-post--put-禁写非-active-状态旁路封堵)）
- **`PendingSurrender → Surrendered/Claimed/Lapsed` 视为最终决策**：走 `POST /terminate`，按终止态全套语义处理（含 cancelPendingAfter）

## Data Model

### Policies 表

**Status enum 扩展**：`packages/db/src/schema.ts:127-131` 当前：

```typescript
status: text("status", { enum: ["Active", "Lapsed", "Surrendered", "Claimed"] })
  .notNull()
  .default("Active"),
```

改为：

```typescript
status: text("status", {
  enum: ["Active", "PendingSurrender", "Lapsed", "Surrendered", "Claimed"],
})
  .notNull()
  .default("Active"),
```

Drizzle 的 sqlite enum 仅做 TS 层校验，SQLite 表本身不生成 CHECK 约束，因此现有列升级无需 DDL，新增 `PendingSurrender` 值直接可写入。`packages/db/src/types.ts:11` 的 `PolicyDbStatus` 同步扩展：

```typescript
export type PolicyDbStatus =
  | "Active"
  | "PendingSurrender"
  | "Lapsed"
  | "Surrendered"
  | "Claimed";
export type TerminalPolicyStatus = "Surrendered" | "Claimed" | "Lapsed";
export type NonActivePolicyStatus = "PendingSurrender" | TerminalPolicyStatus;
```

`deriveDisplayStatus` 不动 —— `Expired` 仅从 `Active` 派生，`PendingSurrender` 不参与过期降级（拟退保保单已是用户主动选择的状态，让 expiry 二次覆盖反而扰乱信息）。

### 活跃判定 helper 与下游消费点

`PendingSurrender` 在 Status Catalog 里写了"仍计入活跃统计"，但现有 `isEffectivelyActive` 只承认 display `Active`（`packages/db/src/types.ts:34`），并且业务层散落着两种过滤写法：

- `isEffectivelyActive(p.status, p.expiryDate)` —— `packages/api/src/dashboard.ts:20`、`apps/worker/src/routes/renewal-calendar.ts:12`
- `p.status === "Active"` 直接字符串比较 —— `packages/api/src/coverage-lookup.ts:167, 190`

如果不显式处理，新增 `PendingSurrender` 后 dashboard 总数、续保日历、保障速查会立刻把拟退保保单当成"已失效"忽略 —— 这与拟退保的语义（保单还在跑、缴费照常、保障仍有效）相悖。

**统一新增** `isCoverageActiveStatus(dbStatus, expiryDate)`（在 `packages/db/src/types.ts` 与 `isEffectivelyActive` 同位置）：

```typescript
/**
 * "Coverage is still in force today" — true for both Active and
 * PendingSurrender, BUT only if the policy is not past its expiry date.
 *
 * Use for dashboards, coverage lookup, renewal reminders — anything whose
 * answer is "is this policy still protecting the member today?".
 *
 * PendingSurrender does NOT bypass expiry: a policy that already lapsed
 * its expiry date is no longer providing coverage even if the user later
 * decides they want to surrender it. The user's intent doesn't extend
 * protection that has already ended on the contract.
 *
 * Distinct from isEffectivelyActive() which is the stricter "fully Active,
 * not in any transition state". Most user-facing surfaces want the looser
 * one; only flows that explicitly mean "untouched, normal Active" should
 * stick with isEffectivelyActive (currently none, but kept for future).
 */
export function isCoverageActiveStatus(
  dbStatus: PolicyDbStatus,
  expiryDate: string | null,
  now: Date = new Date(),
): boolean {
  if (dbStatus !== "Active" && dbStatus !== "PendingSurrender") return false;
  // Apply the same expiry decay as deriveDisplayStatus: an Active or
  // PendingSurrender policy past its expiryDate is effectively expired.
  if (expiryDate) {
    const expiry = parseLocalDate(expiryDate);
    if (expiry < now) return false;
  }
  return true;
}
```

> **PendingSurrender 仍服从 expiry**：拟退保表达的是"用户想退保"的意向，不影响保单条款的到期事实。一张已过期的保单即使后来被标记 `PendingSurrender`，也不应在 dashboard / 保障速查 / 续保日历里复活 —— 用户的意向不能延长合同已结束的保障。展示层和判定层在这里**有意分离**：
>
> - **展示层** (`deriveDisplayStatus`)：DB status = `PendingSurrender` 时直接返回 `PendingSurrender`，**不**降级到 `Expired`（这是当前规则，让 badge 始终展示用户意向，避免拟退保保单的过期日把"拟退保"标签覆盖成"已过期"，造成用户以为状态机退回去了）。
> - **判定层** (`isCoverageActiveStatus`)：对 `Active` 和 `PendingSurrender` 都做 expiry 检查，过期就返回 false。
>
> 两者关注点不同：badge 表达"保单当前的状态意向"，coverage helper 回答"今天此保单是否还在提供保障"。terminate / mark-pending-surrender 端点的"读 DB status 而非 display"规则只影响 **transition 准入**（已过期保单仍能被用户主动终止 / 标记退保），不影响 **coverage 是否生效** 的判断（已过期就是不生效）。

下游消费点必须按此表逐一对齐（每条都进 File Changes / L2 测试）：

| 消费点 | 当前判定 | 改为 | 理由 |
|--------|----------|------|------|
| `packages/api/src/dashboard.ts:20` 活跃保单数 | `isEffectivelyActive` | `isCoverageActiveStatus` | 拟退保仍是用户当前持有的有效保单，统计应包含 |
| `packages/api/src/coverage-lookup.ts:167, 190, 230` 保障速查 | `p.status === "Active"` 字符串比较（输入为 display status，由 worker route line 38 `deriveDisplayStatus(...)` 先派生） | `isCoverageActiveStatus(p.dbStatus, p.expiryDate)`（输入改为 raw DB status，详见下方"输入类型校准"）；line 230 的 `isActive: policy.status === "Active"` 同步改成 helper，否则前端"是否在保"标记仍只认 Active，拟退保会被错标为失效 | 拟退保下保障仍生效，意外 / 重疾 / 医疗触发理赔可正常用；`isActive` 字段是前端保障列表、复制文本、急用联系人的判定依据 |
| `packages/api/src/coverage-lookup.ts:119` `STATUS_LABELS` | 5 个键不含 `PendingSurrender` | 追加 `PendingSurrender: "拟退保"` | `buildPolicyCards` 用 `STATUS_LABELS[policy.status] ?? policy.status` (line 229) 生成展示文案，不补 label 用户会看到裸枚举值 |
| `apps/worker/src/routes/renewal-calendar.ts:12` 续保提醒 | `isEffectivelyActive` | `isCoverageActiveStatus` | 拟退保期间续保提醒仍要发（用户没准确退完前需要决策） |
| `packages/api/src/renewal-calendar.ts`（如有同名） | 同上 | 同上 | 同上 |
| Web 端 `dashboard` / `policy-filters` 的 "活跃" 快速过滤 | 任何裸 `=== "Active"` 比较 | 用 helper | 同上 |
| 终止动作的"取消未来 Pending/Overdue 缴费" | 仅在 `policy.status` ∈ {`Surrendered`,`Claimed`,`Lapsed`} 触发 | 不变（拟退保不翻转） | 见 [Payments 写入路径在非 Active 状态下的封禁](#payments-写入路径在非-active-状态下的封禁) |

> **`isCoverageActiveStatus` 的输入类型校准**：helper 签名是 `(dbStatus: PolicyDbStatus, expiryDate)`，**必须接收 raw DB status**。`apps/worker/src/routes/coverage-lookup.ts:38` 当前把 `deriveDisplayStatus(...)` 派生后的 display string（可能含 `Expired`）塞进 `policy.status` 再传给 `buildPolicyCards`，这是错的语义入口 —— `buildPolicyCards` 拿到的 status 已经被 `Expired` 覆盖，再传给 helper 是 display string 而非 DB status。
>
> 改造方案（与 helper 切换同 commit），三件事一起做：
>
> 1. **worker route** 把 `dbStatus` (raw) 和 `status` (display) 作为两个独立字段塞进卡片对象：
>
>    ```typescript
>    const pd = {
>      id: policy.id, productName: policy.productName, ...,
>      dbStatus: policy.status as PolicyDbStatus,                              // 原始 DB 值
>      status: deriveDisplayStatus(policy.status as PolicyDbStatus, policy.expiryDate), // 展示用
>      expiryDate: policy.expiryDate,
>    };
>    ```
>
> 2. **`PolicyForCoverage` interface**（`packages/api/src/coverage-lookup.ts:31`）增加 `dbStatus: PolicyDbStatus` 字段，与现有 `status` 字段共存（status 保持 display 用途）。
>
> 3. **`buildPolicyCards` 内部所有过滤 / `isActive` 计算**（line 167、190、230）一律用 `isCoverageActiveStatus(p.dbStatus, p.expiryDate)`，**禁止**再写 `p.status === "Active"`。`PolicyCoverageCard.isActive` 由此 helper 计算，确保拟退保保单的 `isActive=true`，过期保单（含 PendingSurrender 已过期）的 `isActive=false`。
>
> `STATUS_LABELS` 渲染用 `policy.status`（display string），所以保留 `Expired` / `PendingSurrender` 两个 label，与过滤用的 dbStatus 路径职责分离。

> **保留 `isEffectivelyActive`**：不删旧 helper，以备将来确实需要"狭义 Active"语义（例如某天加入"自动续保前的资格预检"——只能由真正 Active 触发，PendingSurrender 不行）。本次改动只是把所有已有消费点切到 `isCoverageActiveStatus`，使现有"活跃"语义保持原义（含拟退保）。一次 grep + replace 切换，零行为静默改变。

L2 / E2E 必须覆盖：创建保单 → mark-pending-surrender → 检查 dashboard 活跃数仍 +1、coverage lookup 仍能命中、renewal calendar 仍列出。切回 Active 或走 terminate 后再检查相应统计应回退。

**新增列**：

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `terminated_at` | TEXT | NULLABLE | ISO date (`YYYY-MM-DD`)；终止态 = 实际终止日，`PendingSurrender` = 用户填写的"计划退保日"；切回 Active 时清空 |
| `termination_reason` | TEXT | NULLABLE | 自由文本，对话框中可选填，长度上限 500 字符（前端 + API 层校验，DB 不约束）；同时承担拟退保的"原因 / 备注" |

业务约束（API 层强校验，DB schema 不约束）：

| status | terminated_at | termination_reason |
|--------|---------------|---------------------|
| `Active` | 必须 NULL | 必须 NULL |
| `PendingSurrender` | 必填，`[effectiveDate, +∞)` 区间内（允许填未来计划日） | 可空 |
| `Surrendered` / `Claimed` / `Lapsed` | 必填，`[effectiveDate, today]` 区间内（终止动作必须已发生） | 可空 |

> **同一 schema 两个语义的取舍**：拟退保和终止共用 `terminated_at` 是为了避免再加一列 `planned_surrender_date`。语义由 `status` 字段唯一决定 —— 状态机的 transition 端点负责守住"何时允许填未来日 / 何时只准过去日"的边界。这套 single-column 设计在 `PendingSurrender → Surrendered` 时也无缝：用户重新打开 dialog 把日期改为实际生效日并 confirm 即可。

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

`Cancelled` 语义：保单终止后留下的"作废"标记，原值保留供审计；列表展示时单独样式（参见 UI 节）。`PendingSurrender` **不**触发 cancelPendingAfter（缴费记录保持，因为用户可能在计划日前改主意）。

### INIT_SQL 同步

`packages/db/src/index.ts:280-313` 的 `policies` 建表语句同步追加新列：

```sql
terminated_at TEXT,
termination_reason TEXT,
```

> Schema 与 INIT_SQL 不同步会导致 bun-sqlite L1 测试通过、D1 远程失败（或反之）。新增列时必须两边同改 —— 参考 CLAUDE.md Retrospective 中"INIT_SQL 是单源真值"约定。status enum 因为没有 CHECK 约束，INIT_SQL 不需要为新增的 `PendingSurrender` 改任何东西。

### Drizzle Migration

`drizzle/` 顶层目录追加 1 个 migration 文件（`bunx drizzle-kit generate` 自动产出），包含两条 `ALTER TABLE policies ADD COLUMN ...`。status enum 扩展不产出 DDL（无 CHECK 约束），但 migration 自动会 detect 到 schema.ts 的变化而不报错。

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
| 当前 status 已是另一种终止态（互转） | 400 `Cannot transition between terminal statuses; reactivate to Active first` |
| `terminatedAt` 不符合 `^\d{4}-\d{2}-\d{2}$` regex | 400 `Invalid terminatedAt` |
| `terminatedAt` regex 通过但 round-trip 不一致（如 `2026-99-99`、`2026-02-31`） | 400 `Invalid terminatedAt` |
| `terminatedAt < policy.effectiveDate` | 400 `Terminated date must be on or after effective date` |
| `terminatedAt > today` (`todayInTimeZone("Asia/Shanghai")` 比较) | 400 `Terminated date cannot be in the future` |
| `terminationReason.length > 500` | 400 `Reason too long` |
| 当前已是终止态且 `existing.terminatedAt != null` 且新 `terminatedAt > existing.terminatedAt` | 400 `Cannot extend the termination date forward` |

> **日期校验的可执行定义**：`parseLocalDate` 对越界数值容忍（`new Date("2026-99-99")` 会被 JS 引擎滚到 2034 年），不能单独使用。必须用 regex 先卡死格式，再做 round-trip：`const d = parseLocalDate(s); if (formatLocalDate(d) !== s) reject(...)`（`formatLocalDate` 见 `packages/db/src/lib/date-utils.ts:40`）。`today` 一律走 `todayInTimeZone("Asia/Shanghai")`（`packages/db/src/lib/date-utils.ts:63`）取项目标准时区当日，避免 Worker 容器 UTC 与用户本地日期相差一天。

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

### 新增：POST /api/policies/:id/mark-pending-surrender

挂在 `apps/worker/src/routes/policies.ts` 与 terminate 同级。语义：把 `Active` 保单标记为 `PendingSurrender`，记录用户的计划退保日 + 原因；**不**翻转任何缴费记录（用户仍可能在计划日前改主意，缴费数据要保留）。

**Request body：**

```typescript
{
  terminatedAt: string;         // 计划退保日 ISO date "YYYY-MM-DD"
  terminationReason?: string;   // optional, max 500 chars
}
```

**Validation：**

| 检查 | 错误响应 |
|------|----------|
| `id` 不是数字 | 400 `Invalid id` |
| 保单不存在 | 404 `Policy not found` |
| `existing.status` 不属于 {`Active`, `PendingSurrender`} | 400 `Only Active or PendingSurrender policies can be (re)marked as PendingSurrender` |
| `terminatedAt` 不符合 regex + round-trip | 400 `Invalid terminatedAt` |
| `terminatedAt < policy.effectiveDate` | 400 `Planned surrender date must be on or after effective date` |
| `terminatedAt > today` 不校验（**允许填未来计划日**，这正是 PendingSurrender 与 terminate 的核心区别） | — |
| `terminationReason.length > 500` | 400 `Reason too long` |

> **校验的是 DB status，不是 display status**：所有 transition 端点和 CRUD 守卫的"`existing.status === "Active"` 即允许"判断必须直接读 `policy.status`（DB 列原值），**不要**先过 `deriveDisplayStatus()` 拿到 `Expired` 再判断 —— `Expired` 是纯展示语义，业务层应当允许过期保单走完整 transition 流程（包括 mark-pending-surrender、terminate）。否则用户面对一张刚过期的保单连退保按钮都点不动。这条规则在 terminate 端点同样适用。

**Behavior：**

单条 UPDATE（无 batch，无 payments 副作用）：

```sql
UPDATE policies SET status='PendingSurrender', terminated_at=?, termination_reason=?, updated_at=? WHERE id=?
```

可走 Drizzle ORM 直接更新（与现有 PUT 同风格），无需 raw bind —— 没有 batch 就没有 `.bind()` 细节问题。

**Idempotency：**

二次调用同 `terminatedAt` + `terminationReason` 直接覆写，无副作用累加；从 `PendingSurrender` 改 `terminatedAt` 也只是单条 UPDATE，没有缴费状态需要保持一致。

**Response：**

```typescript
{
  id: number;
  status: "PendingSurrender";
  terminatedAt: string;
  terminationReason: string | null;
}
```

### `PendingSurrender → Surrendered/Claimed/Lapsed`

直接复用 `POST /api/policies/:id/terminate`（不需要额外端点），但 terminate 的 validation 表里 "当前 status 已是另一种终止态" 检查改为更精确：**from 是 PendingSurrender 时允许 → 任一终止态**。技术上 PendingSurrender 不在终止态集合里，所以默认就允许；只需补一句测试覆盖即可。terminate 的 `cancelPendingAfter` 在这条迁移路径上会按新填的 `terminatedAt` 翻转缴费。

### 反向操作：复用 PUT /api/policies/:id

切回 `Active` 走现有 `apps/worker/src/routes/policies.ts:130-174` 的 PUT，body 里 `status="Active"`、`terminatedAt=null`、`terminationReason=null` 一起送上来。PUT handler 需要补一条规则：当请求 body 包含 `status="Active"` 且 DB 当前是任一非 Active 状态（`PendingSurrender` / `Surrendered` / `Claimed` / `Lapsed`）时，强制把 `terminatedAt` / `terminationReason` 写为 NULL（防止前端忘传或老 client 提交）。

PUT **不** 自动恢复 `Cancelled` 缴费 —— 用户从终止态切回 Active 后如需补回缴费记录，请走 payments 模块手工重建，避免误恢复历史"作废"凭证。`PendingSurrender → Active` 没有缴费副作用要回滚（PendingSurrender 本就不动 payments）。

### 通用 POST / PUT 禁写非 Active 状态（旁路封堵）

数据模型约束规定**非 Active 状态必须有 `terminated_at`**（终止态必填、PendingSurrender 必填；`termination_reason` 可空，见 [Data Model](#data-model) 的约束表），否则审计就有空洞。光加 transition 路由不够 —— `POST /api/policies` (`apps/worker/src/routes/policies.ts:50`) 和 `PUT /api/policies/:id` (`apps/worker/src/routes/policies.ts:131`) 现在都直接接受 `body.status`，新建表单 `apps/web/src/app/policies/policy-sheet.tsx:65` 还把四个状态选项摆在用户面前；任何前端跳过 dialog 都能写出 `status=Surrendered, terminated_at=null` 的非法数据。

API 层强约束：

- `POST /api/policies`：当 `body.status` ∈ {`PendingSurrender`, `Surrendered`, `Claimed`, `Lapsed`} 时返回 400 `Cannot create a policy in a non-Active state — use the corresponding transition endpoint after creation`。新建保单只允许进入 `Active`（默认）。
- `PUT /api/policies/:id`：当 `body.status` ∈ {`PendingSurrender`, `Surrendered`, `Claimed`, `Lapsed`} 且与 DB 现有 status 不一致时返回 400 `Use the dedicated transition endpoint to change status`；仅在 `body.status` 与现有相等时透传（让其它字段更新可继续走 PUT），且即便相等也不允许通过 PUT 修改 `terminatedAt` / `terminationReason`（必须走 transition 端点）。
- `PUT` 切回 Active 仍按上一节规则强制清空 metadata。

UI 层呼应：

- `apps/web/src/app/policies/policy-sheet.tsx` 新建保单流程的 `statusOptions` (line 65) 收窄为单一 `Active`（或直接移除 status 字段，新建默认 Active）。
- 已存在的"编辑保单" sheet 在已 Active 时也不再渲染非 Active 选项；状态变更只能走详情页 MetaColumn 的四按钮 dialog。

> **L2 必须覆盖**：直接 `POST /api/policies { status: "PendingSurrender" }` → 400；直接 `POST /api/policies { status: "Surrendered" }` → 400；直接 `PUT { status: "Lapsed" }` 在 Active 保单上 → 400；`PUT { status: "Active", terminatedAt: "2026-01-01" }`（试图通过 PUT 伪造 metadata）→ Active 路径下 metadata 被强制清空。

### PolicyDetail 响应

`apps/worker/src/routes/policies.ts` 的 **GET single** 响应 (line 125-128) 与 `apps/web/src/lib/types/policy.ts:9-41` 的 `PolicyDetail` interface 均新增：

```typescript
terminatedAt: string | null;
terminationReason: string | null;
```

**GET list 响应保持不变**：列表视图（dashboard、policies 表格）只渲染 status badge + 关键展示字段（见 `PolicySummary` `apps/web/src/lib/types/policy.ts:46-63`），不需要 metadata。`PolicySummary` 仅 `status` 字段的类型联合通过 `PolicyStatus` 自动扩展到 `PendingSurrender`，不加新字段，列表查询和 list 路由的字段筛选都不变。所有需要 terminatedAt / terminationReason 的 UI 都通过详情接口拿（详情 dialog / Timeline / MetaColumn 都在详情页加载）。

### Payments 写入路径在非 Active 状态下的封禁

终止保单的缴费记录已是历史快照，必须封死所有从 API / UI 重新生成 Pending 的入口；否则用户能在退保后又"手动新加一笔 2027 年的 Pending"，把缴费悬挂问题倒灌回来。`PendingSurrender` 虽然没有翻转既有缴费（保留还在跑的语义），但用户已表明退保意向，**不应**再让系统继续生成未来缴费记录，故同等收紧写入。

> **守卫触发集合**：以下所有"`policy.status` ∈ 非 Active 集合"指 `{PendingSurrender, Surrendered, Claimed, Lapsed}`。Pending 与 Paid 行的可编辑性等下游规则只针对终止态收紧；`PendingSurrender` 下原有 Pending/Overdue 行仍可正常编辑/标记已缴（保单还在跑）。

> **Cancelled 行的全局保护（独立于 policy status）**：`status="Cancelled"` 是终止动作留下的审计痕迹，必须永久保留。policy 一旦从终止态恢复 Active，policy-level 守卫就会解除，没有这层行级保护的话，旧 Cancelled 行就能被 PUT 改回 Pending 或 DELETE 删除，审计断裂。所以在 PUT / DELETE 缴费路由的最前面**追加一条与 policy.status 无关的行级规则**：
>
> - `DELETE /api/policies/:id/payments/:paymentId`：若 `existingPayment.status === "Cancelled"` 一律返回 400 `Cannot delete a cancelled payment (audit trail)`
> - `PUT /api/policies/:id/payments/:paymentId`：若 `existingPayment.status === "Cancelled"` 且 body 中 `status !== "Paid"` 一律返回 400 `Cancelled payments can only be reactivated by marking them paid`（保留 [Payments 写入路径](#payments-写入路径在非-active-状态下的封禁) 中"任何非 Paid → Paid"的补录通路）；同时禁止改 `dueDate` / `amount` / `periodNumber` 等结构字段（保留审计快照）
>
> UI 同步：`Cancelled` 行的行级删除按钮**全局**隐藏（不论 policy 状态），编辑按钮**全局**只暴露"标记已缴"。

| 路由 | 现状 | 变更 |
|------|------|------|
| `POST /api/policies/:id/payments` (`apps/worker/src/routes/policies.ts:232`) | 直接 create | 加守卫：当 `policy.status` ∈ 非 Active 集合时返回 400 `Cannot add payments to a policy that is pending surrender or terminated` |
| `PUT /api/policies/:id/payments/:paymentId` (`apps/worker/src/routes/policies.ts:258`) | 任意更新 | 先过上方 **Cancelled 行级保护**；再过 policy 级：**仅在终止保单**（`Surrendered`/`Claimed`/`Lapsed`）下，body 中若把 `Paid` 改回 `Pending` / `Overdue` / `Cancelled` 返回 400。**允许的方向：任何非 `Paid` 状态 → `Paid`**，用于补录终止日**之前**实际已缴的真实历史。同时允许编辑 paidDate / paidAmount。`PendingSurrender` 下 PUT **不**做 policy 级收紧（保单还在跑，按 Active 行为），但行级 Cancelled 保护仍生效 |
| `DELETE /api/policies/:id/payments/:paymentId` (`apps/worker/src/routes/policies.ts:287`) | 直接 delete | 先过上方 **Cancelled 行级保护**（任何状态下 Cancelled 都不可删）；再过 policy 级：当 `policy.status` ∈ 非 Active 集合时返回 400 `Cannot delete payments of a policy that is pending surrender or terminated`；保留 `DELETE /api/policies/:id`（全保单级联删除）路径不变 |
| `POST /api/policies/:id/payments/generate` (`apps/worker/src/routes/policies.ts:301`) | 按 schedule 生成 | 加守卫：当 `policy.status` ∈ 非 Active 集合时直接返回 400 `Cannot generate payments for a policy that is pending surrender or terminated`；自动批量生成路径完全关闭 |
| 反向 PUT policy → Active | 仅清字段 | 不主动恢复 Cancelled 缴费（详见 [反向操作](#反向操作复用-put-apipoliciesid)）；用户切回 Active 后才能继续走 generate 路径，但**老 Cancelled 行仍受全局行级保护**，不会被误改/误删 |

UI 同步：

- `apps/web/src/components/policy-detail/payments-section.tsx` 中"添加缴费记录" (line 455) 与"生成本年度缴费" (line 529) 两个按钮在 `policy.status` ∈ 非 Active 集合时隐藏
- 已存在的缴费行：仅在**终止保单**下进入受限编辑模式（`Pending` / `Overdue` / `Cancelled` 行都保留"标记已缴"入口，对应允许 `* → Paid` 的补录方向；`Paid` 行保留"编辑 paidDate / paidAmount"入口；状态 `<Select>` 整体 readonly）；`PendingSurrender` 下既有缴费行编辑能力同 Active（详见 [Payments Section 更新](#4-payments-section-更新)）
- 行级删除按钮在非 Active 集合下隐藏（呼应 DELETE 守卫）；**Cancelled 行的行级删除按钮全局隐藏**（不论 policy 状态），呼应行级保护；用户若要批量清理只能删除整张保单

L2 E2E 必须覆盖：
- 终止后 POST payments → 400、generate → 400、PUT 把 Cancelled 改 Pending → 400、DELETE 行级 → 400
- 拟退保后 POST payments → 400、generate → 400、DELETE 行级 → 400
- 拟退保下 PUT Pending → Paid 仍 200（区别于终止态）

## UI

### 1. Badge `rose` variant 注册

新增 `rose` Badge variant 专供 `PendingSurrender` 状态，复用已有的 `--badge-red` token（无需新增 css 变量）。

`apps/web/src/components/ui/badge.tsx` 的 `badgeVariants.variant` 增加：

```typescript
rose: "border-transparent bg-[hsl(var(--badge-red))] text-[hsl(var(--badge-red-foreground))] hover:bg-[hsl(var(--badge-red)/0.9)]",
```

并在 `apps/web/src/lib/constants/policy.ts` 的 `statusConfig` 类型联合里加 `rose`，新增 PendingSurrender 行：

```typescript
export const statusConfig: Record<
  PolicyStatus,
  { label: string; variant: "success" | "outline" | "warning" | "purple" | "destructive" | "rose" }
> = {
  Active: { label: "生效中", variant: "success" },
  PendingSurrender: { label: "拟退保", variant: "rose" },
  Expired: { label: "已过期", variant: "destructive" },
  Lapsed: { label: "已失效", variant: "outline" },
  Surrendered: { label: "已退保", variant: "warning" },
  Claimed: { label: "已理赔", variant: "purple" },
};
```

`statusStripeClass` 同步加 `case "rose": return "border-l-2 border-l-[hsl(var(--badge-red))]"`。

### 2. Action Buttons in MetaColumn

挂载位置：`apps/web/src/components/policy-detail/meta-column.tsx:1044-1077` 的 Header 区块下方、`<Separator />` (line 1074) 之前，新增 "操作" 区段。按钮渲染由 `policy.status` 驱动：

| 当前 status | 显示按钮 |
|-------------|----------|
| `Active` / `Expired` | 拟退保 / 退保 / 理赔 / 失效（四按钮横排） |
| `PendingSurrender` | "修改拟退保信息" + "退保" + "理赔" + "失效" + "撤销拟退保（恢复 Active）" |
| `Surrendered` / `Claimed` / `Lapsed` | "修改终止信息" + "恢复 Active" |

按钮配置：

| 按钮 | Label | Icon (`lucide-react`) | Variant | 目标 transition |
|------|-------|-----------------------|---------|------------------|
| 拟退保 | 拟退保 | `Clock` | `outline`，加 `text-[hsl(var(--badge-red))]` hover 提示 | `POST /mark-pending-surrender` |
| 退保 | 退保 | `CircleSlash` | `outline` | `POST /terminate` (Surrendered) |
| 理赔 | 理赔 | `BadgeCheck` | `outline` | `POST /terminate` (Claimed) |
| 失效 | 标记失效 | `CircleX` | `destructive` | `POST /terminate` (Lapsed) |
| 修改拟退保信息 / 修改终止信息 | （按当前 status 文案） | `Pencil` | `outline` | 复用对应 dialog，预填现有 metadata |
| 撤销拟退保 / 恢复 Active | （按 from 文案） | `RotateCcw` | `outline`（PendingSurrender 直接 PUT；终止态走 AlertDialog） | PUT |

复用现有 `apps/web/src/components/ui/button.tsx` 的 `<Button>` 原语，按钮横排 `flex flex-wrap gap-2`。

### 3. Transition Dialog

新建 `apps/web/src/components/policy-detail/transition-dialog.tsx`，**统一承载** PendingSurrender + 三个终止态共 4 条 transition（避免拆两份 dialog 重复代码），基于 `apps/web/src/components/ui/dialog.tsx` 原语（非 AlertDialog，因为需要输入字段）。

**Props：**

```typescript
type TargetStatus =
  | "PendingSurrender"
  | "Surrendered"
  | "Claimed"
  | "Lapsed";

interface TransitionDialogProps {
  policy: PolicyDetail;
  open: boolean;
  targetStatus: TargetStatus;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void; // 触发 refreshPolicy + refreshPayments
}
```

**字段：**

| 字段 | 类型 | 校验 | UI |
|------|------|------|-----|
| `terminatedAt` | date | 必填。`targetStatus === "PendingSurrender"`：在 `[policy.effectiveDate, +∞)` 区间内（允许未来日，placeholder："计划退保日"）；终止态：在 `[policy.effectiveDate, today]` 区间内（placeholder："实际终止日"）。默认值规则见下方 | `<input type="date">` 或现有 `DatePicker`（参见 `EditableInfoRow`） |
| `terminationReason` | text | 可选，最长 500 字符 | `<Textarea>`，placeholder 按 `targetStatus` 分别提示（拟退保："拟退保原因 / 备注，例如 等保险公司客服回电…" / 退保："退保原因，例如 现金价值已超..." / 理赔："出险经过 / 理赔说明" / 失效："失效原因，例如 连续未缴...") |

**`terminatedAt` 默认值规则：**

| 场景 | 默认值 |
|------|--------|
| from `Active` / `Expired` → 任一目标 | `today` |
| from `PendingSurrender` → `PendingSurrender`（编辑已有计划） | 复用 `policy.terminatedAt` |
| from `PendingSurrender` → 任一终止态（最终决策） | 若 `policy.terminatedAt <= today` 复用 `policy.terminatedAt`（用户记录的计划日已到/已过，直接确认）；若 `policy.terminatedAt > today` 改用 `today`（旧值是未来日，终止 dialog 拒绝未来日，预填进去会让用户必须手动改，体验差）。dialog 上方加灰色提示 "原计划退保日 YYYY-MM-DD，按实际终止日重新填写" |
| from 终止态 → 终止态（编辑已有终止信息） | 复用 `policy.terminatedAt` |

`terminationReason` 一律预填 `policy.terminationReason ?? ""`，用户可改可保留。

**标题文案：**

| `targetStatus` | Dialog title | 确认按钮文案 / variant | 提交端点 |
|----------------|--------------|------------------------|----------|
| `PendingSurrender` | 标记为拟退保 - {productName} | "确认拟退保" / `outline + rose 文字色` | `POST /mark-pending-surrender` |
| `Surrendered` | 退保 - {productName} | "确认退保" / `destructive` | `POST /terminate` |
| `Claimed` | 理赔结案 - {productName} | "确认理赔结案" / `destructive` | `POST /terminate` |
| `Lapsed` | 标记失效 - {productName} | "确认失效" / `destructive` | `POST /terminate` |

**Footer：**

- "取消" 按钮 `variant="ghost"` 关闭
- 确认按钮按上表 variant，提交对应端点，成功后 `onSuccess()` + 关闭
- 提交中显示 spinner（参考现有 `EditableInfoRow` 编辑态的 loading 模式）
- API 失败时把 error message 渲染在 footer 上方红色文本

提交成功后 toast 提示：
- 拟退保：`已标记为拟退保（计划日 YYYY-MM-DD）`
- 终止态：`已退保 / 已理赔 / 已失效（取消 N 笔未来缴费）`，N 来自 API 响应的 `cancelledPaymentCount`

### 4. Status Dropdown Interception

`apps/web/src/components/policy-detail/meta-column.tsx:53-58` 定义 `statuses` 列表，`:257-264` 的 `EditableInfoRow` 渲染状态下拉。

改造 `BasicInfoSection`：

- 下拉选项扩展为 5 个值（`Active/PendingSurrender/Lapsed/Surrendered/Claimed`），保证保单加载后下拉正确显示当前状态文案；`Expired` 是 display-only 派生值，不出现在下拉里（拉到 Expired 的保单 DB 仍是 Active，下拉默认显示 Active）
- 包装一层 `onEditChange` 拦截，按 [Transition Matrix](#transition-matrix) 决定行为：
  - **from Active/Expired → PendingSurrender**：不写入 formData，打开 `TransitionDialog` (`targetStatus="PendingSurrender"`)
  - **from Active/Expired → Lapsed/Surrendered/Claimed**：不写入 formData，打开 `TransitionDialog` (`targetStatus` = 新选值)
  - **from PendingSurrender → Active**：直接 PUT（无副作用要回滚，无需 AlertDialog）；formData 同步清空 metadata
  - **from PendingSurrender → 任一终止态**：不写入 formData，打开 `TransitionDialog`；后端走 terminate 路径，会按新 `terminatedAt` 翻转缴费（用户已知）
  - **from 终止态 → Active**：打开 `AlertDialog`（复用 `apps/web/src/components/ui/alert-dialog.tsx:146-180`）二次确认 "确认恢复为 Active？已取消的缴费不会自动恢复"。确认后 `formData.status="Active"`、`formData.terminatedAt=null`、`formData.terminationReason=null`，走现有 PUT 流程
  - **from 终止态 → 另一种终止态**：根据 [Transition Matrix](#transition-matrix) 禁止；下拉直接拒绝写入，弹 toast 提示 "终止态之间不可直接互转，请先恢复为 Active"
  - **from 终止态 → PendingSurrender**：禁止，同上 toast
  - **同态选择**：no-op

### 5. Payments Section 更新

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
- **终止保单下**所有行（`Pending` / `Overdue` / `Cancelled` / `Paid`）的"编辑"按钮**仅暴露非破坏字段**：`paidDate` / `paidAmount`；状态 `<Select>` 整体 readonly，不渲染交互；状态变更只能通过单独的"标记已缴"按钮触发 `* → Paid` 的单向转换（呼应 [Payments 写入路径在非 Active 状态下的封禁](#payments-写入路径在非-active-状态下的封禁)）
- **拟退保保单下**既有缴费行可正常编辑（同 Active），仅新增 / 生成入口被禁；这与文档主张一致：拟退保还在跑，已存在的缴费动作不停
- `Cancelled` 行的"标记已缴"按钮**全局**显示（不论 policy 状态），用于补录终止日**之前**实际已缴的真实历史；hover 提示 "仅可标记已缴（用于历史补录）"。这是行级 Cancelled 保护开的唯一通路，与 policy.status 无关
- 行级删除按钮在非 Active 集合下隐藏（呼应 policy 级 DELETE 守卫）；`Cancelled` 行的行级删除按钮**全局**隐藏（呼应行级保护）
- `Cancelled` 行的字段编辑（`paidDate` / `paidAmount` / `dueDate` 等）**全局禁用**，编辑按钮仅暴露"标记已缴"一项

**新增 / 生成入口：**

- `PaymentForm` 的状态 `<SelectItem>` 列表 (~line 142-146) **不** 暴露 `Cancelled` —— `Cancelled` 仅由 terminate API 产生
- `policy.status` ∈ 非 Active 集合时（含 `PendingSurrender`），"添加缴费记录" (line 455) 与"生成本年度缴费" (line 529) 两个按钮整体隐藏

**统计：**

- 列表筛选 / 统计 (~line 227-230) 计算 paidCount / totalDueCount 等忽略 `Cancelled` 行；`Cancelled` 单独显示在表尾灰色区域 "N 笔已作废（保单终止）"

文案集中在 `apps/web/src/lib/constants/policy.ts` 新增 `paymentStatusLabels: Record<PaymentStatus, string>` 与 `statusConfig` 并列。

> **TS 编译指南**：由于 `PaymentStatus` 是 string union，扩第 4 个值后，所有现存 `switch (status)` 或 `Record<PaymentStatus, T>` 会触发 exhaustiveness 检查，编译器会自动指引补全分支。`paymentToForm` 当前的 `status === "Overdue" ? "Pending" : p.status` 三元只在**非终止保单**（即 `Active` / `Expired` / `PendingSurrender`）的常规编辑路径上使用（让用户能把 Overdue 行直接 mark paid）；终止保单进入受限编辑/补录模式，不走通用 PaymentForm，而是单独的"标记已缴" handler（只发 `{ status: "Paid", paidDate, paidAmount }` 到 PUT），所以 `Cancelled` 也不会出现在该三元里。类型上 form 仍接收完整 4-tuple union，避免 exhaustiveness 报错；运行时分支由 `policyStatus` prop 决定。

## Timeline Rendering

`apps/web/src/components/policy-detail/timeline-column.tsx:7-13` 的 `TimelineEvent` 类型：

```typescript
interface TimelineEvent {
  date: Date;
  dateStr: string;
  label: string;
  type: "past" | "today" | "future" | "cancelled" | "terminated" | "plannedSurrender";
}
```

新增三种 type：
- `"cancelled"`：被终止覆盖的原计划事件（仅终止态出现）
- `"terminated"`：终止动作本身的硬 milestone（仅终止态出现）
- `"plannedSurrender"`：拟退保的计划日软 milestone（仅 `PendingSurrender` 出现，未来事件继续按 `future` 渲染，不抑制 today）

### `buildTimeline` 改造 (line 31-169)

1. 函数从 `policy` 读 `policy.status` / `policy.terminatedAt`（已经接收 policy 全量，无需改 props）
2. 计算 `terminatedTime = policy.terminatedAt ? parseLocalDate(policy.terminatedAt).getTime() : null`
3. **仅在 `policy.status` ∈ 终止态时**：每个事件 push 时，若 `terminatedTime != null` 且 `eventTime > terminatedTime`，`type="cancelled"`（覆盖原本的 `future` / `past` 判定）；`PendingSurrender` **不**进入这条分支，未来事件保持 future 渲染
4. 当 `terminatedTime != null` 时，按 status 在 list 末尾追加对应 milestone：

   ```typescript
   if (terminalStatuses.includes(policy.status)) {
     events.push({
       date: parseLocalDate(policy.terminatedAt),
       dateStr: policy.terminatedAt,
       label: { Surrendered: "退保", Claimed: "理赔结案", Lapsed: "失效" }[policy.status],
       type: "terminated",
     });
   } else if (policy.status === "PendingSurrender") {
     events.push({
       date: parseLocalDate(policy.terminatedAt),
       dateStr: policy.terminatedAt,
       label: "计划退保",
       type: "plannedSurrender",
     });
   }
   ```

5. `today` 标记抑制规则：**仅终止态**下，当 `terminatedTime != null && terminatedTime <= todayTime`，**不** push `today` 事件（保单已终止，"今天"在 timeline 语义里失效）；`PendingSurrender` 不抑制 today
6. 排序 map (line 164) 扩展：`{ past: 0, today: 1, future: 2, plannedSurrender: 3, cancelled: 4, terminated: 5 }`，保证同日终止 milestone 排在最后

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

新增 `event.type === "plannedSurrender"` 分支：

| 元素 | 样式 |
|------|------|
| Icon | `Clock` `text-[hsl(var(--badge-red))]` 实心填充 |
| Date span | `text-[hsl(var(--badge-red))] font-medium` |
| Label span | `text-[hsl(var(--badge-red))] font-medium`，鼠标 hover 显示 `policy.terminationReason`（tooltip）；如果 milestone 时间已过且 status 仍是 `PendingSurrender`，label 后追加灰色 "（已超过计划日）" 提示用户处理 |

## File Changes

### Phase 1: Data Layer

| File | Action | Description |
|------|--------|-------------|
| `packages/db/src/schema.ts` | MODIFY | `policies.status` enum 扩展 `PendingSurrender` (line 127-131)；`policies` table 追加 `terminatedAt` / `terminationReason`；`payments.status` enum 扩展 `Cancelled` (line 194) |
| `packages/db/src/index.ts` | MODIFY | INIT_SQL 中 `policies` CREATE TABLE 同步追加两列 (line 280-313)；status enum 因无 CHECK 约束无需改 INIT_SQL |
| `packages/db/src/types.ts` | MODIFY | `PolicyDbStatus` union 增加 `PendingSurrender`；新增 export `TerminalPolicyStatus = "Surrendered" \| "Claimed" \| "Lapsed"` 与 `NonActivePolicyStatus = "PendingSurrender" \| TerminalPolicyStatus`；新增 `isCoverageActiveStatus(dbStatus, expiryDate, now?)` helper（详见 [活跃判定 helper 与下游消费点](#活跃判定-helper-与下游消费点)） |
| `packages/api/src/dashboard.ts` (line 20) | MODIFY | 活跃保单过滤 `isEffectivelyActive` → `isCoverageActiveStatus` |
| `packages/api/src/coverage-lookup.ts` (line 167, 190, 230) | MODIFY | 三个 `p.status === "Active"` 比较（line 167/190 过滤 + line 230 `isActive` 字段）一律改为 `isCoverageActiveStatus(p.dbStatus, p.expiryDate)`；`PolicyForCoverage` interface (line 31) 增加 `dbStatus: PolicyDbStatus`；`STATUS_LABELS` (line 119) 追加 `PendingSurrender: "拟退保"`；引入 `import { isCoverageActiveStatus, type PolicyDbStatus } from "@surety/db/types"` |
| `apps/worker/src/routes/coverage-lookup.ts` (line 38) | MODIFY | 卡片对象同时塞 `dbStatus`（raw, `policy.status as PolicyDbStatus`）和 `status`（display, `deriveDisplayStatus(...)`）两个字段；`buildPolicyCards` 过滤用前者，展示用后者，职责分离 |
| `apps/worker/src/routes/renewal-calendar.ts` (line 12) | MODIFY | `isEffectivelyActive` → `isCoverageActiveStatus` |
| `packages/db/src/repositories/payments.ts` | MODIFY | 新增 `cancelPendingAfter(policyId, dateStr)`：`UPDATE payments SET status='Cancelled' WHERE policy_id=? AND status IN ('Pending','Overdue') AND due_date > ?`；返回受影响行数 |
| `packages/db/__tests__/payments.test.ts` | MODIFY/CREATE | 覆盖 `cancelPendingAfter` 边界（Pending 与 Overdue 都翻、Paid 不动、只翻 dueDate > terminatedAt、idempotency） |
| `drizzle/000X_policy_status.sql` | CREATE | `bunx drizzle-kit generate` 产出两条 `ALTER TABLE policies ADD COLUMN`（status enum 扩展不产 DDL） |

### Phase 2: API Layer

| File | Action | Description |
|------|--------|-------------|
| `apps/worker/src/routes/policies.ts` | MODIFY | 新增 `POST /api/policies/:id/terminate` handler，紧挨 PUT 之后；用 `c.env.DB.batch([cancelPendingStmt, updatePolicyStmt])` 一次发出两条语句以保证原子性；新增 `POST /api/policies/:id/mark-pending-surrender` handler（无 batch，单条 UPDATE）；**仅 GET single** 响应 shape 增加 `terminatedAt` / `terminationReason` (line 125-128)；GET list 字段不变（列表不渲染 metadata，见 [PolicyDetail 响应](#policydetail-响应)） |
| `apps/worker/src/routes/policies.ts` | MODIFY | PUT handler 内追加规则：当 `body.status === "Active"` 且 DB 当前为任一非 Active 状态时，强制 `terminatedAt=null`, `terminationReason=null` (line 148-162) |
| `apps/worker/src/routes/policies.ts` | MODIFY | `POST /api/policies` (line 50) 与 `PUT /api/policies/:id` (line 131) 加守卫拒绝通用 CRUD 直接写**非 Active 状态**（含 PendingSurrender 与三个终止态，详见 [通用 POST / PUT 禁写非 Active 状态](#通用-post--put-禁写非-active-状态旁路封堵)） |
| `apps/worker/src/routes/policies.ts` | MODIFY | `POST /api/policies/:id/payments` (line 232)、`PUT /api/policies/:id/payments/:paymentId` (line 258)、`DELETE /api/policies/:id/payments/:paymentId` (line 287)、`POST /api/policies/:id/payments/generate` (line 301) 四条路由头部加 `policy.status` 非 Active 守卫（PUT 仅在终止态下收紧 status 转换），返回 400（详见 [Payments 写入路径在非 Active 状态下的封禁](#payments-写入路径在非-active-状态下的封禁)） |
| `apps/worker/__tests__/e2e/setup.ts` (line 88) | MODIFY | fake D1 当前只暴露 `prepare(sql).first()` 一个分支，terminate handler 会调用 `prepare(sql).bind(...params)` 拿到 statement 再丢给 `batch([...])`。需要同时补两件事：(1) `prepare(sql)` 返回的对象增加 `bind(...params)` 方法，返回一个 `{ sql, params }` 形状的 statement 持有者；(2) 顶层 D1 上增加 `batch(stmts)`，顺序在 bun:sqlite `db.transaction(() => ...)` 内执行每条 statement，返回 `[{ meta: { changes } }, ...]` 形状。失败回滚靠 bun:sqlite 事务保证；用塞入一条违反约束的 statement 验证 atomicity 测试 |
| `packages/api/src/policies.ts` (如存在) | MODIFY | 如有 framework-agnostic 业务层则在此实现 `terminatePolicy(repos, id, input)` + `markPendingSurrender(repos, id, input)`，Worker 路由薄壳调用；坚守 CLAUDE.md "路由是薄壳" 原则。如不存在则直接写在 worker 路由内（与现有 PUT 一致风格） |

### Phase 3: UI Core

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/lib/types/policy.ts` | MODIFY | `PolicyDetail` 接口新增 `terminatedAt` / `terminationReason` (line 9-41)；`PolicySummary` (line 46-63) 不动 —— `status` 字段类型联合通过 `@surety/db/types` 自动扩展 `PendingSurrender`，无需手改 |
| `apps/web/src/lib/constants/policy.ts` | MODIFY | `statusConfig` 加 `PendingSurrender: { label: "拟退保", variant: "rose" }` (line 6-12)；variant union 加 `"rose"`；`statusStripeClass` 加 `case "rose"` (line 22-31)；新增 `paymentStatusLabels`（含 `Cancelled: "已取消"`）；如需为按钮配置 icon，集中放此处 |
| `apps/web/src/components/ui/badge.tsx` | MODIFY | `badgeVariants.variant` 增加 `rose` 分支：`bg-[hsl(var(--badge-red))] text-[hsl(var(--badge-red-foreground))]`（复用已存在的 css token，无需改 globals.css） |
| `apps/web/src/components/policy-detail/transition-dialog.tsx` | CREATE | 统一 Dialog component（基于 `components/ui/dialog.tsx`），承载 PendingSurrender + 三种终止态共 4 条 transition；标题 / 文案 / placeholder / 提交端点按 `targetStatus` 分支；`PendingSurrender` 路径允许 `terminatedAt > today`，终止态路径不允许 |
| `apps/web/src/components/policy-detail/meta-column.tsx` | MODIFY | Header 下新增 "操作" 区块挂四个 transition 按钮 + 反向恢复按钮 (line 1044-1077)；BasicInfoSection 的 status select onChange 拦截 (line 53-58, 257-264)，按 [Transition Matrix](#transition-matrix) 决策；切回 Active 从终止态走 `AlertDialog` 二次确认，从 PendingSurrender 直接 PUT |
| `apps/web/src/components/policy-detail/payments-section.tsx` | MODIFY | `PaymentsSectionProps` 接口 (line 24) 新增必填 `policyStatus: PolicyStatus`（让组件内部用 `["PendingSurrender","Surrendered","Claimed","Lapsed"].includes(policyStatus)` 与 `["Surrendered","Claimed","Lapsed"].includes(policyStatus)` 区分 add/generate 守卫与编辑受限行为，并让 tooltip 文案能区分多态）；`StatusBadge` 增加 `Cancelled` 分支 (line ~191)；列表行加 line-through 样式；统计计数排除 `Cancelled`；`PaymentForm` 不暴露 `Cancelled` 作为用户可选项 (line ~142-146)；非 Active 集合下 add / generate 按钮整体不渲染；终止态下行级编辑表单 status 字段 readonly，拟退保下保持编辑能力 |
| `apps/web/src/app/policies/[id]/page.tsx` | MODIFY | `<MetaColumn>` 调用处传入 `onTransitionSuccess` 回调，内部 `refreshPolicy + refreshPayments` 并发刷新 (line 96-109, 155-194)；`<PaymentsSection>` 调用 (line 183) 补传 `policyStatus={policy.status}` |
| `apps/web/src/app/policies/policy-sheet.tsx` | MODIFY | `statusOptions` (line 65) 收窄为单一 `Active`（或直接移除 status 字段），新建保单只能进入 Active |

### Phase 4: Timeline Component

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/components/policy-detail/timeline-column.tsx` | MODIFY | `TimelineEvent.type` 增加 `"cancelled"` / `"terminated"` / `"plannedSurrender"` (line 7-13)；`buildTimeline` 计算 `terminatedTime` 并仅在终止态时覆盖事件 type；分别插入 terminated 或 plannedSurrender milestone；终止态下抑制 `today` 标记 (line 31-169)；排序 map 扩展到 6 类 (line 159-166)；渲染分支加 cancelled / terminated / plannedSurrender 样式 (line 188-236) |
| `apps/web/src/__tests__/timeline.test.ts` | CREATE | 覆盖：终止后未来事件渲染为 cancelled / today 标记被抑制 / terminated milestone 出现在正确位置；拟退保下未来事件保持 future / today 不被抑制 / plannedSurrender milestone 在 terminatedAt 当天 / "已超过计划日"提示；排序稳定 |

## Verification

### L1 单元测试 (`bun run test`)

- `packages/db/__tests__/payments.test.ts`：`cancelPendingAfter` 的边界（多状态混合、日期边界、空结果、幂等重放）
- `apps/web/src/__tests__/timeline.test.ts`：`buildTimeline` 在终止态 / 拟退保下的输出差异（事件类型、milestone 注入、`today` 抑制规则、排序）
- `apps/web/src/__tests__/transition-dialog.test.ts`：表单 validation（PendingSurrender 允许未来日；终止态拒绝未来日；reason 长度）

`bun run test:coverage` 行 / 函数覆盖率仍需 ≥ 95%。

### G1 静态 (`bun run typecheck` + `bun run lint`)

- 新 `PolicyDetail` 字段在所有消费者编译通过
- `PolicyDbStatus` enum 扩展 `PendingSurrender` 后所有 switch / map 都补分支（TypeScript 会报 exhaustiveness 错）
- `payments.status` enum 扩展 `Cancelled` 后同上
- 零 ESLint 警告

### L2 集成 (`bun run test`，覆盖 `apps/worker/__tests__/e2e/policies.e2e.test.ts`)

新增测试用例（参考现有 `apps/worker/__tests__/e2e/policies.e2e.test.ts:42-114` 创建 policy + payments 的 pattern）：

**Terminate 端点：**

| 用例 | 期望 |
|------|------|
| POST terminate 成功 | 200，policy 状态变为目标终止态，`terminatedAt` / `terminationReason` 写入，返回 `cancelledPaymentCount` |
| POST terminate 后 GET payments | 所有 `dueDate > terminatedAt` 的 `Pending` / `Overdue` 变 `Cancelled`，`Paid` 行保持不动 |
| POST terminate 后 GET policy | `terminatedAt` / `terminationReason` 出现在响应里 |
| POST terminate 幂等 | 二次调用同 status + 不同 reason，policy 元数据更新，`cancelledPaymentCount=0` |
| POST terminate 非法 `terminatedAt`（早于 effective / `2026-99-99` / 未来日期） | 400 |
| POST terminate 非法 status（如 `Active` 或 `PendingSurrender`） | 400 |
| POST terminate 不存在的 policy | 404 |
| POST terminate 在终止态之间互转 | 400 `Cannot transition between terminal statuses` |
| POST terminate 后将 terminatedAt 后移 | 400 `Cannot extend the termination date forward` |
| POST terminate 后将 terminatedAt 前移 | 200，额外区间内的 Pending/Overdue 被翻成 Cancelled |
| POST terminate 对老数据（status 已终止但 terminatedAt NULL） | 200，允许首次补录任意合法日期 |
| POST terminate 把 Overdue 翻成 Cancelled | 终止日之后的 Overdue 被翻；之前的保留 |
| POST terminate batch atomicity | 模拟 policies UPDATE 失败后 GET payments：原 Pending 仍为 Pending，policy 状态未改 |

**Mark-pending-surrender 端点：**

| 用例 | 期望 |
|------|------|
| POST mark-pending-surrender 成功（terminatedAt = 未来日） | 200，policy 状态变 `PendingSurrender`，metadata 写入；GET payments 一切不动 |
| POST mark-pending-surrender 成功（terminatedAt = 过去日） | 200（允许追溯标记） |
| POST mark-pending-surrender 在已是 `PendingSurrender` 的保单上 | 200，metadata 覆写（幂等） |
| POST mark-pending-surrender 在已终止保单上 | 400 `Only Active or PendingSurrender policies can be (re)marked as PendingSurrender` |
| POST mark-pending-surrender 在 DB status=Active 但 display=Expired 的保单上 | 200（校验 DB status 而非 display） |
| POST mark-pending-surrender 非法 `terminatedAt`（早于 effective） | 400 |

**PendingSurrender → 终止态：**

| 用例 | 期望 |
|------|------|
| `PendingSurrender` 状态下 POST terminate | 200，按新 `terminatedAt` 翻转 payments，状态变目标终止态 |
| `PendingSurrender` 状态下 PUT status=Active | 200，metadata 清空，无 payments 副作用要回滚 |

**活跃判定下游：**

| 用例 | 期望 |
|------|------|
| 创建保单 → mark-pending-surrender → GET `/api/dashboard` | 活跃保单数仍 +1（PendingSurrender 计入） |
| 同上 → GET `/api/coverage-lookup?type=member&id=...` | 该 member 的保障列表仍命中此保单，`statusLabel` 显示为 "拟退保"（不是裸枚举值），`isActive=true` |
| 同上 → GET `/api/renewal-calendar` | 续保日历仍列出此保单 |
| 同上（未过期流）→ POST terminate → GET `/api/dashboard` | 活跃保单数回退 -1（终止态不计入） |
| 同上（未过期流）→ POST terminate → GET `/api/coverage-lookup?type=member&id=...` | 保障列表不再命中 |
| 创建**已过期**保单（expiryDate < today）→ GET `/api/dashboard` 基线 | 活跃保单数 **不** 计入此保单（display=Expired，coverage 已结束） |
| 同上 → mark-pending-surrender → GET `/api/dashboard` | 活跃保单数仍不变（PendingSurrender 服从 expiry，过期就不计入） |
| 同上 → GET `/api/coverage-lookup?type=member&id=...` | 保障列表 **不** 命中（已过期，coverage 不再生效），`isActive=false` |
| 同上 → POST terminate → GET `/api/dashboard` | 活跃保单数仍不变（基线就没计入，终止只是把 status 写实，不影响活跃数） |
| 同上 → POST terminate → GET `/api/coverage-lookup?type=member&id=...` | 保障列表仍不命中 |

**通用 CRUD 旁路：**

| 用例 | 期望 |
|------|------|
| POST `/api/policies` body.status="PendingSurrender" | 400（旁路被堵） |
| POST `/api/policies` body.status="Surrendered" | 400 |
| PUT `/api/policies/:id` 把 Active 直接改成 PendingSurrender | 400（必须走 mark-pending-surrender） |
| PUT `/api/policies/:id` 把 Active 直接改成 Lapsed | 400（必须走 terminate） |
| PUT `/api/policies/:id` 在终止态下尝试修改 `terminatedAt` / `terminationReason` | 400 |

**Payments 守卫：**

| 用例 | 期望 |
|------|------|
| 终止后 / 拟退保后 POST `/api/policies/:id/payments` | 400 |
| 终止后 / 拟退保后 POST `/api/policies/:id/payments/generate` | 400 |
| 拟退保后 PUT 把 Pending 行改 Paid | 200（保单还在跑，按 Active 行为） |
| 终止后 PUT 把 Cancelled 行改 Pending | 400 |
| 终止后 PUT 把 Paid 行改回 Pending | 400 |
| 终止后 PUT 把 Pending 行改 Paid | 200（允许补录历史已缴） |
| 终止后 PUT 把 Overdue 行改 Paid | 200 |
| 终止后 PUT 把 Cancelled 行改 Paid | 200 |
| 终止后 / 拟退保后 DELETE 行级 payment | 400 |
| 终止后 DELETE 整张保单 | 200（级联删除不受守卫影响） |
| PUT policy status=Active 反向切回 | terminatedAt / terminationReason 被清空；Cancelled 缴费保持 Cancelled |
| 反向切回 Active 后再 POST payments | 200（守卫解除） |
| 反向切回 Active 后 DELETE 旧 Cancelled 行 | 400 `Cannot delete a cancelled payment (audit trail)`（行级保护与 policy.status 无关） |
| 反向切回 Active 后 PUT 旧 Cancelled 行改 Pending | 400 `Cancelled payments can only be reactivated by marking them paid` |
| 反向切回 Active 后 PUT 旧 Cancelled 行改 Paid | 200（补录通路保留） |

L2 HTTP 套件 `bun run test:l2:http` 同样运行一遍 terminate + mark-pending-surrender 路径，验证 D1 binding 与 sqlite-proxy 行为一致 —— 跑此套件前需先 `bun run db:push` 把新列推到 dev D1。

### L3 浏览器 E2E (`bun run test:e2e:browser`, 可选)

`apps/web/e2e/policy-status.spec.ts`：

1. 创建保单 → 生成 12 期月缴 → 点 "拟退保" 按钮 → 填未来日期 + reason → 提交
2. 验证 Badge 变玫红 "拟退保"、Timeline 出现 "计划退保" 软 milestone、未来缴费仍按 future 渲染、add/generate 按钮消失
3. 点 "撤销拟退保（恢复 Active）" → 状态回 Active、按钮重新出现
4. 点 "退保" 按钮 → 填今日 + reason → 提交
5. 验证 Timeline 出现 "退保" milestone、未来缴费灰显带删除线、状态 Badge 变 "已退保"
6. 验证 Payments 区已取消缴费 "已取消" badge 出现
7. 切状态 Active → AlertDialog 出现 → 取消 → 状态保持

## Atomic Commit Sequence

| # | Message | Scope | Status |
|---|---------|-------|--------|
| 1 | `feat(db): add PendingSurrender status, terminated_at / termination_reason columns; extend payments enum with Cancelled` | `packages/db/src/schema.ts` (status enum + 2 columns + payment enum), `packages/db/src/index.ts` INIT_SQL, `packages/db/src/types.ts` (PolicyDbStatus + TerminalPolicyStatus + NonActivePolicyStatus + isCoverageActiveStatus helper), drizzle migration | pending |
| 2 | `feat(db): add paymentsRepo.cancelPendingAfter` | `packages/db/src/repositories/payments.ts` + L1 test | pending |
| 3 | `refactor(api): switch active-policy filters to isCoverageActiveStatus` | `packages/api/src/dashboard.ts`, `packages/api/src/coverage-lookup.ts` (both filter sites), `apps/worker/src/routes/renewal-calendar.ts` + L1/L2 tests verifying PendingSurrender is counted | pending |
| 4 | `feat(api): add /terminate + /mark-pending-surrender; expose terminatedAt / terminationReason; lock down all status bypass routes` | `apps/worker/src/routes/policies.ts` (both transition handlers, PUT auto-clear, status guards on POST/PUT policies + POST/PUT/DELETE/generate payments), `apps/worker/__tests__/e2e/setup.ts` (fake D1 prepare/bind/batch shim), `packages/api/...`, `apps/web/src/lib/types/policy.ts` PolicyDetail + PaymentStatus | pending |
| 5 | `test(e2e): cover policy status transitions, bypass guards, and payments side-effects` | `apps/worker/__tests__/e2e/policies.e2e.test.ts` (terminate + mark-pending-surrender + bypass guards + Overdue handling + atomicity + PendingSurrender→terminal + DB-status-not-display validation) | pending |
| 6 | `feat(ui): badge rose variant; transition dialog component` | `apps/web/src/components/ui/badge.tsx` (rose variant), `apps/web/src/lib/constants/policy.ts` (statusConfig + PendingSurrender row + stripe), `apps/web/src/components/policy-detail/transition-dialog.tsx` + L1 test | pending |
| 7 | `feat(ui): wire transition buttons and status dropdown interception in MetaColumn` | `apps/web/src/components/policy-detail/meta-column.tsx`, `apps/web/src/app/policies/[id]/page.tsx` refresh callbacks, `apps/web/src/app/policies/policy-sheet.tsx` 收窄 `statusOptions` 到 Active-only (line 65) | pending |
| 8 | `feat(ui): render Cancelled payment status; lock down payment writes in non-Active states` | `apps/web/src/components/policy-detail/payments-section.tsx` (StatusBadge / row readonly only in terminal / hide add+generate in non-Active), `apps/web/src/lib/constants/policy.ts` (paymentStatusLabels), `apps/web/src/lib/types/policy.ts` (PaymentStatus = 4-tuple) | pending |
| 9 | `feat(ui): timeline renders terminated + plannedSurrender milestones, cancels future events only in terminal states` | `apps/web/src/components/policy-detail/timeline-column.tsx` + L1 test | pending |

每个 commit 独立通过 `bun run typecheck` + `bun run lint` + `bun run test`。Commit 1 (DB-only) 是 hot-path：单独 push 到 dev D1 + 跑 schema check。Commit 3 (helper 切换) 必须在 transition handler 之前落地，否则 transition 写入 `PendingSurrender` 后 dashboard 立刻显示活跃数 -1。Commit 4-5 形成 API 闭环；Commit 6-9 形成 UI 闭环，互不阻塞。

## Open Questions / Future Extensions

| 议题 | 当前决策 | v2 候选方案 |
|------|----------|-------------|
| **Active → Active 恢复后 Cancelled 缴费如何回滚？** | 不自动恢复 (审计安全) | v2 可加 `paymentsRepo.uncancelByPolicy(policyId)` + AlertDialog 二选项 "保留取消" / "恢复缴费" |
| **terminatedAt 是否允许后移？** | 不允许（单调向前）。后移真实需求走 "PUT → Active → 再 terminate" 双跳，用户必须显式经过 reactivate 步骤 | v2 若加入 `Cancelled → Pending` 的可控回滚，则可允许 terminatedAt 后移并按区间回填 |
| **退保金额 / 现金价值联动** | 不在 schema | v2 在对话框中读 `cashValues` 表展示当前现金价值作参考；可选填入 `refundAmount` 列 |
| **理赔金额 / 出险信息** | 不在 schema | v2 加 `claim_amount` 列 + R2 附件挂理赔材料 |
| **Lapsed 自动检测** | 手动触发 | v2 cron job：检测连续 N 个 Overdue 缴费自动建议进入 Lapsed 流程，仍由用户确认 |
| **PendingSurrender 到期未行动提醒** | v1 仅在 timeline label 后追加"（已超过计划日）" 灰色提示 | v2 cron job：检测 `today >= terminated_at` 且状态仍是 `PendingSurrender` 的保单，在 dashboard 顶部 / 续保日历红点提醒；阈值（如超 7 天）触发邮件 / 通知 |
| **PendingSurrender 与 cash_values 联动** | 不联动 | v2 dialog 中读 `cashValues` 表展示当前现金价值作参考，帮助用户判断是否值得继续等 |
| **审计日志表** | 无 | v2 通用 `audit_log` 表记录所有 terminate / reactivate 动作的 actor + timestamp + diff |
