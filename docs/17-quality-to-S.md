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

- [ ] Step 1
- [ ] Step 2
- [ ] Step 3
- [ ] Step 4
- [ ] Step 5
- [ ] Step 6
