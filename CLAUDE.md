# Surety

家庭保单管理工具。极简、本地化、隐私安全。

## 目标用户

40岁软件开发者，上有老下有小，关注家庭风险管理。

## 技术栈

| 组件 | 选型 |
|------|------|
| Runtime | Bun |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (严格模式) |
| Database | SQLite + Drizzle ORM |
| UI | Tailwind CSS + shadcn/ui |
| Deployment | Localhost:7015 |

## 四层测试框架

| 层级 | 工具 | 触发时机 | 要求 |
|------|------|----------|------|
| UT | bun test | pre-commit | 覆盖率 90%+ |
| Lint | eslint | pre-commit | 零错误零警告 |
| API E2E | bun run test:e2e | pre-push | 100% API 覆盖 (port 7016) |
| UI E2E | bun run test:e2e:ui | 按需执行 | Playwright + Chromium (port 7017) |

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
- **SQLite 路径必须用绝对路径**：SQLite 的相对路径基于 `process.cwd()` 而非源码位置。MCP Server 或其他外部进程从不同目录启动时，会在错误位置创建空数据库文件。解决方案：用 `import.meta.url` 推导项目根目录，拼接绝对路径。同时 `createDatabase()` 应自动调用 `initSchema()`（`CREATE TABLE IF NOT EXISTS` 幂等），防止空数据库无表。
- **测试不得删除 git-tracked 数据文件**：`database/surety.example.db` 是包含演示数据的 git-tracked 文件。单元测试中 `cleanupDbFile()` 会 `unlinkSync` 删除文件，若对 example db 执行则会清空全部演示数据。测试连接 example db 后只需 `closeDb()`，不可 cleanup。已添加 guard test 验证 example db 至少有 5 条 members 数据，防止此类 regression。同理，commit 时若 `git status` 显示 binary db 文件有变更，必须验证内容未被意外清空再 add。
- **createDatabase() 必须有 test-env guard**：`createDatabase()` 在 test 环境（`NODE_ENV=test` 或 `BUN_ENV=test`）下会拒绝打开 `database/surety.db` 和 `database/surety.example.db`，抛出 `BLOCKED` 错误。这是防止测试代码意外操作生产/演示数据的最后一道防线。测试中需要真实文件数据时，用 `bun:sqlite` 直接读取（绕过 guard），或使用 `database/surety.e2e.db`（临时文件）。`database/surety.test.db` 是 `database/surety.example.db` 的 git-tracked 副本，作为测试 fixture 使用。
- **生产数据库被假数据覆盖的根因与防护**：`bun run db:seed`（scripts/seed.ts）在未设置 `SURETY_DB` 时默认连接 `database/surety.db`，调用 `resetTestDb()` 清空所有数据后插入假数据，导致生产数据丢失。此问题已发生两次。修复措施：(1) `resetTestDb()` 和 `resetE2EDb()` 加入 PROTECTED_FILES guard，拒绝操作 `database/surety.db` 和 `database/surety.example.db`；(2) `scripts/seed.ts` 强制要求设置 `SURETY_DB` 且不能指向受保护数据库；(3) `scripts/import-csv.ts` 默认拒绝操作受保护数据库，需 `--confirm` 或设置 `SURETY_DB` 指向安全目标；(4) `drizzle.config.ts` 支持 `SURETY_DB` 环境变量切换。另外注意：替换 `.db` 文件后必须删除残留的 `-wal` 和 `-shm` 文件，否则 SQLite 会叠加旧 WAL 数据导致看到脏数据。所有数据库文件统一存放在 `database/` 目录下。
- **2FA 实现的三方 Review 经验**：实现 TOTP 2FA 后，让三个独立 AI Agent (Claude Code / Codex / Gemini) 并行 Review 发现了两个 Critical 级漏洞：(1) NextAuth JWT callback 的 `trigger === "update"` 无条件设置 `twoFactorVerified=true`，浏览器控制台调 `updateSession({})` 即可绕过 2FA；(2) proxy matcher 排除了 `/api/*`，业务 API 对未验证 2FA 的用户完全开放。教训：2FA 这类安全功能，加密层正确不代表状态管理正确。**状态转换必须有服务端凭证（signed nonce），执行层（proxy/API）必须全覆盖**。三方 Review 能有效交叉发现盲区 — 三方共识的问题最可靠，单方发现的问题需要独立验证。
- **Settings KV 表存储敏感数据的防护**：通用 Settings API (`/api/settings`, `/api/settings/[key]`) 暴露了 `totp.*` 前缀的加密密文和哈希，且无 auth 检查可被直接写入 `totp.enabled=false` 来关闭 2FA。教训：KV 表存储敏感数据时，通用 CRUD API 必须过滤/拒绝敏感 key 前缀。
- **安全模块重构的接口隔离策略**：将 TOTP 从单文件重构为独立模块时，关键设计决策是 `TotpStore` 接口（get/set/delete）作为唯一外部依赖。这使得 73 个测试全部使用内存 Map 运行，无需数据库、无需 env、无需 mock 框架。教训：安全模块的可测试性直接决定其可信度。纯函数 + 接口注入 = 测试覆盖率 100% 几乎零成本。
- **HMAC 密钥必须独立于 Auth 密钥**：原实现复用 `NEXTAUTH_SECRET` 作为 TOTP cookie/nonce 的 HMAC 密钥，导致模块与 NextAuth 产生隐性耦合。重构后引入独立的 `TOTP_HMAC_SECRET`，并保留 fallback 以兼容迁移。教训：密钥分离不仅是安全最佳实践，也是模块化的前提条件 — 共享密钥 = 共享耦合。
- **适配器模式解耦 re-export**：重构后 `src/lib/totp.ts` 变为纯适配器（读 env + 绑 store + re-export），所有消费者的 import 路径 `@/lib/totp` 不变。这避免了全项目大规模 import 路径变更。教训：大规模重构时，保持现有 import 路径稳定可以把变更范围控制在最小，降低引入 regression 的风险。