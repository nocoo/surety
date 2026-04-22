# 16. CLI 替换 MCP（@nocoo/surety）

Status: Planned (2026-04-22, revised)

## 背景

目前 `packages/mcp` 是面向 LLM 的 MCP server，通过 stdio 提供 12 个工具集 (≈2.3k 行) 调用 Worker API。问题：

- **安装路径重**：需要 `mcpServers` 配置 + 本地 clone 源码 + `bun run packages/mcp/src/index.ts`。
- **传播不友好**：MCP 只能被支持 MCP 的 AI 客户端消费，无法直接给人/脚本用。
- **设置页开关冗余**：`mcp.enabled` + 路径复制卡片，需要用户手动拼 JSON。

目标：用可全局安装的 **`@nocoo/surety` CLI** 完整替换 MCP，保留所有**现有可用**功能（同样调 `surety-api.hexly.ai`），对 AI 客户端输出 JSON，默认精简摘要节约 context。

## 原则

- **薄壳**：CLI 只做 (参数解析 + API 调用 + 输出格式化)，业务逻辑仍在 Worker / `@surety/api`。
- **与 `@nocoo/cli-base` 生态对齐**：复用 `performLogin` loopback、`ConfigManager`、`citty`、`createUpdateCommand`。
- **发布友好**：`npm install -g @nocoo/surety`，内部不依赖 monorepo 其他包（独立 fetch wrapper）。
- **AI-first 输出契约**：**始终 JSON**，默认摘要（节约 context），`--full` 返完整。不提供"人类可读表格"模式——CLI 是给 AI 用的工具，人类用 web UI。

## 现状审计：Worker 已有的 API（CLI 要覆盖的真实范围）

以 `apps/worker/src/routes/` 为真相源：

| 实体 | 端点 | CLU 动作 |
|------|------|---------|
| members | `/api/members[/:id]` | ls/get/add/update/rm |
| policies | `/api/policies[/:id]` | ls/get/add/update/rm |
| policies.payments | `/api/policies/:id/payments[/:paymentId]` + `/payments/generate` | ls/add/update/rm/generate |
| policies.beneficiaries | `/api/policies/:id/beneficiaries` (GET + POST 批量替换) | ls/set |
| policies.coverage-items | `/api/policies/:id/coverage-items[/:itemId]` | ls/add/update/rm |
| policies.attachments | `/api/policies/:id/attachments[/:attachmentId]` + `/file` | ls/add/rm/download |
| assets | `/api/assets[/:id]` | ls/get/add/update/rm |
| insurers | `/api/insurers[/:id]` | ls/get/add/update/rm |
| hospitals | `/api/hospitals[/:id]` | ls/get/add/update/rm |
| doctors | `/api/doctors[/:id]` | ls/get/add/update/rm |
| medical-visits | `/api/medical-visits[/:id]` | ls/get/add/update/rm |
| coverage-lookup | `/api/coverage-lookup?type=member|asset&id=N` (只读) | coverage lookup |
| renewal-calendar | `/api/renewal-calendar` (只读) | renewals |
| dashboard | `/api/dashboard` (只读) | dashboard |

**不覆盖**的 MCP 原有工具：
- `cash-values`：MCP 里本身就是"Not available"stub（`packages/mcp/src/tools/cash-values.ts` 第 7 行起），CLI 直接不实现。
- `coverage`（第二层）：拆成三个顶层命令 `coverage`/`renewals`/`dashboard`，不再叠一层。

**子资源形式**：`policies` 子命令下放 `payments` / `beneficiaries` / `coverage-items` / `attachments`，主键都是 `policyId`（与真实 API 一致）。

## 目标结构

