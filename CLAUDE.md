# Surety

家庭保单管理工具。极简、Self-host、隐私安全。

## 目标用户

40岁软件开发者，上有老下有小，关注家庭风险管理。

## 技术栈

| 组件 | 选型 |
|------|------|
| Runtime | Bun |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (严格模式) |
| Database | Cloudflare D1 (via Worker proxy) + Drizzle ORM |
| UI | Tailwind CSS + shadcn/ui |
| Deployment | Railway (Next.js) + Cloudflare Workers (D1 proxy) |

### 数据库架构

- **运行时（生产/E2E）**：Next.js → sqlite-proxy → Cloudflare Worker → D1 binding
- **单元测试**：bun:sqlite `:memory:` (无网络)
- **E2E 测试**：远程 D1 test 数据库 (`surety-db-test`，Worker binding `DB_TEST`，`SURETY_TARGET_DB=test`)
- **管理面**：drizzle-kit + d1-http driver (开发时 schema push)
- **Repo 模式**：Factory pattern `createMembersRepo(db)` — request-scoped DB 注入
- **无本地 SQLite 运行时**：所有非测试路径都走远程 D1

## 四层测试框架

| 层级 | 工具 | 触发时机 | 要求 |
|------|------|----------|------|
| UT | bun test | pre-commit | 覆盖率 90%+ |
| Lint | eslint | pre-commit | 零错误零警告 |
| Typecheck | tsc --noEmit | pre-commit | 零类型错误 |
| API E2E | bun run test:e2e | pre-push | 100% API 覆盖 (port 7016) |
| UI E2E | bun run test:e2e:ui | 按需执行 | Playwright + Chromium (port 7017) |

### E2E 隔离约束

所有 E2E suite（API、UI、MCP）共用一个远程 D1 test 数据库 (`surety-db-test`)。每个 runner 启动时执行 `seed-remote.ts` 清空并重新 seed，因此 **E2E suite 不可并行运行**。串行执行即可保证数据隔离。

### 测试文件自动发现

`bunfig.toml` 配置 `pathIgnorePatterns` 排除 E2E 文件（`**/e2e/**` 和 `**/*.e2e.test.ts`），单元测试通过 glob 自动发现。新增测试文件无需手动维护列表。E2E runner 通过 `--path-ignore-patterns __none__` 覆盖 bunfig 配置。

### 核心原则

1. **尽早发现** — 不积累技术债
2. **自主解决** — 不依赖人工 review 发现低级错误
3. **质量门禁** — 问题代码无法进入主分支

## 常用命令

```bash
bun dev              # 开发服务器 (7015)
bun run build        # 生产构建
bun test             # 单元测试 (含 MCP)
bun test --coverage  # 测试覆盖率
bun run test:mcp     # MCP 单元测试
bun run test:mcp:e2e # MCP E2E 测试
bun run test:e2e     # API E2E 测试 (port 7016)
bun run test:e2e:ui  # Playwright 浏览器 E2E 测试 (port 7017)
bun run lint         # ESLint
bun run db:push      # 推送 schema
bun run db:studio    # 数据库可视化
bun run mcp          # 启动 MCP Server (stdio)
```

## Worker Deployment (D1 Proxy)

Worker 源码在 `worker/` 目录，部署到 Cloudflare Workers，作为 Next.js → D1 的中间代理。

### 基础信息

| 项目 | 值 |
|------|------|
| Worker 名称 | `surety` |
| Worker URL | `https://surety.<your-account>.workers.dev` |
| Custom Domain | `<your-custom-domain>` |
| D1 Database | `surety-db` (`<your-database-id>`) |
| Liveness | `GET /api/live` (no auth, no cache, 返回 version + D1 状态) |

### 部署命令

```bash
cd worker && bun install          # 安装依赖
cd worker && bunx wrangler deploy # 部署 Worker
```

### Schema 推送 (D1)

通过 `drizzle-kit push` + D1 HTTP driver 直接推（不经过 Worker）：

```bash
CLOUDFLARE_ACCOUNT_ID=<account_id> \
CLOUDFLARE_DATABASE_ID=<database_id> \
CLOUDFLARE_D1_TOKEN=<token> \
bunx drizzle-kit push
```

验证表结构：
```bash
cd worker && bunx wrangler d1 execute surety-db --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table'"
```

### 数据导入

