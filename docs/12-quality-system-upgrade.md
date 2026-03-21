# Quality System Upgrade: L1+L2+L3+G1+G2

Upgrade from legacy "Four-Layer Testing" to the new quality system (3 test layers + 2 quality gates).

## Background

The project currently implements the old "四层测试架构" model. The new "质量体系" redefines the taxonomy:

- **Lint is demoted** from a test layer to a quality gate (G1)
- **L3/L4 merged** into a single System/E2E layer (L3)
- **G2 Security/Perf gate** is added (osv-scanner + gitleaks)
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
| **L3** System/E2E | Playwright | CI/on-demand | ✅ No gap |
| **G1** Static Analysis | tsc + eslint (strict) + lint-staged | pre-commit | ⚠️ Missing lint-staged, missing .skip/.only ban |
| **G2** Security/Perf | osv-scanner + gitleaks | pre-push | ❌ Not installed, not hooked |

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
     "*.{ts,tsx}": ["eslint --max-warnings=0"]
   }
   ```
3. Update `.husky/pre-commit`:
   ```bash
   bun run test:coverage && bunx lint-staged && bun run typecheck
   ```
   - Replace `bun run lint` with `bunx lint-staged` for incremental checking
   - Keep `bun run typecheck` as-is (tsc needs full project context, cannot be incremental)

**Files modified**:
- `package.json` — add lint-staged dep + config
- `.husky/pre-commit` — switch to lint-staged

**Commit**: `feat: add lint-staged for incremental pre-commit linting`

---

### Step 2 — Ban .skip() and .only() in test files

**Risk**: Zero.

**Why**: Prevent accidentally committed `.skip()` / `.only()` from silently disabling tests. This is a quality system requirement under G1.

**Changes**:

Add a new ESLint config block targeting test files:

```javascript
// Test hygiene: ban .skip and .only
{
  files: ["src/__tests__/**/*.ts", "mcp/__tests__/**/*.ts"],
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
- `eslint.config.mjs` — add test hygiene rules

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
   bun run test:e2e

   # G2: Security gate
   if command -v osv-scanner &> /dev/null; then
     echo "🔍 Scanning dependencies for vulnerabilities..."
     osv-scanner --lockfile=bun.lock
   fi

   if command -v gitleaks &> /dev/null; then
     echo "🔑 Checking for leaked secrets..."
     gitleaks protect --staged --no-banner
   fi
   ```
   - Use `command -v` guard so missing tools warn but don't block (graceful degradation for CI/new dev machines)

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

**Files modified**:
- `docs/archive/06-testing-improvement-plan.md` (moved)
- `CLAUDE.md` — update test framework table + section title

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
osv-scanner --lockfile=bun.lock # G2 — should report zero vulnerabilities
gitleaks protect --staged --no-banner  # G2 — should find no secrets

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
  ├── G2: osv-scanner --lockfile=bun.lock
  └── G2: gitleaks protect --staged --no-banner

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
