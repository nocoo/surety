# Quality System Upgrade: L1+L2+L3+G1+G2

Upgrade from legacy "Four-Layer Testing" to the new quality system (3 test layers + 2 quality gates).

## Background

The project currently implements the old "四层测试架构" model. The new "质量体系" redefines the taxonomy:

- **Lint is demoted** from a test layer to a quality gate (G1)
- **L3/L4 merged** into a single System/E2E layer (L3)
- **G2 Security gate** is added (osv-scanner + gitleaks)
- **lint-staged** for incremental pre-commit linting (currently lints all files)
- **Test hygiene rules** (.skip/.only banned via ESLint)

## Gap Analysis

### Current State (Four-Layer Testing)

| Layer | What | Hook | Status |
|-------|------|------|--------|
| L1 UT | bun test + check-coverage.ts (≥90%) | pre-commit | ✅ Aligned |
| L2 Lint | eslint (strict rules active) | pre-commit | ✅ Aligned |
| L2 Typecheck | tsc --noEmit | pre-commit | ✅ Aligned |
| L3 API E2E | run-e2e.ts (15 files, remote D1 dev) | pre-push | ✅ Aligned |
| L4 UI E2E | Playwright (9 specs) | on-demand | ✅ Aligned |

### Target State (Quality System)

| Layer/Gate | What | Hook | Current Gap |
|------------|------|------|-------------|
| **L1** Unit | bun test + coverage ≥90% | pre-commit | ✅ No gap |
| **L2** Integration/API | run-e2e.ts (true HTTP) | pre-push | ✅ No gap |
| **L3** System/E2E | Playwright | on-demand | ✅ No gap |
| **G1** Static Analysis | tsc (full) + eslint via lint-staged (incremental) | pre-commit | ⚠️ Missing lint-staged, missing .skip/.only ban |
| **G2** Security | osv-scanner + gitleaks | pre-push | ❌ Not installed, not hooked |

### Detailed Gaps

| # | Gap | Severity |
|---|-----|----------|
| 1 | No `lint-staged` — pre-commit lints entire codebase instead of staged files only | Low |
| 2 | No `.skip`/`.only` ban in ESLint — test hygiene not enforced | Low |
| 3 | No `osv-scanner` in pre-push — dependency vulnerabilities not scanned | Medium |
| 4 | No `gitleaks` in pre-push — secret leakage not detected | Medium |
| 5 | ESLint config comment references "four-layer" — terminology outdated | Trivial |
| 6 | `docs/06-testing-improvement-plan.md` references old model — should be archived | Trivial |
| 7 | `CLAUDE.md` test framework table uses old L1/L2/L3/L4 naming | Trivial |

### What's Already Aligned (No Change Needed)

- **L1**: bun test with coverage gate (≥90%), runs in pre-commit ✅
- **L2**: True HTTP E2E via run-e2e.ts, remote D1 dev database, runs in pre-push ✅
- **L3**: Playwright with Page Object pattern, 9 specs, on-demand ✅
- **G1 partial**: tsc --noEmit (strict mode), eslint with no-explicit-any + no-unused-vars + no-console ✅
- **Coverage script**: check-coverage.ts with 90% threshold ✅
- **E2E isolation**: File lock, seed-remote.ts, safety guard ✅

## Execution Plan

Each step = one atomic commit. Steps ordered by dependency and risk (low first).

---

### Step 1 — Install lint-staged for incremental G1

**Risk**: Low.

**Why**: Currently `bun run lint` in pre-commit scans the entire codebase (~hundreds of files). With lint-staged, only staged files are checked, cutting pre-commit lint time significantly.

**Changes**:

1. Install: `bun add -d lint-staged`
2. Add `lint-staged` config to `package.json`:
   ```json
   "lint-staged": {
     "*.{ts,tsx,mjs}": ["eslint --max-warnings=0"]
   }
   ```
3. Update `.husky/pre-commit`:
   ```bash
   bun run test:coverage && bunx lint-staged && bun run typecheck
   ```
   - Replace `bun run lint` with `bunx lint-staged` for incremental checking
   - Keep `bun run typecheck` as-is (tsc needs full project context, cannot be incremental)

**Design note — incremental vs full lint**: After this change, pre-commit only lints staged files. There is no automatic full-codebase lint execution point (no CI exists). This is an intentional trade-off for pre-commit speed. Full lint is available on-demand via `bun run lint`. If a full-codebase lint gate is needed in the future, it should be added to a CI pipeline.

**Files modified**:
- `package.json` — add lint-staged dep + config
- `.husky/pre-commit` — switch to lint-staged