⚠️ `.dump` 的 INSERT 无列名，本地 SQLite 和 D1 (Drizzle push) 列顺序不同，必须生成带显式列名的 INSERT 语句。

```bash
# 生成带列名的 INSERT（用 python3 脚本，不能直接用 sqlite3 .dump）
# 执行到 D1
cd worker && bunx wrangler d1 execute surety-db --remote --file=<sql_file>
```

### Secret 管理

```bash
# 设置 Worker 共享密钥
echo "<secret>" | cd worker && bunx wrangler secret put WORKER_SHARED_SECRET
```

### 环境变量 (Next.js 侧)

`.env` 中需要配置：
```
SURETY_WORKER_URL=<your-worker-url>
SURETY_WORKER_SECRET=<worker_shared_secret>
```

`src/db/index.ts` 在非测试环境下必须配置这两个变量，否则 `getDbForRequest()` 会抛出错误。所有非测试路径都走远程 D1，无本地 SQLite 运行时 fallback。

E2E 测试额外需要：
```
SURETY_TARGET_DB=test       # 指向 D1 test 数据库 (surety-db-test)
E2E_SKIP_AUTH=true          # 跳过认证（E2E runner 自动设置）
```

安全机制：当 `E2E_SKIP_AUTH=true` 时，`resolveTargetDb()` 强制要求设置 `SURETY_TARGET_DB`，防止 E2E 意外连接 production D1。

## Version Release Checklist

1. Read current version from `package.json`, apply the requested bump (default: patch)
2. Update **all version references** per this checklist:

   | File | What to update |
   |------|---------------|
   | `package.json` | `"version"` field |
   | `src/app/api/live/route.ts` | fallback via `APP_VERSION` (auto, no manual change needed) |
   | `src/services/backy.ts` | fallback via `APP_VERSION` (auto, no manual change needed) |
   | `mcp/index.ts` | MCP server version via `APP_VERSION` (auto, no manual change needed) |
   | `src/__tests__/version.test.ts` | reads from package.json (auto, no manual change needed) |

3. Commit: `chore: bump version to x.y.z`
4. Push (triggers deployment)
5. Create annotated tag: `git tag -a vx.y.z -m "vx.y.z"`
6. Push tags: `git push --tags`

Verification: `rg '旧版本号' --glob '*.ts' --glob '*.tsx'` to catch stragglers.

## Retrospective

