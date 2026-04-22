# 16. CLI 替换 MCP（@nocoo/surety）

Status: **Phase 1–4 完成**，Phase 5（README + 发布）待办 (2026-04-22, revised again)

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

## 现状审计：Worker 已有的 API（CLI 覆盖的真实范围）

以 `apps/worker/src/routes/` 为真相源（`policies.ts` 最新审计 2026-04-22）：

| 实体 | 端点 | HTTP 方法 | CLI 动作 |
|------|------|-----------|----------|
| members | `/api/members[/:id]` | GET/POST/PUT/DELETE | ls/get/add/update/rm |
| policies | `/api/policies[/:id]` | GET/POST/PUT/DELETE | ls/get/add/update/rm |
| policies.payments | `/api/policies/:id/payments[/:paymentId]` + `/payments/generate` | GET/POST/PUT/DELETE + POST | ls/add/update/rm/generate |
| policies.beneficiaries | `/api/policies/:id/beneficiaries` | **GET only**（无 POST/PUT/DELETE） | **ls only** |
| policies.coverage-items | `/api/policies/:id/coverage-items[/:itemId]` | GET/POST/PUT/DELETE | ls/get/add/update/rm |
| policies.attachments | `/api/policies/:id/attachments[/:attachmentId]` + `/file` | GET/POST/DELETE + GET(stream) | ls/get/rm（无 upload，附件仍走 web UI multipart） |
| assets | `/api/assets[/:id]` | GET/POST/PUT/DELETE | ls/get/add/update/rm |
| insurers | `/api/insurers[/:id]` | GET/POST/PUT/DELETE | ls/get/add/update/rm |
| hospitals | `/api/hospitals[/:id]` | GET/POST/PUT/DELETE | ls/get/add/update/rm |
| doctors | `/api/doctors[/:id]` | GET/POST/PUT/DELETE | ls/get/add/update/rm |
| medical-visits | `/api/medical-visits[/:id]` | GET/POST/PUT/DELETE | ls/get/add/update/rm |
| coverage-lookup | `/api/coverage-lookup?type=member\|asset&id=N` | GET | coverage |
| renewal-calendar | `/api/renewal-calendar` | GET | renewals |
| dashboard | `/api/dashboard` | GET | dashboard |

**不覆盖**的 MCP 原有工具：
- `cash-values`：MCP 里本身是 "Not available" stub，CLI 直接不实现。
- `coverage`（第二层嵌套）：拆成三个顶层命令 `coverage`/`renewals`/`dashboard`，不再叠一层。

**后端缺口（CLI 无法填补，需要 Worker 先加能力）**：
- beneficiaries 写入（新增/替换/删除）：CLI 暂无 `set`/`add`/`rm`，用户需用 Web UI。
- attachments 上传：CLI 无 `add`/`upload`，Worker 有 POST multipart 但 CLI 当前不实现上传路径。
- policies 嵌套读取：GET /api/policies/:id **不**内联 payments / beneficiaries / coverage-items / attachments。需要嵌套视图请分别调 `policies payments ls`、`coverage-items ls` 等子命令。

如未来要补足这些能力，需要先在 Worker 端加路由（如 `POST /api/policies/:id/beneficiaries` 批量替换），然后再扩 CLI。

**子资源形式**：`policies` 子命令下放 `payments` / `beneficiaries` / `coverage-items` / `attachments`，主键都是 `policyId`（与真实 API 一致）。

## 已落地的目标结构（截至 2026-04-22）

```
surety/
├── apps/
│   ├── cli/                           # ⭐ 已创建并接入根测试/typecheck
│   │   ├── package.json               # name: "@nocoo/surety", bin 指向 src/index.ts（无 build/dist）
│   │   ├── tsconfig.json
│   │   ├── __tests__/                 # 6 个测试文件，36 passing
│   │   └── src/
│   │       ├── index.ts               # citty runMain
│   │       ├── config.ts              # ConfigManager<SuretyConfig>
│   │       ├── api.ts                 # fetch wrapper (读 config token)
│   │       ├── output.ts              # JSON 输出：summary vs full
│   │       ├── lib/
│   │       │   ├── client.ts          # buildClient() 解析 config + token
│   │       │   ├── json-input.ts      # --data / --data-file / stdin 优先级
│   │       │   └── crud.ts            # defineCrudCommand<T> 工厂
│   │       └── commands/
│   │           ├── auth.ts            # login/logout/whoami
│   │           ├── members.ts / insurers.ts / assets.ts / hospitals.ts / doctors.ts / medical-visits.ts
│   │           ├── policies.ts        # 主 CRUD + payments/beneficiaries/coverage-items/attachments 子命令
│   │           └── readonly.ts        # coverage/renewals/dashboard
│   ├── web/                           # 已删 MCP 设置卡片
│   └── worker/                        # 已加 /api/auth/cli 的 `?callback` 兼容
├── packages/
│   ├── api/
│   └── db/
│   # packages/mcp/ 已删除
└── docs/
    # docs/04-mcp-setup.md / 13-mcp-crud-tools.md 已删除
    └── 16-cli-replace-mcp.md          # 本文档
```

