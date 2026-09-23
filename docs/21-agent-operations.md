# Agent data and operations details

Detailed project constraints and procedures. The root [AGENTS.md](../AGENTS.md) defines the quality contract and records current enforcement gaps.

## Worker and data operations

Worker 源码在 `apps/worker/`，部署到 Cloudflare Workers。单 Worker 同时托管 Hono API (`/api/*`) 和 Vite 构建出来的 SPA 静态资源（`ASSETS` binding，SPA fallback）。

### 基础信息

| 项目 | 值 |
|------|------|
| Worker 名称 | `surety` |
| Worker URL | `https://surety.<your-account>.workers.dev` |
| Custom Domain (UI) | `https://surety.hexly.ai` (CF Access 保护) |
| Custom Domain (API) | `https://surety-api.hexly.ai` (Bearer token) |
| D1 Database | `surety-db` (`<your-database-id>`) |
| Liveness | `GET /api/live` (no auth, no cache, 返回 version + D1 状态) |

### 部署命令

```bash
bun run build                         # 从仓库根目录构建 SPA
bun run --cwd apps/worker deploy       # 仅在授权部署时执行
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
cd apps/worker && bunx wrangler d1 execute surety-db --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table'"
```

### 数据导入

⚠️ `.dump` 的 INSERT 无列名，本地 SQLite 和 D1 (Drizzle push) 列顺序不同，必须生成带显式列名的 INSERT 语句。

```bash
# 生成带列名的 INSERT（用 python3 脚本，不能直接用 sqlite3 .dump）
# 执行到 D1
cd apps/worker && bunx wrangler d1 execute surety-db --remote --file=<sql_file>
```

### Auth 配置

- 浏览器走 CF Access（在 CF Dashboard 配置 Google OAuth → 绑定到 surety domain）。Worker 中 `accessAuth` 中间件用 CF JWKS 校验 `Cf-Access-Jwt-Assertion`。
- CLI / 脚本走 Bearer token（`api_tokens` 表），`apiKeyAuth` 中间件校验。
- `/api/live` 公开；当前本地认证快捷路径同时检查 Host 和 `request.cf`，完整验证请使用隔离 runner。

### 本地开发环境变量

本地入口域名（Caddy → `:7012`）：**`https://surety.dev.hexly.ai`**（不要用 `localhost:7012` 当日常入口）。

`.env`（用于 Vite dev proxy，根目录）：
```
# 三域分离 — 勿混用
# APP:   https://surety.dev.hexly.ai   本地 SPA（Caddy）
# AUTH:  https://surety.hexly.ai       CF Access + CLI 铸 token
# API:   https://surety-api.hexly.ai   Bearer 数据面（prod Worker）

SURETY_API_URL=https://surety-api.hexly.ai   # 或本地 Worker http://localhost:7016
SURETY_LOGIN_URL=https://surety.hexly.ai     # 仅 CF Access 域；禁止写成 *.dev.hexly.ai
SURETY_DEV_API_TOKEN=sk_xxx                  # 从 /api/auth/cli 流程铸造
```


## CLI

AI/脚本入口，通过 Bearer token 访问 Worker HTTP API，已替代原 MCP Server。源码 `apps/cli/`，Bun-only（`bin` 指向 `src/index.ts`，无 build 步骤）。

| 任务 | 命令 |
|------|------|
| 本地调试 | `cd apps/cli && bun src/index.ts <cmd>` |
| 跑测试 | `bun run test`（根目录 vitest，覆盖 CLI） |
| 类型检查 | `cd apps/cli && bun run typecheck` |
| 全局安装 | `bun add -g @nocoo/surety` |

认证域名模型（易错点）：
- `loginUrl`（默认 `https://surety.hexly.ai`）= CF Access 保护的铸 token 入口，`surety login` 必须打在这个域。
- `apiUrl`（默认 `https://surety-api.hexly.ai`）= 数据面，纯 Bearer token。
- 两者配置/env 完全独立（`SURETY_LOGIN_URL` vs `SURETY_API_URL`）。改动 login 流时务必保持分离。

完整命令清单和输出契约见 [apps/cli/README.md](../apps/cli/README.md)。


## Versions

Root `package.json` is the release version authority. Use `scripts/release.ts` for version/changelog/lockfile/commit/tag/release behavior. Old Next.js route paths are obsolete; current `/api/live` reads the shared version export. Inspect lockfile changes after an install so local mirror URLs never leak into published release inputs.
