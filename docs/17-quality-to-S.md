# 质量体系升级到 S 级

> 对标 [`zhe/docs/05-testing.md`](../../zhe/docs/05-testing.md) 的 6 维测试金字塔（L1/L2/L3/G1/G2/Worker）。
> 起点：surety 当前在 L2 缺失、新代码无覆盖门槛、gitleaks 仅 pre-push 拦截。
> 目标：所有新 app（`apps/web`、`apps/cli`、`apps/worker`）纳入硬门禁，L2 通过 Hono test client 重建。

## 现状对比要点

| 维度 | zhe | surety | 差距 |
|------|-----|--------|------|
| L1 覆盖范围 | 全代码库 | 仅 web_legacy | ❗ 新 apps 在门槛之外 |
| L1 覆盖维度 | 4 维（语句/分支/函数/行） | 1 维（行） | ❗ 缺分支/函数门槛 |
| L2 API E2E | 197 tests，pre-push hard gate | 已断线（指向下线 Worker proxy） | ❗❗❗ 完全缺失 |
| G2 gitleaks | pre-commit + pre-push 双保险 | 仅 pre-push | ❗ commit 无拦截 |
| Lint 严格度 | 5 条 strict 规则 | 仅 max-warnings=0 | ❗ 缺类型严格规则 |

## 原子化执行步骤

### Step 1: gitleaks 移到 pre-commit ✅
- 修改 `apps/web_legacy/scripts/pre-commit.ts`，新增 `gitleaks protect --staged --no-banner` 并行步骤
- Commit: `chore(hooks): run gitleaks at pre-commit for early secret detection`

### Step 2: 覆盖率门槛覆盖所有新 apps ✅
- 改造 `apps/web_legacy/scripts/check-coverage.ts`：合并 `apps/web` / `apps/cli` / `apps/worker` 的覆盖输出
- 输出形式从「单一 line% 阈值」升级为「4 维阈值」
- Commit: `feat(quality): extend coverage gate to web/cli/worker with branch+func thresholds`

### Step 3: 补齐新代码的低覆盖测试 ✅
- 目标：让 `apps/cli` `apps/worker` 行/函数覆盖 ≥ 90%
- 重点：`cli/src/commands/policies.ts`、`cli/src/lib/json-input.ts`、`worker/middleware/access-auth.ts`、`cli/src/lib/client.ts`
- Commit: `test(cli,worker): cover policies subcommands, json-input, access-auth bypass paths`

### Step 4: 通过 Hono test client 重建 L2 ✅
- 新建 `apps/worker/__tests__/e2e/` 目录（用 in-memory D1 stub 跑全链路）
- 覆盖 members / policies / coverage / dashboard / live / auth-tokens 共 6 大模块
- pre-push hook 重新启用：`bun test apps/worker/__tests__/`（包含新 e2e）
- Commit: `feat(worker): add L2 hono e2e suite covering crud + auth boundary`

### Step 5: ESLint strict 规则对齐 ✅
- `eslint.config.ts` 启用 `no-explicit-any` / `no-non-null-assertion` / `no-unnecessary-condition`
- 修复触发的告警
- Commit: `chore(lint): enable typescript-eslint strict rules`

### Step 6: 编写文档 ✅
- 本文档：执行总结
- 更新 CLAUDE.md：测试矩阵从「四层」升级为「六维」
- Commit: `docs(quality): document upgraded six-tier quality system`

## 完成状态

- [x] Step 1 — gitleaks 进入 pre-commit
- [x] Step 2 — 覆盖率门槛扩到 web/cli/worker
- [x] Step 3 — 低覆盖代码补测试
- [x] Step 4 — Hono test client 重建 L2 (`apps/worker/__tests__/e2e/`，23 tests)
- [x] Step 5 — ESLint: 取消 `apps/worker/**` 排除 + 新增 `*.skip`/`*.only` 禁用
- [x] Step 6 — CLAUDE.md 测试矩阵从「四层」升级为「六维」

## 本轮原子化提交