```
surety/
├── apps/
│   ├── cli/                           # ⭐ 新增
│   │   ├── package.json               # name: "@nocoo/surety", bin: { surety: dist/index.js }
│   │   ├── tsconfig.json
│   │   ├── README.md
│   │   └── src/
│   │       ├── index.ts               # citty runMain
│   │       ├── config.ts              # ConfigManager<SuretyConfig>
│   │       ├── api.ts                 # fetch wrapper (读 config token)
│   │       ├── output.ts              # JSON 输出：summary vs full
│   │       ├── auth.ts                # login/logout/whoami
│   │       └── commands/
│   │           ├── members.ts
│   │           ├── policies.ts        # 含 payments/beneficiaries/coverage-items/attachments 子命令
│   │           ├── assets.ts
│   │           ├── insurers.ts
│   │           ├── hospitals.ts
│   │           ├── doctors.ts
│   │           ├── medical-visits.ts
│   │           ├── coverage.ts        # coverage-lookup
│   │           ├── renewals.ts        # renewal-calendar
│   │           └── dashboard.ts
│   ├── web/                           # 修改：删 MCP 设置卡片
│   └── worker/                        # 修改：/api/auth/cli 兼容 base-cli 的 `?callback=`
├── packages/
│   ├── api/
│   ├── db/
│   └── mcp/                           # 🔥 Phase 2 一刀删除
└── docs/
    ├── 04-mcp-setup.md                # 🔥 Phase 2 删除
    ├── 13-mcp-crud-tools.md           # 🔥 Phase 2 删除
    └── 16-cli-replace-mcp.md          # 本文档
```

### `apps/cli/package.json`

```json
{
  "name": "@nocoo/surety",
  "version": "0.1.0",
  "description": "Surety CLI — manage family insurance policies from the terminal",
  "type": "module",
  "bin": { "surety": "./dist/index.js" },
  "main": "./dist/index.js",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@nocoo/cli-base": "^0.2.4"
  }
}
```

注：**不依赖** `@surety/api` / `@surety/db` / zod，参数校验在 Worker 侧。

## Worker 侧调整

### 1. `/api/auth/cli` 同时接受 `callback` 与 `callback_url`

cli-base 的 `performLogin` 默认用 `?callback=…`；现有代码用 `?callback_url=…`。加兼容：

```typescript
const callbackUrl = c.req.query("callback") ?? c.req.query("callback_url");
```

### 2. 删除 MCP 相关设置

- `settings` 表里 `mcp.enabled` 行可留可清（KV，遗留无害）
- Worker **没有**专门的 `mcp.enabled` 业务逻辑，所以 Worker 代码不需要删（已确认）
- Web 端 `mcp-settings.tsx` 组件 + 引用：删除

## CLI 命令设计

### 顶层

```
surety login           # 浏览器 loopback auth
surety logout          # 清 config
surety whoami          # 显示 email + apiUrl

surety <command> [args] [flags]

# global flags:
  --full               # 返回完整数据（默认摘要）
  --api-url <url>      # 覆盖 apiUrl
  --token <token>      # 覆盖 token
```

### 命令矩阵（严格对齐 Worker 现有 API）

```
surety members ls|get|add|update|rm
surety policies ls|get|add|update|rm
surety policies payments ls <policyId>
surety policies payments add|update|rm <policyId> [paymentId]
surety policies payments generate <policyId>
surety policies beneficiaries ls <policyId>
surety policies beneficiaries set <policyId>       # POST 批量替换
surety policies coverage-items ls|add|update|rm <policyId> [itemId]
surety policies attachments ls|add|rm|download <policyId> [attId]
surety assets ls|get|add|update|rm
surety insurers ls|get|add|update|rm
surety hospitals ls|get|add|update|rm
surety doctors ls|get|add|update|rm
surety medical-visits ls|get|add|update|rm
surety coverage <type> <id>         # coverage-lookup: type=member|asset
surety renewals                     # renewal-calendar
surety dashboard                    # dashboard summary
```

### 输出契约（**唯一权威**，哥决策的形态）

- **始终 JSON**（stdout）。不提供表格/human 模式。
- **摘要模式（默认）**：每个实体仅返回核心字段，节约 AI context：
  - `members ls` → `[{id, name, relation}]`
  - `policies ls` → `[{id, policyNumber, insurerName, memberName}]`
  - `members get 5` → 不含嵌套 policies
  - `dashboard` → 纯计数，不含嵌套
- **Full 模式（`--full`）**：透传 Worker 原始响应。
- **错误**：stderr 写 `{"error": "...", "status": 401}` JSON，退出码 1。
- **成功**：stdout 写数据，退出码 0。
- **幂等**：同一命令输出对齐 Worker 响应；CLI 不做字段重命名。

### `surety login` 流程

