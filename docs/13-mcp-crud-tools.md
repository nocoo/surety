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
| Members | full CRUD | list + get | **create, update, delete** |
| Policies | full CRUD | list + get | **create, update, delete** |
| Assets | full CRUD | list only | **get, create, update, delete** |
| Insurers | full CRUD + findOrCreate | 无 | **全部** |
| Beneficiaries | full CRUD + deleteByPolicyId | 内嵌于 get-policy | **独立 CRUD** |
| Payments | full CRUD + createMany | 无 | **全部** |
| CashValues | full CRUD + createMany | 无 | **全部** |
| CoverageItems | full CRUD + createMany | 无 | **全部** |

## 设计方案

### 新增 MCP Tools 清单（27 个）

#### Members（+3）

| Tool | Description | Parameters | Repo Method |
|------|-------------|------------|-------------|
| `create-member` | Create a new family member | `name`, `relation`, `gender?`, `birthDate?`, `idCard?`, `idType?`, `idExpiry?`, `phone?`, `hasSocialInsurance?` | `membersRepo.create()` |
| `update-member` | Update an existing family member | `memberId`, + all optional fields | `membersRepo.update()` |
| `delete-member` | Delete a family member | `memberId` | `membersRepo.delete()` |

#### Policies（+3）

| Tool | Description | Parameters | Repo Method |
|------|-------------|------------|-------------|
| `create-policy` | Create a new insurance policy | `applicantId`, `insuredType`, `category`, `insurerName`, `productName`, `policyNumber`, `sumAssured`, `premium`, `paymentFrequency`, `effectiveDate`, + optionals | `policiesRepo.create()` |
| `update-policy` | Update an existing policy | `policyId`, + all optional fields | `policiesRepo.update()` |
| `delete-policy` | Delete a policy and all related records | `policyId` | `policiesRepo.delete()` + cascade |

#### Assets（+3）

| Tool | Description | Parameters | Repo Method |
|------|-------------|------------|-------------|
| `get-asset` | Get detailed info of a specific asset | `assetId` | `assetsRepo.findById()` |
| `create-asset` | Create a new insured asset | `type`, `name`, `identifier`, `ownerId?`, `details?` | `assetsRepo.create()` |
| `update-asset` | Update an existing asset | `assetId`, + all optional fields | `assetsRepo.update()` |
| `delete-asset` | Delete an asset | `assetId` | `assetsRepo.delete()` |

> Note: `get-asset` 补全现有 `list-assets` 的缺失。实际新增 4 个 tools。

#### Insurers（+5，全新实体）

| Tool | Description | Parameters | Repo Method |
|------|-------------|------------|-------------|
| `list-insurers` | List all insurance companies | — | `insurersRepo.findAll()` |
| `get-insurer` | Get insurer details | `insurerId` | `insurersRepo.findById()` |
| `create-insurer` | Create a new insurer | `name`, `phone?`, `website?` | `insurersRepo.create()` |
| `update-insurer` | Update an existing insurer | `insurerId`, + optional fields | `insurersRepo.update()` |
| `delete-insurer` | Delete an insurer | `insurerId` | `insurersRepo.delete()` |

#### Beneficiaries（+5，全新实体）

| Tool | Description | Parameters | Repo Method |
|------|-------------|------------|-------------|
| `list-beneficiaries` | List beneficiaries for a policy | `policyId` | `beneficiariesRepo.findByPolicyId()` |
| `get-beneficiary` | Get beneficiary details | `beneficiaryId` | `beneficiariesRepo.findById()` |
| `create-beneficiary` | Add a beneficiary to a policy | `policyId`, `sharePercent`, `rankOrder`, `memberId?`, `externalName?`, `externalIdCard?` | `beneficiariesRepo.create()` |
| `update-beneficiary` | Update a beneficiary record | `beneficiaryId`, + optional fields | `beneficiariesRepo.update()` |
| `delete-beneficiary` | Remove a beneficiary | `beneficiaryId` | `beneficiariesRepo.delete()` |

#### Payments（+5，全新实体）