| Commit | 主题 |
|--------|------|
| `chore(hooks): run gitleaks at pre-commit for early secret detection` | Step 1 |
| `feat(quality): extend coverage gate to web/cli/worker with 2-dim threshold` | Step 2 |
| `test(cli,worker): backfill coverage for policies/json-input/client and access-auth jwt branch` | Step 3 |
| `feat(worker): add L2 hono e2e suite covering crud + auth boundary` | Step 4 |
| `chore(lint): apply strict eslint to apps/worker + ban .skip/.only` | Step 5 |
| `docs(quality): document upgraded six-tier quality system` | Step 6 |

## 最终覆盖率快照

```
✅ web_legacy   funcs=89.18%  lines=91.61%
✅ web          funcs=100.00% lines=100.00%
✅ worker       funcs=95.83%  lines=98.89%
✅ cli          funcs=96.88%  lines=98.14%
```

E2E 共 23 tests（members/policies sub-resources/dashboard/coverage-lookup/auth-cli/auth-tokens），通过 Hono test client + bun:sqlite `:memory:` 驱动真实路由。

## 后续清理 (2026-04-22)

CLI 上线 + 生产 smoke 验证后做了一轮 MCP 残留清理（独立于 6 步主线）：

| Commit | 主题 |
|--------|------|
| `chore: drop MCP residue from infra config` | bunfig.toml coverageInclude + osv-scanner.toml unused ignores |
| `chore(web_legacy): remove MCP access settings UI and e2e` | mcp-settings.tsx + settings page/spec/page-object |
| `docs: refresh architecture docs to reflect Vite + Hono + CLI stack` | CLAUDE.md / README.md / CHANGELOG.md / docs 02/11/12 |

## 删除 web_legacy 整目录 (2026-04-22)

继 MCP 清理之后做的第二轮：把 `apps/web_legacy/` 名义上的"过渡保留"彻底拆掉，并把它持有的工程化基础设施提到 repo root。

| Commit | 主题 |
|--------|------|
| `chore: hoist build scripts and drizzle config to repo root` | `apps/web_legacy/scripts/*` → `scripts/`；`drizzle.config.ts` + `drizzle/` 提到 root；husky / `db:push` / `db:studio` 路径同步 |
| `chore: drop legacy Next.js E2E (Playwright) suite` | 删除 `apps/web_legacy/e2e/`、`run-e2e*.ts`、`*.e2e.test.ts`；`test:e2e*` / `test:all` script 一并清理 |
| `chore: delete apps/web_legacy/` | 整目录 + Next.js 全家桶依赖 (`next` / `next-auth` / `eslint-config-next` / `@playwright/test`) 卸掉；root tsconfig `@/*` alias 移除；coverage / L1 / G1a 缓存脚本去掉 web_legacy 源根；ESLint 去 Next 插件链 |
| `docs: prune web_legacy from architecture docs and quality matrix` | README / CLAUDE.md / 本文 / CHANGELOG 同步 |

L3 UI E2E 决定**直接删除而非迁移**：跑的是即将下线的 Next.js 应用，重写到 Vite + Playwright 等同于另一个项目；当前 pre-push 实跑的硬门禁是 worker+cli unit + worker e2e (23 tests) ，L3 不在其中。Vite SPA 端的浏览器验证按需重建。

### 覆盖率快照（清理后）

```
✅ web    funcs=100.00% lines=100.00%
✅ worker funcs=95.83%  lines=98.89%
✅ cli    funcs=96.88%  lines=98.14%
```

## 质量体系第二轮升级 (2026-04-22)

第一轮升到 S 后留了三块短板：L1 阈值偏低（90/85，实际 96+）、L2 不是真 E2E（Hono test client + in-memory D1，不验 D1/R2 binding）、L3 完全空白。本轮 9 个原子 commit 一次补齐。

### Commit 列表

