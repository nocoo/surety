# 16. CLI 替换 MCP（@nocoo/surety）

Status: Planned (2026-04-22)

## 背景

目前 `packages/mcp` 是面向 LLM 的 MCP server，通过 stdio 提供 12 个工具集 (≈2.3k 行) 调用 Worker API。问题：

- **安装路径重**：需要 `mcpServers` 配置 + 本地 clone 源码 + `bun run packages/mcp/src/index.ts`。
- **传播不友好**：MCP 只能被支持 MCP 的 AI 客户端消费，无法直接给人/脚本用。
- **设置页开关冗余**：`mcp.enabled` + 路径复制卡片，需要用户手动拼 JSON。

目标：用可全局安装的 **`@nocoo/surety` CLI** 完整替换 MCP，保留所有功能（同样调 `surety-api.hexly.ai`），对 AI 用户输出 JSON，对人用户输出人类可读摘要。

## 原则

- **薄壳**：CLI 只做 (参数解析 + API 调用 + 输出格式化)，业务逻辑仍在 Worker / `@surety/api`。
- **与 `@nocoo/cli-base` 生态对齐**：复用 `performLogin` loopback、`ConfigManager`、`citty`、`createUpdateCommand`。
- **发布友好**：`npm install -g @nocoo/surety`，内部不依赖 monorepo 其他包（source-of-truth 的 fetch 调用独立写，不 import `@surety/*`）。
- **AI 友好**：默认 JSON，默认摘要（节约 context）；`--full` 返回完整数据；`--no-color` 等细节自动处理。

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
│   │       ├── output.ts              # json-only，summary vs full
│   │       ├── auth.ts                # login/logout/whoami 3 命令
│   │       └── commands/
│   │           ├── members.ts         # ls/get/add/update/rm
│   │           ├── policies.ts        # ls/get/add/update/rm (+ 子资源)
│   │           ├── assets.ts
│   │           ├── insurers.ts
│   │           ├── beneficiaries.ts
│   │           ├── payments.ts
│   │           ├── cash-values.ts
│   │           ├── coverage.ts
│   │           ├── coverage-items.ts
│   │           ├── hospitals.ts
│   │           ├── doctors.ts
│   │           └── medical-visits.ts
│   ├── web/                           # 修改：删 MCP 设置卡片
│   └── worker/                        # 修改：删 mcp.enabled 逻辑 + 兼容 base-cli 回调参数
├── packages/
│   ├── api/
│   ├── db/
│   └── mcp/                           # 🔥 完全删除（+ 相关 test:mcp 脚本、workspaces 引用）
└── docs/
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

注意：**不依赖** `@surety/api` / `@surety/db` / zod 等 monorepo 内包，保证能独立发布到 npm。参数校验走 Worker 侧（CLI 只做结构化入参传输）。

## Worker 侧调整

### 1. `/api/auth/cli` 接受 `callback`（cli-base 默认）与 `callback_url`（已有）

```typescript
const callbackUrl = c.req.query("callback") ?? c.req.query("callback_url");
```

保持向后兼容。

### 2. 删除 `mcp.enabled` 设置

- 移除 `apps/worker/src/routes/settings.ts` 中对 `mcp.enabled` 的特殊处理（如果有；目前查阅显示只是通用 settings）
- 不需要删 DB 行（settings 表是 KV，遗留行无害，可忽略）

### 3. `packages/mcp` 整包删除

- 删除目录
- 根 `package.json`：workspaces 移除 `packages/mcp`，scripts 删 `test:mcp`、`test:mcp:e2e`、`mcp`
- 根 `tsconfig.base.json` references 清理
- `CLAUDE.md` 项目树更新
- `README.md` MCP 小节替换为 CLI 小节

## CLI 命令设计

### 顶层

```
surety login        # 浏览器 loopback auth
surety logout       # 清 config
surety whoami       # 显示 email + apiUrl

surety <entity> <action> [args] [flags]

# flags:
  --full            # 返回完整数据（默认摘要模式）
  --api-url <url>   # 覆盖 apiUrl（默认 https://surety-api.hexly.ai）
  --token <token>   # 覆盖 token（默认读 config）
```