### `apps/cli/package.json` 当前形态（**源码直跑，无 build**）

```json
{
  "name": "@nocoo/surety",
  "version": "0.1.0",
  "type": "module",
  "bin": { "surety": "./src/index.ts" },
  "files": ["src", "README.md"],
  "scripts": {
    "test": "bun test __tests__/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "@nocoo/cli-base": "^0.2.4" },
  "devDependencies": { "@types/bun": "...", "typescript": "..." }
}
```

**注**：bin 直接指向 TypeScript 源码，依赖 Bun 的 shebang 执行。发布到 npm 前需要 Phase 5 决定要不要加 build / dist。目前 `bun run apps/cli/src/index.ts ...` 可直接跑。

## Worker 侧调整

### 1. `/api/auth/cli` 同时接受 `callback` 与 `callback_url` ✅ 已完成

cli-base 的 `performLogin` 默认用 `?callback=…`；原代码用 `?callback_url=…`。已加兼容：

```typescript
const callbackUrl = c.req.query("callback_url") ?? c.req.query("callback");
```

### 2. 删除 MCP 相关设置 ✅ 已完成

- `settings` 表里 `mcp.enabled` 行保留（KV，遗留无害）
- Web 端 `mcp-settings.tsx` 组件已删除

## CLI 命令设计

### 顶层

```
surety login           # 浏览器 loopback auth
surety logout          # 清 config
surety whoami          # 显示 email + apiUrl

surety <command> [args] [flags]

# global flags:
  --full               # 返回完整数据（默认摘要）
```

### 命令矩阵（严格对齐 Worker 现有 API）

```
surety members ls|get|add|update|rm
surety policies ls|get|add|update|rm
surety policies payments ls <policyId>
surety policies payments add|update|rm <policyId> [paymentId]
surety policies payments generate <policyId>
surety policies beneficiaries ls <policyId>            # 只读：Worker 当前无写入端点
surety policies coverage-items ls|get|add|update|rm <policyId> [itemId]
surety policies attachments ls|get|rm <policyId> [attId]  # 无 upload；附件上传走 Web UI
surety assets ls|get|add|update|rm
surety insurers ls|get|add|update|rm
surety hospitals ls|get|add|update|rm
surety doctors ls|get|add|update|rm
surety medical-visits ls|get|add|update|rm
surety coverage --type=member|asset --id=<n>
surety renewals
surety dashboard
```

### 输出契约（**唯一权威**）

- **始终 JSON**（stdout）。不提供表格/human 模式。
- **摘要模式（默认）**：每个实体仅返回核心字段，节约 AI context：
  - `members ls` → `[{id, name, relation}]`
  - `policies ls` → `[{id, policyNumber, productName, insurerName, category, status, nextDueDate}]`
- **Full 模式（`--full`）**：透传 Worker 原始响应**本身**——不会额外拼接嵌套资源。例：`policies get 3 --full` 返回 Worker GET /api/policies/:id 的扁平字段（applicant/insured 名称、保费、日期、状态等），**不含** payments / beneficiaries / coverage-items / attachments；要拿这些子资源请用对应子命令。
- **错误**：stderr 写 `{"ok": false, "error": "..."}` JSON，退出码 1。
- **成功**：stdout 写数据，退出码 0。

### `surety login` 流程

Surety 有**两个独立域**：
- `loginUrl`（默认 `https://surety.hexly.ai`）：CF Access 保护，承载 `/api/auth/cli` 铸 token 入口
- `apiUrl`（默认 `https://surety-api.hexly.ai`）：数据平面，纯 Bearer token

`surety login` 走 `loginUrl`，完成后把 token 和两个 URL 都落到 config；之后所有业务命令走 `apiUrl`。

1. `performLogin({ apiUrl: loginUrl, loginPath: "/api/auth/cli", tokenParam: "api_key" })`
   （cli-base 的参数名叫 `apiUrl`，但这里传的是"铸 token 入口"的 origin，即 loginUrl）
2. 浏览器走 CF Access（Google OAuth）→ Worker 用 `accessEmail` 铸 token → 302 到 loopback `/callback?api_key=...&state=...&email=...`
3. 写 `~/.config/surety/config.json`：`apiUrl`、`loginUrl`、`token`、`email`
4. stdout `{"ok": true, "apiUrl": "...", "loginUrl": "...", "email": "..."}`

覆盖方式（dev / self-host）：
- 命令行：`surety login --login-url=... --api-url=...`
- 环境变量：`SURETY_LOGIN_URL` / `SURETY_API_URL` / `SURETY_API_TOKEN`
- `SURETY_CLI_DEV=1` → 使用 `config.dev.json`

## 分阶段执行（原子提交）

### Phase 0: 规划文档 ✅

- [x] `docs/16-cli-replace-mcp.md`

### Phase 1: Worker 小改动 ✅

- [x] `/api/auth/cli` 接受 `?callback` 作为 `?callback_url` 别名
- [x] 测试补充

### Phase 2: 一刀删除 MCP ✅