- **主动维护文档结构**：docs 目录下文件使用编号命名（如 `01-xxx.md`、`02-xxx.md`），便于阅读顺序；同时在根目录 README.md 中维护项目结构树，保持文档与代码同步更新。
- **2FA 实现的三方 Review 经验**：实现 TOTP 2FA 后，让三个独立 AI Agent (Claude Code / Codex / Gemini) 并行 Review 发现了两个 Critical 级漏洞：(1) NextAuth JWT callback 的 `trigger === "update"` 无条件设置 `twoFactorVerified=true`，浏览器控制台调 `updateSession({})` 即可绕过 2FA；(2) proxy matcher 排除了 `/api/*`，业务 API 对未验证 2FA 的用户完全开放。教训：2FA 这类安全功能，加密层正确不代表状态管理正确。**状态转换必须有服务端凭证（signed nonce），执行层（proxy/API）必须全覆盖**。三方 Review 能有效交叉发现盲区 — 三方共识的问题最可靠，单方发现的问题需要独立验证。
- **Settings KV 表存储敏感数据的防护**：通用 Settings API (`/api/settings`, `/api/settings/[key]`) 暴露了 `totp.*` 前缀的加密密文和哈希，且无 auth 检查可被直接写入 `totp.enabled=false` 来关闭 2FA。教训：KV 表存储敏感数据时，通用 CRUD API 必须过滤/拒绝敏感 key 前缀。
- **安全模块重构的接口隔离策略**：将 TOTP 从单文件重构为独立模块时，关键设计决策是 `TotpStore` 接口（get/set/delete）作为唯一外部依赖。这使得 73 个测试全部使用内存 Map 运行，无需数据库、无需 env、无需 mock 框架。教训：安全模块的可测试性直接决定其可信度。纯函数 + 接口注入 = 测试覆盖率 100% 几乎零成本。
- **HMAC 密钥必须独立于 Auth 密钥**：原实现复用 `NEXTAUTH_SECRET` 作为 TOTP cookie/nonce 的 HMAC 密钥，导致模块与 NextAuth 产生隐性耦合。重构后引入独立的 `TOTP_HMAC_SECRET`，并保留 fallback 以兼容迁移。教训：密钥分离不仅是安全最佳实践，也是模块化的前提条件 — 共享密钥 = 共享耦合。
- **适配器模式解耦 re-export**：重构后 `src/lib/totp.ts` 变为纯适配器（读 env + 绑 store + re-export），所有消费者的 import 路径 `@/lib/totp` 不变。这避免了全项目大规模 import 路径变更。教训：大规模重构时，保持现有 import 路径稳定可以把变更范围控制在最小，降低引入 regression 的风险。
- **重构后必须同步更新测试入口**：将 `totp.test.ts` 替换为 `totp-module.test.ts` 后，忘记同步更新 `package.json` 的 `test` script 和 `scripts/check-coverage.ts`，导致默认测试命令和 pre-commit hook 都不再覆盖任何 2FA 测试。教训：删除/重命名测试文件时，必须 grep 所有引用该文件名的地方（`package.json`, 覆盖率脚本, CI 配置），否则安全关键路径会静默脱离 CI 保护。
- **Recovery code 是 break-glass 凭证，不应签发持久信任**：Recovery code 验证成功后默认签发 30 天 trusted-device cookie，等于把"一次性应急登录"升级为"持续免 2FA 设备授权"。如果 recovery code 泄漏，攻击者不仅能完成一次登录，还能在该浏览器上拿到 30 天免验证状态。教训：不同安全等级的认证方式（TOTP vs recovery）应有不同的授权后果。break-glass 凭证只应授予最小必要权限（完成本次登录），不应签发长期信任。
- **Proxy 与 Session 的状态语义必须显式区分**：trusted-device cookie 只在 proxy 层校验放行，但不回写到 JWT session。导致 `session.user.twoFactorVerified` 始终为 `false`，与 proxy 的实际放行决策不一致。修复方案不是强制同步（NextAuth JWT callback 拿不到 request cookie），而是**显式定义语义模型**：`twoFactorVerified` = 显式 nonce 提升；trusted cookie = 请求级豁免；effective 2FA = 两者之一满足。Proxy 是唯一的访问控制执行点。教训：当两个状态源（session vs cookie）不可能完美同步时，与其补一个重桥，不如明确语义边界，让每个状态只表达它能可靠表达的含义。
- **Bun 特有 API 不可在 Next.js Server Runtime 使用**：`Bun.password.hash/verify` 是 Bun 独有 API，Next.js 的 server runtime 使用 Node.js 兼容层，`Bun` 全局对象不存在。此问题在开发阶段因 `bun dev` 运行正常而被掩盖，部署后在 API route 中触发 `ReferenceError`。解决方案：使用 `node:crypto` 的 `scrypt` + `timingSafeEqual` 替代。教训：在 Bun + Next.js 技术栈中，API route / middleware 代码必须只使用 Node.js 标准 API，Bun 特有 API 仅限构建脚本和独立进程使用。
- **安全关键操作必须原子化写入**：`verifySetup()` 原实现先写 `enabled=true` 到 DB，再计算 `recoveryCodeHash`。当 hash 函数抛出异常时（如 `Bun.password` 不可用），DB 处于半启用状态（`totp.enabled=true` 但无 `recoveryCodeHash`），导致 2FA 既无法使用也无法正常关闭。修复方案：先计算所有派生值，全部成功后再批量写入 DB。教训：涉及多个状态字段的安全操作，必须 **compute all → write all**，而非交替计算和写入。任何中间步骤的异常都不应留下不一致的状态。
- **JWT 与 DB 的 2FA 状态脱同步会造成死锁**：用户在 Settings 中关闭 2FA 后，DB 中 `totp.*` 已被删除，但当前 session 的 JWT `twoFactorVerified` 仍为 `false`（JWT 只在签发时写入，无法被后续操作修改）。Proxy 看到 `twoFactorVerified=false` → 重定向到 `/verify-2fa` → API 返回"2FA 未启用" → 用户卡死。修复方案：Proxy 在 `twoFactorVerified=false` 时额外查询 DB 中 2FA 是否仍然启用（`twoFactorEnabled`），若 DB 显示已关闭则直接放行。教训：JWT 是签发时快照，任何可被用户主动变更的状态（如 2FA 开关），仅靠 JWT 做访问控制会产生 stale state 问题。Proxy 作为唯一执行点，必须有能力查询权威数据源（DB）来解决 JWT 与现实的偏差。
- **安全授权必须 session-scoped，不能用全局持久标记**：`forceDisable()` 原实现检查 DB 中 `recoveryCodeUsed` 全局标记。一旦任何 session 使用了 recovery code，该标记永久为 true，导致所有后续 session（包括正常 TOTP 登录的 session）都能跳过验证直接禁用 2FA。修复方案：将 `recoverySession` 作为 JWT claim，只在 recovery code 验证成功时写入当前 session 的 token。API 层检查 `session.user.recoverySession`，服务层 `forceDisable()` 变为无条件执行（caller 负责授权）。教训：安全关键的授权判断应基于 session-scoped 凭证（JWT claim），而非全局持久状态（DB flag）。全局标记会跨 session 泄漏权限。
- **Setup 阶段不应自动签发 trusted-device cookie**：`verify-setup` 路由在 2FA 首次启用时无条件签发 30 天 trusted-device cookie，用户从未被询问是否信任此设备。nonce-based JWT promotion 已经解决了"启用后立即需要验证"的问题。cookie 应仅在登录验证时由用户主动勾选"信任此设备"后签发。教训：信任授予（trust grant）必须有明确的用户意图（explicit consent），不能作为附带效果（side effect）自动发生。
- **一次性权限 JWT claim 必须有显式撤销点**：`recoverySession` JWT claim 原实现只在 recovery code 登录时设为 `true`，但没有任何代码路径将其清回 `false`。导致同一会话中 forceDisable → re-setup 2FA 后，旧 `recoverySession=true` 仍然有效，可以无验证码再次 forceDisable 新启用的 2FA。修复方案：(1) nonce-based session promotion 路径中，`recoverySession` 始终从 `sessionUpdate` 同步（不传即清）；(2) forceDisable 成功后返回 `clearRecoverySession` 信号，客户端调用 `updateSession({ clearRecoverySession: true })` 显式撤销。教训：JWT claim 作为一次性权限凭证时，必须在权限行使后和状态变更后有**显式撤销点**。"只设不清"的 sticky claim 会在同一会话内积累越权风险。
- **SQLite .dump 导入 D1 必须带显式列名**：`sqlite3 .dump` 生成的 `INSERT INTO table VALUES(...)` 不含列名，按源库的列顺序排列。但 `drizzle-kit push` 创建的 D1 表列顺序由 schema.ts 定义顺序决定，与历史 SQLite 的列顺序不同。直接导入会导致值错位，触发 NOT NULL constraint 或数据写入错误列。解决方案：用脚本生成 `INSERT INTO table (col1, col2, ...) VALUES(...)` 格式。教训：跨数据库迁移数据时，永远不要依赖隐式列顺序。
- **sqlite-proxy "get" 方法的行映射陷阱**：Drizzle sqlite-proxy 的 callback 返回 `{ rows }` 时，`method === "get"` 期望 `rows` 是单个扁平行 `[1, "张伟", ...]`，而 `method === "all"` 期望行数组 `[[1, ...], [2, ...]]`。原实现用 `rows.slice(0,1)` 处理 "get"，但这返回 `[[1, "张伟", ...]]`（仍是数组包数组），导致 `.returning().get()` 返回 `id` 时得到整行数组而非标量值。修复：`method === "get" ? rows[0] : rows`。教训：sqlite-proxy 的 callback 返回格式文档不充分，必须读 `drizzle-orm/sqlite-proxy/session.cjs` 中的 `mapGetResult` 源码确认期望格式。
- **移除本地 SQLite 运行时的分阶段策略**：8 个原子 commit 从安全 guard → D1 dev 创建 → seed 脚本 → E2E 迁移 → UI 删除 → health check 异步化 → 本地代码删除 → 清理。关键决策：(1) 先加 E2E safety guard（Phase 1）防止迁移过程中 E2E 意外连 production；(2) E2E 全部走远程 D1 dev 而非本地文件，统一数据路径；(3) UT 保持 `bun:sqlite :memory:` 零改动（481+ test）。教训：大规模基础设施迁移必须先部署防护网再拆旧路径，每个 commit 独立可验证。