| # | Commit | 主题 |
|---|--------|------|
| 1 | `feat(quality): raise L1 coverage thresholds to 95/95` | `scripts/check-coverage.ts` LINE/FUNC 90/85 → 95/95 |
| 2 | `feat(worker): scaffold wrangler-based L2 HTTP runner + smoke test` | `scripts/run-l2-http.ts` + `apps/worker/__tests__/l2-http/{setup,live.http.test}.ts` + 抽出 `INIT_SQL` 常量 |
| 3 | `feat(worker): add L2 HTTP CRUD tests for members + policies` | `crud.http.test.ts`：真 D1 上跑 members/policies CRUD，断言 `id` 是标量（守 sqlite-proxy 行映射陷阱） |
| 4 | `feat(worker): cover R2 attachments via wrangler local R2 emulator` | `attachments.http.test.ts`：multipart 上传 → metadata → 字节 round-trip → DELETE，并验证非 PDF magic 拒绝 |
| 5 | `chore(hooks): add L2 HTTP suite to pre-push gate` | `scripts/pre-push.ts` 追加 `l2 http` 步骤 |
| 6 | `feat(web): scaffold Playwright config for L3 browser regression` | `apps/web/playwright.config.ts` + `scripts/run-l3-server.ts`（vite build → wrangler dev :27012）+ global setup/teardown |
| 7 | `feat(web): add L3 specs for auth contract + core navigation` | `auth-redirect.spec.ts` / `navigation.spec.ts` / `dashboard.spec.ts` |
| 8 | `feat(web): add L3 specs for members/policies/coverage/404` | `members.spec.ts` / `policies.spec.ts` / `coverage.spec.ts` / `not-found.spec.ts` |
| 9 | `docs(quality): document L1 threshold uplift + L2 HTTP + L3 Playwright` | CLAUDE.md / README.md / CHANGELOG.md / 本文同步 |

### 端口分配

| 端口 | 用途 |
|------|------|
| 7012 | Vite dev server |
| 7016 | 本地 wrangler dev (`bun run dev:worker`) |
| 7017 | L2 HTTP 测试 wrangler dev（新） |
| 27012 | L3 Playwright wrangler dev（新） |

### L2 HTTP suite

`apps/worker/__tests__/l2-http/`，runner 通过 `bun run scripts/run-l2-http.ts` 启 wrangler dev `--local --persist-to` 后 fetch 127.0.0.1:7017：

- `live.http.test.ts` — `/api/live` 返回 `version` + D1 状态 + `Cache-Control: no-store`
- `crud.http.test.ts` — members + policies CRUD（POST/GET/PUT/DELETE），守 `typeof id === "number"`
- `attachments.http.test.ts` — R2 真 binding：multipart upload → list → metadata → file download → DELETE；并验证非 PDF magic bytes 在 application/pdf content-type 下被拒绝

Schema 用 `packages/db` 抽出的 `INIT_SQL` 常量（不再依赖可能漂移的 drizzle migrations），通过 `bunx wrangler d1 execute --local` 注入。runner 启停约 5s + 测试 ~10s。

### L3 Playwright suite

`apps/web/tests/playwright/`，10 个 spec / chromium 单 worker / port 27012 / 总时长 ~42s。webServer 由 `scripts/run-l3-server.ts` 起：先 `bun run build` 把 SPA 产物吐到 `apps/worker/static/`，再启 wrangler dev `--local`（同 process 既托管 `/api/*` 又托管 ASSETS binding）。

| Spec | 内容 |
|------|------|
| `auth-redirect.spec.ts` | `/api/live` 公开 + `E2E_SKIP_AUTH=true` 下 protected route 200 baseline |
| `navigation.spec.ts` | 11 条主路由的 H1 文本 |
| `dashboard.spec.ts` | `/` SWR 加载后渲染"家庭保障概览" |
| `members.spec.ts` | 列表显示 seed 成员 + "添加成员" 打开 sheet + 表单可见 |
| `policies.spec.ts` | 列表显示 seed 产品 + 详情页正常加载 |
| `coverage.spec.ts` | `/coverage-lookup` 渲染选择器 + seed 成员可见 |
| `not-found.spec.ts` | 未知路由返回 200 SPA fallback（worker ASSETS binding `not_found_handling = single-page-application`） |

不进硬门禁，按需 `bun run test:e2e:browser`。

### 覆盖率快照（升级后）

```
✅ web    funcs=100.00% lines=100.00%
✅ worker funcs=95.83%  lines=98.89%
✅ cli    funcs=96.88%  lines=98.14%
```

阈值从 90/85 拉到 95/95 后，所有三组仍达标但裕度变窄（worker funcs 95.83 离 95 阈值仅 0.83 个百分点）。后续路由新增需补对应测试，否则会触发 pre-commit 阻断。