1. `performLogin({ apiUrl: "https://surety.hexly.ai", loginPath: "/api/auth/cli", tokenParam: "api_key" })`
2. loopback `/callback?api_key=...&state=...&email=...`
3. 写 `~/.config/surety/config.json`：
   - `apiUrl: "https://surety-api.hexly.ai"`（数据平面，纯 Bearer）
   - `loginUrl: "https://surety.hexly.ai"`（auth 平面，CF Access）
   - `token`, `email`
4. stdout `{"ok": true, "email": "zheng@hexly.ai"}`

### Config

`~/.config/surety/config.json`（0600）：

```json
{
  "apiUrl": "https://surety-api.hexly.ai",
  "loginUrl": "https://surety.hexly.ai",
  "token": "sk_...",
  "email": "zheng@hexly.ai"
}
```

支持 `SURETY_ENV=dev` → `config.dev.json`。

## 分阶段执行（原子提交，**每阶段独立通过 `bun test` + `bun run lint` + `bun run typecheck`**）

### Phase 0: 规划文档 ✅

- [x] `docs/16-cli-replace-mcp.md` 本文档

Commit: `docs: plan CLI replacement for MCP` (已完成)

### Phase 1: Worker 小改动

- [ ] `apps/worker/src/routes/auth-cli.ts`: 接受 `?callback` 作为 `?callback_url` 别名
- [ ] 测试补充：两种参数都能跑通

Commit: `feat(worker): accept ?callback as alias of ?callback_url`

**门禁**: 全部 test/lint/typecheck 通过。此阶段不触碰 MCP，不影响现有测试。

### Phase 2: 一刀删除 MCP（**独立于 CLI，先把包拆掉再建新的**）

**关键决策**：先删除 MCP（及所有残留），再建 CLI。这样每个阶段门禁都绿，不会陷入"Phase 4 删 UI / Phase 5 删包"的半残状态。

- [ ] 删除 `packages/mcp/` 整个目录
- [ ] 根 `package.json`：
  - [ ] workspaces 移除 `packages/mcp`
  - [ ] scripts 删除 `test:mcp`、`test:mcp:e2e`、`mcp`、`mcp:build` 等 MCP 相关
- [ ] 根 `tsconfig.base.json` references 清理（如有）
- [ ] `apps/web/src/app/settings/components/mcp-settings.tsx` → 删除
- [ ] `apps/web/src/app/settings/components/index.ts` → 移除 `McpSettings` export
- [ ] `apps/web/src/app/settings/page.tsx` → 移除 `<McpSettings />` 引用
- [ ] `apps/web_legacy/scripts/check-coverage.ts`、`apps/web_legacy/Dockerfile` MCP 相关行 → 清理
- [ ] `docs/04-mcp-setup.md` → 删除
- [ ] `docs/13-mcp-crud-tools.md` → 删除
- [ ] `README.md`：项目树 + 命令表 + MCP 章节整体清理，先留一段"CLI 即将到来"占位
- [ ] `CLAUDE.md`：项目树更新
- [ ] `.claude/` hooks 如引用 MCP 清理
- [ ] 全仓 grep 验证：`rg -i 'mcp|McpServer' --glob '!docs/16-*.md' --glob '!CHANGELOG.md'` 结果仅剩可接受残留（如 `cli-base` 中的通用 MCP 术语等——但 cli-base 本身不含 MCP）

**验证**：
- `bun install` 通过
- `bun run typecheck` 通过
- `bun test` 通过（不应再有 MCP 测试）
- Web SPA 构建通过 (`cd apps/web && bun run build`)

Commit: `refactor: remove @surety/mcp and related UI/docs`

### Phase 3: CLI 脚手架 + Auth

- [ ] 创建 `apps/cli/` 目录结构
- [ ] `package.json` / `tsconfig.json`
- [ ] workspaces 添加 `apps/cli`
- [ ] `src/index.ts` citty runMain 空壳（仅 `--help` / `--version`）
- [ ] `src/config.ts`：`ConfigManager<SuretyConfig>`
- [ ] `src/api.ts`：fetch wrapper（从 config 读 token）
- [ ] `src/auth.ts`：`login` / `logout` / `whoami`
- [ ] 手动 E2E：`bun --cwd apps/cli src/index.ts login` → 浏览器 → token 落盘 → `whoami` 输出 email

Commit: `feat(cli): scaffold @nocoo/surety with login/logout/whoami`

### Phase 4: 业务命令（按实体拆分，每个原子 commit）