### 实体 × 动作矩阵

| 实体 | ls | get | add | update | rm | 子资源/特殊 |
|------|----|-----|-----|--------|-----|------------|
| members | ✅ | ✅ | ✅ | ✅ | ✅ | |
| policies | ✅ | ✅ | ✅ | ✅ | ✅ | `--include payments,coverage,beneficiaries` |
| assets | ✅ | ✅ | ✅ | ✅ | ✅ | |
| insurers | ✅ | ✅ | ✅ | ✅ | ✅ | |
| hospitals | ✅ | ✅ | ✅ | ✅ | ✅ | |
| doctors | ✅ | ✅ | ✅ | ✅ | ✅ | |
| medical-visits | ✅ | ✅ | ✅ | ✅ | ✅ | |
| beneficiaries | ✅ | ✅ | ✅ | ✅ | ✅ | `--policy-id <n>` 必填 |
| payments | ✅ | ✅ | ✅ | ✅ | ✅ | `--policy-id <n>` 必填 |
| cash-values | ✅ | ✅ | ✅ | ✅ | ✅ | `--policy-id <n>` 必填 |
| coverage | ✅ | ✅ | ✅ | ✅ | ✅ | `--policy-id <n>` 必填 |
| coverage-items | ✅ | ✅ | ✅ | ✅ | ✅ | `--coverage-id <n>` 必填 |

对应 MCP 工具 12 个实体 → CLI 12 个子命令组，每组 ~5 个动作。

### 输出策略

- **始终 JSON**（stdout），便于 LLM 消费。
- **摘要模式（默认）**：只返回核心字段，节约 token：
  - `members ls` → `[{id, name, relation}]`
  - `policies ls` → `[{id, number, insurer, member}]`
  - `members get 5` → 返回完整成员，但不包含嵌套 policies（用 `--full`）
- **Full 模式（`--full`）**：返回 Worker API 的原样响应。
- 错误：写 stderr 为 `{error: "..."}` JSON，退出码 1。
- 成功：写 stdout，退出码 0。

### `surety login` 流程

1. `performLogin({ apiUrl: "https://surety.hexly.ai", loginPath: "/api/auth/cli", tokenParam: "api_key" })`
2. loopback server 接收 `/callback?api_key=sk_...&state=...&email=...`
3. 写 `~/.config/surety/config.json`: `{ apiUrl: "https://surety-api.hexly.ai", token, email }`
   - 注意 auth 用 `surety.hexly.ai`（CF Access 保护），数据操作走 `surety-api.hexly.ai`（纯 Bearer）。
4. 输出 `{ "ok": true, "email": "zheng@hexly.ai" }`。

### Config

`~/.config/surety/config.json`（0600）：

```json
{
  "apiUrl": "https://surety-api.hexly.ai",
  "token": "sk_...",
  "email": "zheng@hexly.ai"
}
```

支持 `~/.config/surety/config.dev.json`（`SURETY_ENV=dev`），便于 test 环境调试。

## 分阶段执行（原子化提交）

### Phase 0: 规划文档
- [x] 16-cli-replace-mcp.md（本文档）

Commit: `docs: plan CLI replacement for MCP`

### Phase 1: Worker 兼容 + 脚手架
- [ ] Worker `/api/auth/cli` 接受 `callback` 作为 `callback_url` 的别名，测试
- [ ] 创建 `apps/cli/` 骨架：`package.json` + `tsconfig.json` + `src/index.ts` (空 citty)
- [ ] workspace 添加 `apps/cli`
- [ ] `bunx surety --help` 能跑通

Commits:
- `feat(worker): accept ?callback as alias of ?callback_url`
- `feat(cli): scaffold @nocoo/surety citty app`

### Phase 2: Auth 子系统
- [ ] `config.ts`: `ConfigManager<SuretyConfig>`
- [ ] `api.ts`: 从 config 读 token, fetch wrapper
- [ ] `auth.ts`: `login` / `logout` / `whoami`
- [ ] E2E 手动验证：`surety login` → 浏览器 → token 落盘 → `surety whoami` 输出邮箱

Commit: `feat(cli): add login/logout/whoami`

