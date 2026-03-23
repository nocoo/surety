# MCP CRUD Tools Expansion

MCP 层当前为纯只读（8 个 query/analytics tools），Repo 层 9 个实体全部具备完整 CRUD。本文档设计全面扩展 MCP 写入能力，使 AI Agent 能通过 MCP 完成数据管理。

## 现状分析

### 当前 MCP Tools（8 个，全部只读）

| Tool | Entity | Operation |
|------|--------|-----------|
| `list-members` | Members | Read (list) |
| `get-member` | Members | Read (detail) |
| `list-policies` | Policies | Read (list+filter) |
| `get-policy` | Policies | Read (detail) |
| `list-assets` | Assets | Read (list) |
| `coverage-analysis` | Coverage | Read (analytics) |
| `renewal-overview` | Coverage | Read (analytics) |
| `dashboard-summary` | Coverage | Read (analytics) |

### 差距：Repo 有但 MCP 未暴露

| Entity | Repo CRUD | MCP 现状 | 缺失 |
|--------|-----------|----------|------|
| Members | full CRUD | list + get (2 tools) | **create, update, delete** |
| Policies | full CRUD | list + get (2 tools) | **create, update, delete** |
| Assets | full CRUD | list (1 tool) | **get, create, update, delete** |
| Insurers | full CRUD + findOrCreate | 无 (0 tools) | **全部** |
| Beneficiaries | full CRUD + deleteByPolicyId | 内嵌于 get-policy (0 独立 tools) | **独立 CRUD** |
| Payments | full CRUD + createMany | 无 (0 tools) | **全部** |
| CashValues | full CRUD + createMany | 无 (0 tools) | **全部** |
| CoverageItems | full CRUD + createMany | 无 (0 tools) | **全部** |

## 设计方案

### 新增 MCP Tools 清单（33 个新增，总计 41 个）

#### Members（现有 2 + 新增 3 = 5）