- [ ] `src/output.ts`：`summarize(data, kind)` + `toJson(data, full)`
- [ ] `members` → commit
- [ ] `insurers` → commit
- [ ] `assets` → commit
- [ ] `hospitals` → commit
- [ ] `doctors` → commit
- [ ] `medical-visits` → commit
- [ ] `policies` 主 CRUD → commit
- [ ] `policies payments` 子命令 → commit
- [ ] `policies beneficiaries` → commit
- [ ] `policies coverage-items` → commit
- [ ] `policies attachments` → commit
- [ ] `coverage` + `renewals` + `dashboard` 合并 commit（都是只读小命令）

每个 commit: `feat(cli): add <scope> commands`

### Phase 5: 文档 + 发布

- [ ] `apps/cli/README.md`：安装、登录、完整命令清单、AI 使用示例
- [ ] 根 `README.md`：CLI 章节替换 Phase 2 的占位
- [ ] `CLAUDE.md`：同步 CLI 工作流
- [ ] `bun run build` → `apps/cli/dist/`
- [ ] `npm publish --access public`（`@nocoo/surety@0.1.0`）
- [ ] 建一个 tag `cli-v0.1.0`

Commit: `chore(cli): publish @nocoo/surety v0.1.0`

## 验证清单（总体）

**每个 Phase 后都必须通过**：
- `bun install`（workspaces 无 broken 引用）
- `bun run typecheck`
- `bun run lint`
- `bun test`

**完成后整体验证**：
- `surety login` → 浏览器 OAuth 走通
- `surety members ls` / `policies ls` 输出正确 JSON
- `surety members ls --full` 包含完整字段
- `surety dashboard` / `surety renewals` / `surety coverage member 1` 正常
- `surety policies payments ls 3` / `surety policies beneficiaries ls 3` 正常
- `npm install -g @nocoo/surety` 后全局 `surety` 可执行
- 全仓 `rg -i 'mcp|McpServer'` 仅剩 CHANGELOG 与本规划文档

## 风险与对策

| 风险 | 对策 |
|------|------|
| Phase 2 删除范围漏网 | Phase 2 结尾跑 `rg -i 'mcp'` 全仓扫描，把结果写进 commit message |
| CLI publish 后 apiUrl 硬编码 | `--api-url` flag + config 存储；README 写明 self-host 配法 |
| `@nocoo/surety` 被占 | 已 `npm view @nocoo/surety` → 404，可用 |
| cli-base `?callback` 与旧 `?callback_url` 不兼容 | Phase 1 在 Worker 显式兼容层 |
| `apps/web_legacy` 还没删，里面 MCP 引用扫干净后仍残留 legacy 代码 | Phase 2 只清理 legacy 中与 MCP 相关的行；legacy 本身独立清理任务 |
| batch 操作（beneficiaries `set`）CLI 如何传 JSON | CLI 接受 stdin JSON：`surety policies beneficiaries set 3 < beneficiaries.json` |

## 用户视角（AI / 脚本）

```bash
bun install -g @nocoo/surety
surety login
# 浏览器 → Google OAuth → 终端
# {"ok": true, "email": "zheng@hexly.ai"}

surety members ls
# [{"id":1,"name":"李征","relation":"Self"}, ...]

surety policies get 3 --full
# 完整 policy 对象含所有嵌套

# AI 客户端：把 `surety` 命令列表告诉 AI，让它自主调用 shell
```

## 与前一版规划的差异

1. ~~MCP 删除在 Phase 5~~ → **提前到 Phase 2**，消除"中间 Phase 必红"的门禁冲突
2. ~~cash-values 独立命令组~~ → **删除**（MCP 里本身是 stub）
3. ~~coverage-items `--coverage-id`~~ → **`--policy-id`**（与 Worker 实际 API 一致，挂在 policy 下）
4. ~~beneficiaries `add/update/rm`~~ → **`ls/set`**（Worker 只提供 GET + POST 批量替换）
5. ~~coverage 单命令~~ → **拆成 `coverage`/`renewals`/`dashboard`**，对齐 Worker 三个只读端点
6. 增加 `policies attachments` 子命令（MCP 原本未覆盖附件，CLI 顺手补上）
7. 输出契约明确：**始终 JSON，仅 summary/full 两档**，删除"人类可读表格"矛盾表述