### Phase 3: 业务命令迁移（按实体分 commits，每个 commit 一个实体）
- [ ] `output.ts` summary/full 核心工具
- [ ] `members.ts` + 测试
- [ ] `policies.ts` + 测试（最复杂，含子资源 --include）
- [ ] `assets.ts`
- [ ] `insurers.ts`
- [ ] `hospitals.ts`
- [ ] `doctors.ts`
- [ ] `medical-visits.ts`
- [ ] `beneficiaries.ts`
- [ ] `payments.ts`
- [ ] `cash-values.ts`
- [ ] `coverage.ts`
- [ ] `coverage-items.ts`

每个实体 commit: `feat(cli): add <entity> commands`

### Phase 4: UI + Worker 清理
- [ ] 删 `apps/web/src/app/settings/components/mcp-settings.tsx` 及引用
- [ ] 更新设置页布局
- [ ] 删 Worker `mcp.enabled` 相关代码（如有专门逻辑）

Commit: `refactor(web): remove MCP settings in favor of CLI docs`

### Phase 5: 删除 MCP 包
- [ ] 删 `packages/mcp/` 整个目录
- [ ] 根 `package.json` workspaces 删 `packages/mcp`
- [ ] 根 scripts 删 `test:mcp` / `test:mcp:e2e` / `mcp`
- [ ] `CLAUDE.md` 项目树更新，删除 `packages/mcp` 行
- [ ] `README.md` MCP 小节替换为 CLI 小节
- [ ] `.claude/` hooks 如引用 MCP 一并清理

Commit: `refactor: remove @surety/mcp package`

### Phase 6: 发布准备
- [ ] `apps/cli/README.md`（安装、登录、命令清单、examples）
- [ ] `tsconfig.json` 编译到 `dist/`
- [ ] `npm publish --access public`（`@nocoo/surety`）
- [ ] 项目根 README 增加 `npm install -g @nocoo/surety` 段落

Commit: `chore(cli): publish @nocoo/surety v0.1.0`

## 验证清单

每个 Phase 后：
- [ ] `bun run typecheck` 全 pass
- [ ] `bun run lint` 全 pass
- [ ] `bun test` 全 pass

整体完成后：
- [ ] `surety login` 能完整走通浏览器 OAuth
- [ ] `surety members ls` / `policies ls` 输出正确 JSON
- [ ] `surety members ls --full` 包含完整字段
- [ ] `npm install -g @nocoo/surety` → 全局 `surety` 命令可用
- [ ] 旧 MCP 相关 test/script/doc 零残留（`rg -i 'mcp|McpServer' --glob '!docs/*' --glob '!CHANGELOG.md'` 结果接近空）

## 风险与对策

| 风险 | 对策 |
|------|------|
| CLI publish 后 apiUrl 硬编码 `surety-api.hexly.ai`，其他人 self-host 不能用 | `--api-url` flag + config 存储；README 里写明 self-host 配法 |
| 删除 MCP 后有隐藏的调用链 | `rg mcp` 先全局扫描；保留一个 commit 专职删除便于回滚 |
| `@nocoo/surety` 名字被占用 | 先 `npm view @nocoo/surety` 确认；若被占，降级到 `@surety/cli`（scope 已有） |
| cli-base 的 `callback` 参数 vs 旧 `callback_url` 兼容 | Phase 1 显式做兼容层 |
| MCP E2E 测试 runner 删除后 CI 脚本遗漏 | Phase 5 同时清理 `package.json` 中的 `test:mcp*` 脚本与 CI 配置 |

## 用户视角

```bash
# 一次性安装
bun install -g @nocoo/surety

# 登录
surety login
# → 浏览器弹出 → Google OAuth → 回到终端
# → {"ok": true, "email": "zheng@hexly.ai"}

# 用
surety members ls
# → [{"id":1,"name":"李征","relation":"Self"}, ...]

surety policies get 3 --full
# → 完整 policy 对象含所有字段

# AI 客户端配置（替代原 MCP JSON）
# 直接在 prompt 里告诉 AI：用 `surety` 命令做 X
# 或写入 .claude/commands/ 让 AI 自主调用
```