**Commit**: `feat: add lint-staged for incremental pre-commit linting`

---

### Step 2 — Ban .skip() and .only() in test files

**Risk**: Zero.

**Why**: Prevent accidentally committed `.skip()` / `.only()` from silently disabling tests. This is a quality system requirement under G1.

**Changes**:

1. Remove `e2e/**` from `globalIgnores` in `eslint.config.mjs` (currently ignored because Playwright tests are not React code, but we need ESLint to enforce test hygiene rules there)
2. Add a new ESLint config block to disable React/Next.js rules for `e2e/` (since it's not React code)
3. Add test hygiene rules targeting all test directories:

```javascript
// Disable React/Next.js rules for Playwright E2E (not React code)
{
  files: ["e2e/**/*.ts"],
  rules: {
    "@next/next/no-html-link-for-pages": "off",
  },
},
// Test hygiene: ban .skip and .only (covers UT, MCP, and Playwright E2E)
{
  files: ["src/__tests__/**/*.ts", "mcp/__tests__/**/*.ts", "e2e/**/*.ts"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "CallExpression[callee.property.name='skip']",
        message: "Do not commit .skip() — it silently disables tests.",
      },
      {
        selector: "CallExpression[callee.property.name='only']",
        message: "Do not commit .only() — it silently skips other tests.",
      },
    ],
  },
},
```

**Files modified**:
- `eslint.config.mjs` — remove `e2e/**` from globalIgnores, add React rule override for e2e/, add test hygiene rules

**Verification**: `bun run lint` should pass (no existing .skip/.only found).

**Commit**: `feat: ban .skip/.only in test files via eslint`

---

### Step 3 — Add G2 security gate to pre-push

**Risk**: Low.

**Why**: The quality system requires dependency vulnerability scanning (osv-scanner) and secret leak detection (gitleaks) in pre-push.

**Prerequisites**: Tools must be installed globally:
```bash
brew install osv-scanner gitleaks
```

**Changes**:

1. Update `.husky/pre-push`:
   ```bash
   set -e  # Ensure any failure aborts the push

   # Capture pre-push stdin immediately — Git provides ref info via stdin,
   # and child processes (bun run test:e2e) inherit stdin and may consume it.
   PUSH_INFO=$(cat)

   bun run test:e2e

   # G2: Security gate — dependency vulnerability scan
   # Scan both root and worker lockfiles (worker/ is an independent service, not build output)
   if command -v osv-scanner &> /dev/null; then
     echo "🔍 Scanning dependencies for vulnerabilities..."
     osv-scanner scan source --lockfile=bun.lock --lockfile=worker/bun.lock
   else
     echo "⚠️  osv-scanner not installed, skipping vulnerability scan (brew install osv-scanner)"
   fi

   # G2: Secret leak detection — scan commits being pushed
   # Uses captured PUSH_INFO (format: "local_ref local_sha remote_ref remote_sha" per line).
   # IMPORTANT: `while read` runs via <<< (here-string), NOT pipe, so `exit 1` aborts
   # the hook process directly instead of only exiting a subshell.
   ZERO="0000000000000000000000000000000000000000"
   if command -v gitleaks &> /dev/null; then
     echo "🔑 Checking for leaked secrets..."
     while read -r local_ref local_sha remote_ref remote_sha; do
       [ -z "$local_sha" ] && continue
       if [ "$local_sha" = "$ZERO" ]; then
         continue  # branch deletion, skip
       fi
       if [ "$remote_sha" = "$ZERO" ]; then
         # New branch: remote has no prior SHA for this ref.
         # Best-effort approximation: find merge-base with remote default branch.
         # This may over-scan if the branch was forked from a non-default remote
         # branch, but guarantees no commits are missed.
         base=$(git merge-base origin/HEAD "$local_sha" 2>/dev/null) || {
           echo "⚠️  Cannot determine base commit (origin/HEAD missing?), skipping gitleaks for this ref"
           continue
         }
         range="${base}..${local_sha}"
       else
         range="${remote_sha}..${local_sha}"
       fi
       gitleaks git --no-banner --log-opts="$range" || exit 1
     done <<< "$PUSH_INFO"
   else
     echo "⚠️  gitleaks not installed, skipping secret scan (brew install gitleaks)"
   fi
   ```
   - **`set -e`**: Ensures command failures (e.g., `bun run test:e2e`, `osv-scanner`) abort the hook. Note: `set -e` alone does NOT fix gitleaks failure propagation — the `<<<` here-string fix below is what makes `exit 1` inside the loop work
   - **stdin capture**: `PUSH_INFO=$(cat)` at script start preserves ref info before any child process can consume it
   - **`<<< "$PUSH_INFO"` (not pipe)**: This is the critical fix for gitleaks failure propagation. `while read` runs in the main shell, so `exit 1` terminates the hook. A pipe (`echo | while`) spawns a subshell where `exit 1` only exits the subshell, allowing the hook to succeed even when gitleaks finds secrets
   - **osv-scanner**: Scans both `bun.lock` (main app) and `worker/bun.lock` (D1 proxy worker) to cover the full supply chain
   - **gitleaks**: Uses `gitleaks git` subcommand (v8.19.0+; replaces deprecated `detect`/`protect`). For incremental pushes, uses the exact `remote_sha..local_sha` range. For new branches (remote_sha is zero), uses `git merge-base origin/HEAD` as a best-effort approximation — this may over-scan commits already on other remote refs. **Caveat**: if `origin/HEAD` is not set (e.g., bare clone without `git remote set-head`), the new-branch scan is skipped with a warning; this is a known gap traded for not blocking all pushes on misconfigured repos

**Files modified**:
- `.husky/pre-push` — add G2 security scans

**Commit**: `feat: add G2 security gate (osv-scanner + gitleaks) to pre-push`

---

### Step 4 — Update ESLint config comments + add --max-warnings=0

**Risk**: Zero.

**Why**: Align terminology from "four-layer" to "quality system". Ensure lint script uses `--max-warnings=0` explicitly.

**Changes**:

1. `eslint.config.mjs`:
   - Change comment `// Strict mode: four-layer testing compliance` → `// G1: strict TypeScript rules`
2. `package.json`:
   - Change `"lint"` script from `"eslint"` to `"eslint --max-warnings=0"` (explicit zero-tolerance)

**Files modified**:
- `eslint.config.mjs` — update comment
- `package.json` — add --max-warnings=0 to lint script

**Commit**: `refactor: align eslint config with quality system terminology`

---

### Step 5 — Archive old testing plan, update CLAUDE.md

**Risk**: Zero.

**Why**: `docs/06-testing-improvement-plan.md` documents the old four-layer model and is fully completed. Archive it. Update CLAUDE.md test framework table to use the new L1/L2/L3/G1/G2 taxonomy.

**Changes**:

1. Create `docs/archive/` directory
2. Move `docs/06-testing-improvement-plan.md` → `docs/archive/06-testing-improvement-plan.md`
3. Update `CLAUDE.md` "四层测试框架" table:

   **Before**:
   ```
   | 层级 | 工具 | 触发时机 | 要求 |
   |------|------|----------|------|
   | UT | bun test | pre-commit | 覆盖率 90%+ |
   | Lint | eslint | pre-commit | 零错误零警告 |
   | Typecheck | tsc --noEmit | pre-commit | 零类型错误 |
   | API E2E | bun run test:e2e | pre-push | 100% API 覆盖 (port 7016) |
   | UI E2E | bun run test:e2e:ui | 按需执行 | Playwright + Chromium (port 7017) |
   ```

   **After**:
   ```
   | 层级 | 工具 | 触发时机 | 要求 |
   |------|------|----------|------|
   | L1 Unit | bun test | pre-commit | 覆盖率 90%+ |
   | L2 Integration/API | bun run test:e2e | pre-push | 100% API 覆盖 (port 7016) |
   | L3 System/E2E | bun run test:e2e:ui | 按需执行 | Playwright + Chromium (port 7017) |
   | G1 Static Analysis | lint-staged + tsc --noEmit | pre-commit | 零错误零警告 |
   | G2 Security | osv-scanner + gitleaks | pre-push | 零漏洞零泄漏 |
   ```

4. Rename section header from "四层测试框架" to "质量体系（三层测试 + 两道门控）"

5. Update `README.md` docs tree (lines 91-102) — replace entire block to:
   - Add `archive/` as a subdirectory node containing `06-testing-improvement-plan.md`
   - Add `12-quality-system-upgrade.md`
   - Add `README.md` (docs index)
   - Example target structure:
     ```
     ├── 📂 docs/                      # 项目文档
     │   ├── README.md                 # 文档索引
     │   ├── 01-design-overview.md     # 整体设计研究报告
     │   ├── ...
     │   ├── 11-sqlite-to-d1-migration.md # SQLite → Cloudflare D1 迁移
     │   ├── 12-quality-system-upgrade.md # 质量体系升级计划
     │   └── 📂 archive/               # 已归档文档
     │       └── 06-testing-improvement-plan.md
     ```
   - `CHANGELOG.md` line 133: append `(archived to docs/archive/)` note
6. Update `CLAUDE.md` commands section (line 59):
   - Replace `bun test --coverage  # 测试覆盖率` with `bun run test:coverage  # 测试覆盖率 (≥90% 门禁)`
   - This is the actual gate command with the 90% threshold; `bun test --coverage` only prints coverage without enforcing it
7. Update `docs/10-totp-implementation-details.md` section 9.3 "Pre-commit 集成":
   - Replace stale `eslint` reference with `bunx lint-staged` + `bun run typecheck`
   - The current text only lists `check-coverage.ts` + `eslint`, missing lint-staged and typecheck

**Files modified**:
- `docs/archive/06-testing-improvement-plan.md` (moved)
- `CLAUDE.md` — update test framework table + section title + commands section
- `README.md` — rewrite docs tree (add archive/, 12, README.md)
- `CHANGELOG.md` — annotate archived doc path
- `docs/10-totp-implementation-details.md` — update pre-commit hook description

**Commit**: `docs: upgrade test framework docs to quality system model`

---

### Step 6 — Create docs/README.md index

**Risk**: Zero.

**Why**: Per "编号文档" memory spec, docs/ should have a README.md as an index of all documents. Currently missing.

**Changes**:

Create `docs/README.md`:
```markdown
# Surety Documentation

## Documents

| # | Document | Description |
|---|----------|-------------|
| 01 | [Design Overview](./01-design-overview.md) | System architecture and design decisions |
| 02 | [Database Design](./02-database-design.md) | Database schema and D1 proxy architecture |
| 03 | [Google OAuth Setup](./03-google-oauth-setup.md) | OAuth provider configuration |
| 04 | [MCP Setup](./04-mcp-setup.md) | MCP Server configuration and tools |
| 05 | [Basalt UI Migration](./05-basalt-ui-migration.md) | UI framework migration record |
| 07 | [Impeccable Audit Report](./07-impeccable-audit-report.md) | Security audit findings |
| 08 | [Two-Factor Auth](./08-two-factor-auth.md) | 2FA feature documentation |
| 09 | [TOTP Module](./09-totp-module.md) | TOTP module design |
| 10 | [TOTP Implementation Details](./10-totp-implementation-details.md) | TOTP implementation internals |
| 11 | [SQLite to D1 Migration](./11-sqlite-to-d1-migration.md) | Database migration record |
| 12 | [Quality System Upgrade](./12-quality-system-upgrade.md) | Quality system (L1+L2+L3+G1+G2) upgrade plan |

## Archive

| # | Document | Description |
|---|----------|-------------|
| 06 | [Testing Improvement Plan](./archive/06-testing-improvement-plan.md) | Legacy four-layer testing plan (completed) |
```

**Files modified**:
- `docs/README.md` (new)

**Commit**: `docs: add docs/README.md index`

---

## Verification Checklist

After all steps, run the following to verify:

```bash
# G1: pre-commit gate
bun run test:coverage          # L1 — should pass with ≥90% coverage
bunx lint-staged               # G1 — should lint only staged files
bun run typecheck              # G1 — should pass with zero errors

# G2 + L2: pre-push gate
bun run test:e2e               # L2 — should pass all API E2E tests
osv-scanner scan source --lockfile=bun.lock --lockfile=worker/bun.lock  # G2 — scan both app and worker deps
gitleaks git --no-banner --log-opts="@{push}..HEAD"  # G2 — scan commits for secrets (pre-push hook uses stdin for precise range)

# L3: on-demand
bun run test:e2e:ui            # L3 — should pass all Playwright specs
```

## Hooks Mapping (Final State)

```
pre-commit (<30s):
  ├── L1: bun run test:coverage (bun test + coverage ≥90%)
  ├── G1: bunx lint-staged (eslint --max-warnings=0, staged files only)
  └── G1: bun run typecheck (tsc --noEmit)

pre-push (<3min):
  ├── L2: bun run test:e2e (API E2E, remote D1 dev, port 7016)
  ├── G2: osv-scanner scan source --lockfile=bun.lock --lockfile=worker/bun.lock
  └── G2: gitleaks git --log-opts (commit range from pre-push stdin, origin/HEAD base for new branches)

on-demand:
  └── L3: bun run test:e2e:ui (Playwright, port 7017)
```

## Success Criteria

- [ ] lint-staged installed and wired into pre-commit
- [ ] .skip/.only banned in test files via ESLint
- [ ] osv-scanner + gitleaks run in pre-push
- [ ] ESLint uses --max-warnings=0 explicitly
- [ ] Old testing plan archived
- [ ] CLAUDE.md updated to quality system taxonomy
- [ ] docs/README.md index created