- [x] 删除 `packages/mcp/` 整个目录
- [x] 根 `package.json` workspaces + scripts 清理（`test:mcp`、`test:mcp:e2e`、`mcp` 已删除；`typecheck` 已把 `apps/cli` 接入）
- [x] 根 `tsconfig.json` paths 清理（`@surety/mcp` / `@surety/mcp/*` 别名已移除，2026-04-22）
- [x] `apps/web/src/app/settings/components/mcp-settings.tsx` 删除
- [x] `apps/web_legacy/scripts/check-coverage.ts`、`apps/web_legacy/Dockerfile` MCP 相关行清理
- [x] `docs/04-mcp-setup.md` / `docs/13-mcp-crud-tools.md` 删除
- [x] `README.md` / `CLAUDE.md` / `.env.example` MCP 引用清理

### Phase 3: CLI 脚手架 + Auth ✅

- [x] `apps/cli/` 目录 + package.json + tsconfig
- [x] `src/config.ts` / `src/api.ts` / `src/output.ts`
- [x] `src/commands/auth.ts`: `login` / `logout` / `whoami`
- [x] **2026-04-22 修正**：分离 `loginUrl`（CF-Access 保护，铸 token）与 `apiUrl`（数据平面，Bearer）。之前 login 把 `apiUrl=surety-api.hexly.ai` 传给 `performLogin`，会打到一个不受 CF Access 保护的数据平面 host，`accessEmail` 为空直接 400。现在默认 `loginUrl=https://surety.hexly.ai`，可用 `--login-url` 或 `SURETY_LOGIN_URL` 覆盖。

### Phase 4: 业务命令 ✅

- [x] 4a: shared CRUD infrastructure (`lib/client.ts` / `lib/json-input.ts` / `lib/crud.ts`)
- [x] 4b: `members` + `insurers` + `assets` + `hospitals` + `doctors` + `medical-visits`（`defineCrudCommand` 工厂）
- [x] 4c: `policies` 主 CRUD + `payments` (ls/add/update/rm/generate) + `beneficiaries` (ls) + `coverage-items` (CRUD) + `attachments` (ls/get/rm)
- [x] 4d: `coverage` + `renewals` + `dashboard`

### Phase 5: 文档 + 发布（待办）

决策点：当前 bin 指向 `src/index.ts` 依赖 Bun。要上 npm 有两条路：
- A: 保持现状，README 明示"需要 Bun"，不跨运行时
- B: 加 `tsc` build 产出 `dist/index.js`（shebang `#!/usr/bin/env node`），并确保 cli-base 在 Node 下可运行

- [ ] 选择 A 或 B（决定后更新 package.json 的 bin/files/scripts）
- [ ] `apps/cli/README.md`：安装、登录、完整命令清单、AI 使用示例
- [ ] 根 `README.md`：CLI 章节
- [ ] `CLAUDE.md`：同步 CLI 工作流
- [ ] `npm publish --access public`（`@nocoo/surety@0.1.0`）
- [ ] Git tag `cli-v0.1.0`

## 验证清单（每 Phase）

- `bun install`（workspaces 无 broken 引用）
- `bun run typecheck`（含 `apps/cli`）
- `bun run lint`
- `bun test`（含 `apps/cli/__tests__`）

## 已知后端缺口（CLI 无法在不扩 Worker 的前提下补齐）

| 能力 | 当前状态 | 补齐路径 |
|------|----------|----------|
| beneficiaries 批量替换 / 增删 | 无 | Worker 加 POST（或 PUT/DELETE）后再扩 CLI |
| attachments 上传 | Worker 有 POST multipart，CLI 无 | CLI 加 `attachments add <policyId> <file>`，multipart 封装 |
| policies 嵌套读取（一次拿全） | GET 主资源扁平 | 两选一：Worker 加 `?include=payments,beneficiaries,...`；或 CLI 加聚合命令 `policies show <id>` 串行调子端点 |

## 用户视角（AI / 脚本）

```bash
# 本地 bun 直接跑
bun run apps/cli/src/index.ts login
bun run apps/cli/src/index.ts members ls
# [{"id":1,"name":"...","relation":"Self"}, ...]

bun run apps/cli/src/index.ts policies get 3 --full
# 扁平 policy 对象；嵌套资源用子命令单独拉

bun run apps/cli/src/index.ts policies payments ls 3
```

（发布到 npm 后替换为 `surety login` / `surety members ls`。）

## 与前一版规划的差异

1. ~~MCP 删除在 Phase 5~~ → **提前到 Phase 2**，已完成
2. ~~cash-values 独立命令组~~ → **删除**（MCP 里本身是 stub）
3. ~~beneficiaries `set`~~ → **删除**（Worker 无 POST；CLI 当前只 `ls`）
4. ~~`policies get --full` 含嵌套~~ → **改为"扁平主资源，子资源走子命令"**，与 Worker 实际响应对齐
5. ~~attachments `download`~~ → 当前实现为 `ls/get/rm`，下载走 Web UI；上传同理
6. ~~package.json 样例含 dist/build~~ → 实际 bin 直指 src/index.ts，Phase 5 再决定是否加 build