| Tool | Description | Parameters | Repo Method |
|------|-------------|------------|-------------|
| `list-payments` | List payment records for a policy | `policyId` | `paymentsRepo.findByPolicyId()` |
| `get-payment` | Get payment record details | `paymentId` | `paymentsRepo.findById()` |
| `create-payment` | Add a payment record | `policyId`, `periodNumber`, `dueDate`, `amount`, `status?`, `paidDate?`, `paidAmount?` | `paymentsRepo.create()` |
| `update-payment` | Update a payment record | `paymentId`, + optional fields | `paymentsRepo.update()` |
| `delete-payment` | Remove a payment record | `paymentId` | `paymentsRepo.delete()` |

#### CashValues（+4，全新实体）

| Tool | Description | Parameters | Repo Method |
|------|-------------|------------|-------------|
| `list-cash-values` | List cash value records for a policy | `policyId` | `cashValuesRepo.findByPolicyId()` |
| `create-cash-value` | Add a cash value record | `policyId`, `policyYear`, `value` | `cashValuesRepo.create()` |
| `update-cash-value` | Update a cash value record | `cashValueId`, `policyYear?`, `value?` | `cashValuesRepo.update()` |
| `delete-cash-value` | Remove a cash value record | `cashValueId` | `cashValuesRepo.delete()` |

#### CoverageItems（+4，全新实体）

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

### 1. Tool 粒度：一操作一 Tool

每个 CRUD 操作独立注册为一个 MCP tool，不合并为 `manage-xxx`。原因：
- MCP 协议下 AI Agent 按 tool name 选择操作，语义清晰胜过数量精简
- Zod schema 每个 tool 的参数严格匹配操作语义（create 必填 vs update 可选）
- 与现有 read-only tools（`list-members` / `get-member`）风格一致

### 2. Delete 操作：Policy 级联删除

`delete-policy` 需级联删除关联子记录：
```
beneficiariesRepo.deleteByPolicyId(policyId)
paymentsRepo.deleteByPolicyId(policyId)
cashValuesRepo.deleteByPolicyId(policyId)
coverageItemsRepo.deleteByPolicyId(policyId)
policiesRepo.delete(policyId)
```
其他实体的 delete 为直接删除（无级联需求）。

### 3. 参数验证：Zod Schema 层

所有参数在 MCP tool 注册时通过 Zod schema 验证：
- `create-*`：必填字段标记为 `z.xxx()`，可选字段标记为 `z.xxx().optional()`
- `update-*`：除 ID 外全部 optional（partial update）
- Enum 字段使用 `z.enum([...])` 强类型约束

### 4. 返回格式：统一 JSON

所有 write 操作返回创建/更新后的完整记录：
```typescript
return {
  content: [{ type: "text", text: JSON.stringify(result) }],
};
```
Delete 操作返回 `{ deleted: true, id: xxx }`。

### 5. Guard 复用

所有新 tools 复用 `checkMcpEnabled()` + `mcpDisabledResult()` guard pattern。

### 6. CashValues / CoverageItems 省略单条 get

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

// 每个 tool 至少测试:
// 1. Guard: MCP 关闭时返回 disabled error
// 2. Happy path: 正常操作返回预期结果
// 3. Not found: update/delete 不存在的 ID 返回 isError
// 4. Validation: create 缺少必填字段时 Zod 自动拦截（由 MCP SDK 处理）
```

### Coverage Target

每个新增 tool 文件至少 3 个 test cases（guard + happy path + not found），保持整体 MCP 测试覆盖率 > 90%。

### E2E Tests

`mcp/__tests__/mcp.e2e.test.ts` 扩展：抽检 2-3 个 write tools 的端到端流程（create → get → update → delete）。

## 完成后 Tool 总览

扩展后 MCP 从 **8 tools** 增至 **35+ tools**：

| Entity | Read | Create | Update | Delete | Total |
|--------|------|--------|--------|--------|-------|
| Members | list, get | create | update | delete | 4 → **5** |
| Policies | list, get | create | update | delete | 4 → **5** |
| Assets | list, **get** | create | update | delete | 1 → **5** |
| Insurers | **list, get** | **create** | **update** | **delete** | 0 → **5** |
| Beneficiaries | **list, get** | **create** | **update** | **delete** | 0 → **5** |
| Payments | **list, get** | **create** | **update** | **delete** | 0 → **5** |
| CashValues | **list** | **create** | **update** | **delete** | 0 → **4** |
| CoverageItems | **list** | **create** | **update** | **delete** | 0 → **4** |
| Coverage (analytics) | 3 tools | — | — | — | **3** |
| **Total** | | | | | **41** |