| Tool | Description | Parameters | Repo Method |
|------|-------------|------------|-------------|
| `create-member` | Create a new family member | `name`, `relation`, `gender?`, `birthDate?`, `idCard?`, `idType?`, `idExpiry?`, `phone?`, `hasSocialInsurance?` | `membersRepo.create()` |
| `update-member` | Update an existing family member | `memberId`, + all optional fields | `membersRepo.update()` |
| `delete-member` | Delete a family member (fails if referenced by policies/beneficiaries/assets) | `memberId` | see [Delete 安全策略](#2-delete-安全策略外键引用保护) |

#### Policies（现有 2 + 新增 3 = 5）

| Tool | Description | Parameters | Repo Method |
|------|-------------|------------|-------------|
| `create-policy` | Create a new insurance policy | see [Policy 参数设计](#1-policy-创建更新的-insuredtype-判别约束) | `policiesRepo.create()` |
| `update-policy` | Update an existing policy | see [Policy 参数设计](#1-policy-创建更新的-insuredtype-判别约束) | `policiesRepo.update()` |
| `delete-policy` | Delete a policy and all related records (single transaction) | `policyId` | see [级联删除事务](#4-delete-policy-级联删除的事务边界) |

#### Assets（现有 1 + 新增 4 = 5）

| Tool | Description | Parameters | Repo Method |
|------|-------------|------------|-------------|
| `get-asset` | Get detailed info of a specific asset | `assetId` | `assetsRepo.findById()` |
| `create-asset` | Create a new insured asset | `type`, `name`, `identifier`, `ownerId?`, `details?` | `assetsRepo.create()` |
| `update-asset` | Update an existing asset | `assetId`, + all optional fields | `assetsRepo.update()` |
| `delete-asset` | Delete an asset (fails if referenced by policies) | `assetId` | see [Delete 安全策略](#2-delete-安全策略外键引用保护) |

#### Insurers（全新 5）

| Tool | Description | Parameters | Repo Method |
|------|-------------|------------|-------------|
| `list-insurers` | List all insurance companies | — | `insurersRepo.findAll()` |
| `get-insurer` | Get insurer details | `insurerId` | `insurersRepo.findById()` |
| `create-insurer` | Create a new insurer | `name`, `phone?`, `website?` | `insurersRepo.create()` |
| `update-insurer` | Update insurer and sync name to related policies | `insurerId`, + optional fields | see [Insurer 名称同步](#3-insurer-rename-与-policy-冗余字段同步) |
| `delete-insurer` | Delete an insurer (fails if referenced by policies) | `insurerId` | see [Delete 安全策略](#2-delete-安全策略外键引用保护) |

#### Beneficiaries（全新 5）

| Tool | Description | Parameters | Repo Method |
|------|-------------|------------|-------------|
| `list-beneficiaries` | List beneficiaries for a policy | `policyId` | `beneficiariesRepo.findByPolicyId()` |
| `get-beneficiary` | Get beneficiary details | `beneficiaryId` | `beneficiariesRepo.findById()` |
| `create-beneficiary` | Add a beneficiary to a policy | `policyId`, `sharePercent`, `rankOrder`, `memberId?`, `externalName?`, `externalIdCard?` | `beneficiariesRepo.create()` |
| `update-beneficiary` | Update a beneficiary record | `beneficiaryId`, + optional fields | `beneficiariesRepo.update()` |
| `delete-beneficiary` | Remove a beneficiary | `beneficiaryId` | `beneficiariesRepo.delete()` |

#### Payments（全新 5）

| Tool | Description | Parameters | Repo Method |
|------|-------------|------------|-------------|
| `list-payments` | List payment records for a policy | `policyId` | `paymentsRepo.findByPolicyId()` |
| `get-payment` | Get payment record details | `paymentId` | `paymentsRepo.findById()` |
| `create-payment` | Add a payment record | `policyId`, `periodNumber`, `dueDate`, `amount`, `status?`, `paidDate?`, `paidAmount?` | `paymentsRepo.create()` |
| `update-payment` | Update a payment record | `paymentId`, + optional fields | `paymentsRepo.update()` |
| `delete-payment` | Remove a payment record | `paymentId` | `paymentsRepo.delete()` |

#### CashValues（全新 4）

| Tool | Description | Parameters | Repo Method |
|------|-------------|------------|-------------|
| `list-cash-values` | List cash value records for a policy | `policyId` | `cashValuesRepo.findByPolicyId()` |
| `create-cash-value` | Add a cash value record | `policyId`, `policyYear`, `value` | `cashValuesRepo.create()` |
| `update-cash-value` | Update a cash value record | `cashValueId`, `policyYear?`, `value?` | `cashValuesRepo.update()` |
| `delete-cash-value` | Remove a cash value record | `cashValueId` | `cashValuesRepo.delete()` |

#### CoverageItems（全新 4）

| Tool | Description | Parameters | Repo Method |
|------|-------------|------------|-------------|
| `list-coverage-items` | List coverage items for a policy | `policyId` | `coverageItemsRepo.findByPolicyId()` |
| `create-coverage-item` | Add a coverage item to a policy | `policyId`, `name`, `periodLimit?`, `lifetimeLimit?`, `deductible?`, `coveragePercent?`, `isOptional?`, `notes?`, `sortOrder?` | `coverageItemsRepo.create()` |
| `update-coverage-item` | Update a coverage item | `coverageItemId`, + optional fields | `coverageItemsRepo.update()` |
| `delete-coverage-item` | Remove a coverage item | `coverageItemId` | `coverageItemsRepo.delete()` |

### 不暴露的实体

| Entity | Reason |
|--------|--------|
| Settings | 安全敏感（含 TOTP 密钥、MCP 开关等），通过 Web UI 管理 |

## 文件结构

### 新增/修改文件

```
mcp/
├── server.ts                          # 修改: 注册新 tool modules
├── tools/
│   ├── members.ts                     # 修改: +3 tools (create/update/delete)
│   ├── policies.ts                    # 修改: +3 tools (create/update/delete)
│   ├── assets.ts                      # 修改: +4 tools (get/create/update/delete)
│   ├── coverage.ts                    # 不变
│   ├── insurers.ts                    # 新建: 5 tools (full CRUD)
│   ├── beneficiaries.ts              # 新建: 5 tools (full CRUD)
│   ├── payments.ts                    # 新建: 5 tools (full CRUD)
│   ├── cash-values.ts                # 新建: 4 tools (list/create/update/delete)
│   └── coverage-items.ts             # 新建: 4 tools (list/create/update/delete)
├── __tests__/
│   ├── tools-members.test.ts          # 修改: +CUD tests
│   ├── tools-policies.test.ts         # 修改: +CUD tests
│   ├── tools-assets.test.ts           # 修改: +CRUD tests
│   ├── tools-insurers.test.ts         # 新建
│   ├── tools-beneficiaries.test.ts    # 新建
│   ├── tools-payments.test.ts         # 新建
│   ├── tools-cash-values.test.ts      # 新建
│   └── tools-coverage-items.test.ts   # 新建
```

### `mcp/server.ts` 变更

```typescript
import { registerInsurerTools } from "./tools/insurers";
import { registerBeneficiaryTools } from "./tools/beneficiaries";
import { registerPaymentTools } from "./tools/payments";
import { registerCashValueTools } from "./tools/cash-values";
import { registerCoverageItemTools } from "./tools/coverage-items";

export function registerTools(server: McpServer): void {
  registerMemberTools(server);
  registerPolicyTools(server);
  registerAssetTools(server);
  registerInsurerTools(server);
  registerBeneficiaryTools(server);
  registerPaymentTools(server);
  registerCashValueTools(server);
  registerCoverageItemTools(server);
  registerCoverageTools(server);  // analytics, unchanged
}
```

## 设计决策

### 1. Policy 创建/更新的 insuredType 判别约束

`policies` 表的 `insuredType` 是判别联合（discriminated union）：当 `insuredType = "Member"` 时必须提供 `insuredMemberId`；当 `insuredType = "Asset"` 时必须提供 `insuredAssetId`。两者互斥。

**`create-policy` 参数设计**：

Zod schema 使用 `z.discriminatedUnion` 在参数层强制约束：

```typescript
// 公共字段
const policyBase = {
  applicantId: z.number(),
  category: z.enum(["Life", "CriticalIllness", "Medical", "Accident", "Annuity", "Property"]),
  insurerName: z.string(),
  productName: z.string(),
  policyNumber: z.string(),
  sumAssured: z.number(),
  premium: z.number(),
  paymentFrequency: z.enum(["Single", "Monthly", "Yearly"]),
  effectiveDate: z.string(),
  // ... other optional fields
};

// 判别联合
z.discriminatedUnion("insuredType", [
  z.object({ ...policyBase, insuredType: z.literal("Member"), insuredMemberId: z.number() }),
  z.object({ ...policyBase, insuredType: z.literal("Asset"),  insuredAssetId: z.number() }),
])
```

**`update-policy` 参数设计**：

update 场景更复杂——若更改 `insuredType`，必须同时提供新的 FK 并清掉旧的 FK。在 tool handler 中实现：

```typescript
// update-policy handler 内部逻辑
if (args.insuredType) {
  if (args.insuredType === "Member") {
    if (!args.insuredMemberId) return error("insuredMemberId is required when insuredType is Member");
    updateData.insuredAssetId = null;   // 清掉 Asset 侧引用
  } else {
    if (!args.insuredAssetId) return error("insuredAssetId is required when insuredType is Asset");
    updateData.insuredMemberId = null;  // 清掉 Member 侧引用
  }
}
```

涉及文件：`mcp/tools/policies.ts`，`src/db/schema.ts:77-82`

**`create-policy` 自动关联 insurer**：

创建保单时，handler 通过 `insurersRepo.findOrCreate(insurerName)` 自动维护 `insurerId`，调用者只需传 `insurerName`：

```typescript
// create-policy handler 内部
const insurer = await insurersRepo.findOrCreate(args.insurerName);
const policy = await policiesRepo.create({
  ...args,
  insurerId: insurer.id,
});
```

**`update-policy` 变更 insurerName 时同步 insurerId**：

`update-policy` 接收 `insurerName` 变更时，必须同步更新 `insurerId`，保持两个字段一致。与 create 路径共用 `findOrCreate` 逻辑：

```typescript
// update-policy handler 内部
if (args.insurerName) {
  const insurer = await insurersRepo.findOrCreate(args.insurerName);
  updateData.insurerId = insurer.id;
  updateData.insurerName = args.insurerName;
}
```

> **三条写路径的完整覆盖**：
> - `create-policy`：`findOrCreate(insurerName)` → 写入 `insurerId` + `insurerName`
> - `update-policy`：变更 `insurerName` 时 → `findOrCreate` → 同步 `insurerId`
> - `update-insurer`：rename 时 → 反向同步所有关联 policy 的 `insurerName`（见 [§3](#3-insurer-rename-与-policy-冗余字段同步)）

### 2. Delete 安全策略：外键引用保护

当前 schema **未启用 SQLite PRAGMA foreign_keys**，也未定义 `ON DELETE` 行为。D1 默认不强制 FK 约束，删除父记录不会自动 cascade 也不会 restrict。

**MCP 层必须在应用层实现 restrict 语义**，避免产生孤儿记录：

| Delete Tool | 被引用关系 | 策略 |
|-------------|-----------|------|
| `delete-member` | `policies.applicantId`, `policies.insuredMemberId`, `beneficiaries.memberId`, `assets.ownerId` | **Restrict**: 先查 policies + beneficiaries + assets 是否引用，有则拒绝并返回具体引用列表 |
| `delete-asset` | `policies.insuredAssetId` | **Restrict**: 先查 policies 是否引用，有则拒绝 |
| `delete-insurer` | `policies.insurerId` | **Restrict**: 先查 policies 是否引用，有则拒绝 |
| `delete-policy` | `beneficiaries`, `payments`, `cashValues`, `coverageItems` 的 `policyId` | **Cascade**: 单事务删除所有子记录 + 保单本身，见 [设计决策 #4](#4-delete-policy-级联删除的事务边界) |
| `delete-beneficiary` | 无子引用 | 直接删除 |
| `delete-payment` | 无子引用 | 直接删除 |
| `delete-cash-value` | 无子引用 | 直接删除 |
| `delete-coverage-item` | 无子引用 | 直接删除 |

**`delete-member` 实现示例**：

```typescript
async ({ memberId }) => {
  // Check referencing policies
  const asApplicant = await policiesRepo.findByApplicantId(memberId);
  const asInsured = await policiesRepo.findByInsuredMemberId(memberId);
  const asBeneficiary = await beneficiariesRepo.findAll()
    .then(all => all.filter(b => b.memberId === memberId));
  // Check referencing assets (src/db/schema.ts:57 — assets.ownerId → members.id)
  const ownedAssets = await assetsRepo.findByOwnerId(memberId);

  if (asApplicant.length || asInsured.length || asBeneficiary.length || ownedAssets.length) {
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify({
        error: "Cannot delete member: still referenced",
        asApplicant: asApplicant.map(p => ({ id: p.id, policyNumber: p.policyNumber })),
        asInsured: asInsured.map(p => ({ id: p.id, policyNumber: p.policyNumber })),
        asBeneficiary: asBeneficiary.map(b => ({ id: b.id, policyId: b.policyId })),
        ownedAssets: ownedAssets.map(a => ({ id: a.id, name: a.name })),
      })}],
    };
  }

  const deleted = await membersRepo.delete(memberId);
  // ...
};
```

涉及文件：`mcp/tools/members.ts`, `mcp/tools/assets.ts`, `mcp/tools/insurers.ts`

### 3. Insurer Rename 与 Policy 冗余字段同步

`policies` 表同时存储 `insurerId`（FK）和 `insurerName`（冗余展示字段）。当通过 `update-insurer` 修改保险公司名称时，必须同步更新所有关联保单的冗余名称：

```typescript
// update-insurer handler
const updated = await insurersRepo.update(insurerId, data);
if (data.name && updated) {
  // 同步所有引用该 insurer 的 policy 冗余名称
  const relatedPolicies = await policiesRepo.findAll();
  const affectedPolicies = relatedPolicies.filter(p => p.insurerId === insurerId);
  for (const p of affectedPolicies) {
    await policiesRepo.update(p.id, { insurerName: data.name });
  }
}
```

> **未来优化**：当保单数量增长后，应在 Repo 层新增 `policiesRepo.updateByInsurerId(insurerId, patch)` 批量更新方法，避免 N+1 查询。当前保单规模（< 100）可接受逐条更新。

涉及文件：`mcp/tools/insurers.ts`, `src/db/schema.ts:96-97`, `src/db/repositories/insurers.ts`

### 4. Delete-Policy 级联删除的原子批执行

`delete-policy` 需要原子删除保单及其全部子记录。

**关键约束**：`drizzle-orm/sqlite-proxy` 的 `transaction()` 实现是逐条发送 `BEGIN` / 业务 SQL / `COMMIT`（参见 `node_modules/drizzle-orm/sqlite-proxy/session.js:46-51`），每条 SQL 独立走 Worker `/query` endpoint，**不具备真正的原子性**——中间失败时 BEGIN 已提交的语句无法回滚。

**正确路径**：使用 `createBatchExecutor()`（`src/db/index.ts:140`），它直接调用 `WorkerDbClient.batch()`（`src/db/worker-db-client.ts:66`），映射到 Worker 的 `/batch` endpoint，最终走 D1 的原子 batch API。D1 batch 内所有语句要么全部成功，要么全部回滚。

**实现方案**：

```typescript
// delete-policy handler
import { createBatchExecutor } from "@/db";
import { sql } from "drizzle-orm";

const policy = await policiesRepo.findById(policyId);
if (!policy) return notFoundError(policyId);

// 构建原子 batch：5 条 DELETE 语句
const statements = [
  { sql: "DELETE FROM beneficiaries WHERE policy_id = ?", params: [policyId] },
  { sql: "DELETE FROM payments WHERE policy_id = ?",      params: [policyId] },
  { sql: "DELETE FROM cash_values WHERE policy_id = ?",    params: [policyId] },
  { sql: "DELETE FROM coverage_items WHERE policy_id = ?", params: [policyId] },
  { sql: "DELETE FROM policies WHERE id = ?",              params: [policyId] },
];

const batchExecutor = createBatchExecutor();
if (batchExecutor) {
  // Production: atomic via D1 batch API
  await batchExecutor(statements);
} else {
  // Test env (bun:sqlite): sequential delete via repos (in-memory, no network)
  await beneficiariesRepo.deleteByPolicyId(policyId);
  await paymentsRepo.deleteByPolicyId(policyId);
  await cashValuesRepo.deleteByPolicyId(policyId);
  await coverageItemsRepo.deleteByPolicyId(policyId);
  await policiesRepo.delete(policyId);
}
```

**Trade-off**：batch 路径使用 raw SQL 而非 Drizzle query builder，因为 `createBatchExecutor` 接受 `{ sql, params }` 数组。这是有意的——级联删除逻辑简单且固定（5 条 DELETE WHERE），raw SQL 可读性不差，且避免了为 batch 兼容性修改 Repo 层接口。

涉及文件：`mcp/tools/policies.ts`, `src/db/index.ts:140-149`, `src/db/worker-db-client.ts:66-94`

### 5. Tool 粒度：一操作一 Tool

每个 CRUD 操作独立注册为一个 MCP tool，不合并为 `manage-xxx`。原因：
- MCP 协议下 AI Agent 按 tool name 选择操作，语义清晰胜过数量精简
- Zod schema 每个 tool 的参数严格匹配操作语义（create 必填 vs update 可选）
- 与现有 read-only tools（`list-members` / `get-member`）风格一致

### 6. 返回格式：统一 JSON

所有 write 操作返回创建/更新后的完整记录：
```typescript
return {
  content: [{ type: "text", text: JSON.stringify(result) }],
};
```
Delete 操作返回 `{ deleted: true, id: xxx }`。

### 7. Guard 复用

所有新 tools 复用 `checkMcpEnabled()` + `mcpDisabledResult()` guard pattern。

### 8. CashValues / CoverageItems 省略单条 get

这两个实体总是以 policy 维度查询（`list-cash-values?policyId=X`），独立 `get-cash-value` 使用场景极少，省略以减少 tool 数量。需要时可通过 list + filter 实现。

## 原子化提交计划

| # | Commit | Scope | Files |
|---|--------|-------|-------|
| 1 | `feat: add member CUD tools to mcp` | Members | `mcp/tools/members.ts`, `mcp/__tests__/tools-members.test.ts` |
| 2 | `feat: add policy CUD tools to mcp` | Policies | `mcp/tools/policies.ts`, `mcp/__tests__/tools-policies.test.ts` |
| 3 | `feat: add asset CRUD tools to mcp` | Assets | `mcp/tools/assets.ts`, `mcp/__tests__/tools-assets.test.ts` |
| 4 | `feat: add insurer crud tools to mcp` | Insurers | `mcp/tools/insurers.ts`, `mcp/__tests__/tools-insurers.test.ts`, `mcp/server.ts` |
| 5 | `feat: add beneficiary crud tools to mcp` | Beneficiaries | `mcp/tools/beneficiaries.ts`, `mcp/__tests__/tools-beneficiaries.test.ts`, `mcp/server.ts` |
| 6 | `feat: add payment crud tools to mcp` | Payments | `mcp/tools/payments.ts`, `mcp/__tests__/tools-payments.test.ts`, `mcp/server.ts` |
| 7 | `feat: add cash value crud tools to mcp` | CashValues | `mcp/tools/cash-values.ts`, `mcp/__tests__/tools-cash-values.test.ts`, `mcp/server.ts` |
| 8 | `feat: add coverage item crud tools to mcp` | CoverageItems | `mcp/tools/coverage-items.ts`, `mcp/__tests__/tools-coverage-items.test.ts`, `mcp/server.ts` |
| 9 | `docs: update mcp setup doc for crud tools` | Docs | `docs/04-mcp-setup.md`, `docs/13-mcp-crud-tools.md` |

## 测试策略

### Unit Tests（每个 tool 文件配套测试）

每个 tool 测试文件遵循现有 pattern：

```typescript
import { createTestDb, resetTestDb } from "@/db";
import { createMockServer, getHandler, parseResult } from "./helpers";

createTestDb();
```

**现有 helper 的局限性**：`createMockServer()` 捕获 handler 后，`getHandler()` 直接调用 handler 绕过了 Zod schema 解析。Zod 验证实际由 MCP SDK 的 `server.tool()` 在 transport 层执行。

**测试覆盖策略**：

| 测试层 | 覆盖内容 | 方式 |
|--------|----------|------|
| Unit (handler 直接调用) | Guard、业务逻辑、FK restrict、返回格式 | `getHandler()` + `parseResult()` |
| Unit (schema 验证) | Zod discriminatedUnion、必填/可选字段 | 直接 `import { schema }` 并用 `schema.parse()` / `schema.safeParse()` 测试 |
| E2E (transport 层) | MCP SDK 完整 schema → handler 流程 | `client.callTool()` 经过 stdio transport |

每个 tool 至少测试：
1. **Guard**: MCP 关闭时返回 disabled error
2. **Happy path**: 正常操作返回预期结果
3. **Not found**: update/delete 不存在的 ID 返回 isError
4. **FK restrict** (delete-member/asset/insurer): 有引用时拒绝删除并返回引用详情
5. **Discriminated union** (create-policy): `insuredType=Member` 但缺 `insuredMemberId` 时 schema reject
6. **Insurer rename sync** (update-insurer): 改名后关联 policy 的 `insurerName` 同步更新

### Coverage Target

每个新增 tool 文件至少 3-5 个 test cases，保持整体 MCP 测试覆盖率 > 90%。

### E2E Tests

`mcp/__tests__/mcp.e2e.test.ts` 扩展：

**隔离策略变更**：现有 E2E 在 `beforeAll` 对远端 test DB seed 一次。引入写入型 tools 后，write 操作会修改 DB 状态，影响后续测试。

采用 **per-describe seed** 策略：
```typescript
// 现有 read-only tests 保持不变（beforeAll seed 一次）
describe("read tools", () => { ... });

// 写入型 tests 使用独立 describe，每组前重新 seed
describe("write tools", () => {
  beforeEach(async () => {
    // re-seed remote D1 test database
    await seedRemoteDb();
  });

  test("create → get → update → delete member", async () => { ... });
  test("create policy with Member insuredType", async () => { ... });
  test("delete-member fails when referenced by policies", async () => { ... });
});
```

抽检 write tools 的端到端流程：
- Member CRUD lifecycle
- Policy create with discriminated union validation
- delete-member restrict behavior
- update-insurer name sync

## 完成后 Tool 总览

扩展后 MCP 从 **8 tools** 增至 **41 tools**（新增 33 个）：

| Entity | Read | Create | Update | Delete | Total |
|--------|------|--------|--------|--------|-------|
| Members | list, get | create | update | delete | 2 → **5** |
| Policies | list, get | create | update | delete | 2 → **5** |
| Assets | list, **get** | create | update | delete | 1 → **5** |
| Insurers | **list, get** | **create** | **update** | **delete** | 0 → **5** |
| Beneficiaries | **list, get** | **create** | **update** | **delete** | 0 → **5** |
| Payments | **list, get** | **create** | **update** | **delete** | 0 → **5** |
| CashValues | **list** | **create** | **update** | **delete** | 0 → **4** |
| CoverageItems | **list** | **create** | **update** | **delete** | 0 → **4** |
| Coverage (analytics) | 3 tools | — | — | — | **3** |
| **Total** | **17** | **8** | **8** | **8** | **41** |

> 验算：现有 5 read + 3 analytics = 8 tools。新增 12 read (list/get for 5 new entities + get-asset) + 8 create + 8 update + 8 delete - 3 unchanged analytics = 33 new tools。8 + 33 = **41**。Read 总数 = 5 existing + 12 new = 17。
