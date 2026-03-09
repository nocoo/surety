# 08 — Two-Factor Authentication (TOTP)

日期：2026-03-09
状态：完成

## 目标

为 Surety 添加 TOTP 双因素认证，登录时除 Google OAuth 外还需输入 6 位动态验证码。

## 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| TOTP 库 | `otpauth` | 仅 1 dep (@noble/hashes)，Bun CI 显式测试，TypeScript 原生 |
| QR 库 | `qrcode` + `@types/qrcode` | 成熟稳定，toDataURL 直出 data URL |
| Secret 加密 | AES-256-GCM | 认证加密，MASTER_KEY 在环境变量 |
| Recovery | 1 个备用码 | 本地部署，锁死可直接操作 DB 恢复 |

## 存储设计

复用现有 `settings` KV 表（`key TEXT PK, value TEXT, updated_at INTEGER`）：

| Key | Value | 说明 |
|-----|-------|------|
| `totp.enabled` | `"true"` / `"false"` | 是否启用 |
| `totp.encryptedSecret` | `"{iv}:{ciphertext}:{tag}"` | AES-256-GCM 加密的 base32 secret |
| `totp.recoveryCodeHash` | `"$2b$..."` | bcrypt 哈希的 recovery code |
| `totp.recoveryCodeUsed` | `"true"` / `"false"` | 是否已使用 |
| `totp.failedAttempts` | `"0"` ~ `"5"` | 连续失败次数 |
| `totp.lockUntil` | ISO 8601 timestamp | 锁定截止时间 |

### 为何不新建表

- 单用户模型，只有一组 2FA 数据
- settings KV 表已有 `get/set/getJson/setJson` helper
- SQLite 单写者模型天然避免竞态（Bun 单线程 + better-sqlite3 同步 API）
- 不值得为 6 个 KV 对创建 migration

## 环境变量

```
TOTP_MASTER_KEY=<32-byte hex>   # openssl rand -hex 32
```

独立于 `NEXTAUTH_SECRET`，密钥分离。

## Session/JWT 扩展

```typescript
// NextAuth 类型扩展
declare module "next-auth" {
  interface Session { user: DefaultSession["user"] & { twoFactorVerified?: boolean } }
}
declare module "next-auth/jwt" {
  interface JWT { twoFactorVerified?: boolean }
}
```

- `jwt` callback: 检查 DB 是否启用 2FA → 设 `twoFactorVerified`
- `session` callback: 传递 `twoFactorVerified` 到客户端
- 检查 `surety-2fa-trusted` cookie 实现记住设备

## 流程设计

### 启用 2FA（Settings 页面）

```
用户点击「启用双因素认证」
→ POST /api/settings/2fa/setup
→ 生成 Secret，AES-256-GCM 加密存入 settings（enabled=false）
→ 返回 QR data URL + base32 明文
→ 前端展示 QR Code + Secret 明文
→ 用户扫码后输入 6 位码
→ POST /api/settings/2fa/verify-setup { token }
→ 验证通过 → enabled=true → 生成 1 个 Recovery Code
→ 返回 Recovery Code（明文，仅此一次）
→ 用户确认已保存
```

### 登录验证

```
Google OAuth 成功
→ jwt callback: 查 DB totp.enabled
→ 如启用，检查 surety-2fa-trusted cookie
  → cookie 有效 → twoFactorVerified=true（跳过 2FA）
  → cookie 无效 → twoFactorVerified=false
→ proxy.ts: twoFactorVerified=false → redirect /verify-2fa
→ 用户输入 6 位 TOTP 或 Recovery Code
→ POST /api/auth/verify-2fa { token, type: "totp" | "recovery" }
→ 验证成功 → 刷新 session → 设 trusted device cookie（30天）→ redirect /
```

### 记住设备

Cookie: `surety-2fa-trusted`，30 天有效。
值: `HMAC-SHA256(email + "|" + expiry, NEXTAUTH_SECRET)`
在 jwt callback 中验证签名 + 过期时间。

### 暴力破解防护

- 连续 5 次失败 → 锁定 15 分钟
- 锁定检查在 TOTP 运算之前（防 CPU DoS）
- 验证成功后重置计数器

## API 路由

| Method | Path | 功能 |
|--------|------|------|
| GET | `/api/settings/2fa/status` | 查询 2FA 启用状态 |
| POST | `/api/settings/2fa/setup` | 生成 Secret + QR |
| POST | `/api/settings/2fa/verify-setup` | 确认启用 + 生成 Recovery Code |
| POST | `/api/settings/2fa/disable` | 禁用 2FA（需验证 TOTP） |
| POST | `/api/auth/verify-2fa` | 登录时验证 TOTP / Recovery Code |

## 文件变更清单

| # | 操作 | 文件 | 说明 |
|---|------|------|------|
| 1 | 新增依赖 | `package.json` | +otpauth +qrcode +@types/qrcode |
| 2 | 新增 | `src/lib/totp.ts` | TOTP 核心工具函数 |
| 3 | 修改 | `src/auth.ts` | 类型扩展 + jwt/session callbacks |
| 4 | 修改 | `src/proxy.ts` | 2FA 守卫逻辑 |
| 5 | 新增 | `src/app/api/settings/2fa/status/route.ts` | |
| 6 | 新增 | `src/app/api/settings/2fa/setup/route.ts` | |
| 7 | 新增 | `src/app/api/settings/2fa/verify-setup/route.ts` | |
| 8 | 新增 | `src/app/api/settings/2fa/disable/route.ts` | |
| 9 | 新增 | `src/app/api/auth/verify-2fa/route.ts` | |
| 10 | 新增 | `src/app/verify-2fa/page.tsx` | 验证码输入页 |
| 11 | 修改 | `src/app/settings/page.tsx` | 新增 2FA 设置卡片 |
| 12 | 修改 | `.env.example` | +TOTP_MASTER_KEY |
| 13 | 修改 | `.env` | +TOTP_MASTER_KEY (生成) |
| 14 | 新增 | `src/__tests__/totp.test.ts` | 单元测试 |

## 原子化提交计划

| # | Commit Message | 包含文件 |
|---|----------------|----------|
| 1 | `docs: add 2FA implementation plan` | `docs/08-two-factor-auth.md` |
| 2 | `chore: add otpauth and qrcode dependencies` | `package.json`, lockfile |
| 3 | `feat: add TOTP core utilities` | `src/lib/totp.ts`, `.env.example`, `.env` |
| 4 | `feat: extend NextAuth with 2FA session state` | `src/auth.ts` |
| 5 | `feat: add 2FA guard to proxy` | `src/proxy.ts` |
| 6 | `feat: add 2FA API routes` | `src/app/api/settings/2fa/*`, `src/app/api/auth/verify-2fa/*` |
| 7 | `feat: add 2FA verification page` | `src/app/verify-2fa/page.tsx` |
| 8 | `feat: add 2FA settings card` | `src/app/settings/page.tsx` |
| 9 | `test: add TOTP unit tests` | `src/__tests__/totp.test.ts` |
| 10 | `fix: ...` | (按需) |

## 三方 Review 摘要

经 Claude Code、Codex (GPT-5.4)、Gemini 三方 Review，共识如下：

**一致好评**：库选择 (otpauth)、AES-256-GCM 加密、JWT 扩展思路

**采纳的建议**：
- API 路由也需检查 `twoFactorVerified`（三方一致）
- 暴力破解锁定检查放在 TOTP 运算之前防 CPU DoS（Gemini）

**知悉但不采纳的建议**：
- Recovery Code 增至 8-10 个 → 保持 1 个（本地部署，可直接操作 DB 恢复）
- 新建专用表 → 保持 KV 表（单用户 + SQLite 同步写入无竞态）
- Remember Device 加服务端存储 → 保持纯 HMAC cookie（单用户无需撤销）

## 实施进度

- [x] Step 0: 创建计划文档
- [x] Step 1: 安装依赖 (`5ecb8c7`)
- [x] Step 2: 创建 `src/lib/totp.ts` (`d0ba138`)
- [x] Step 3: 修改 `src/auth.ts` (`5952a04`)
- [x] Step 4: 修改 `src/proxy.ts` (`b44e4fa`)
- [x] Step 5: 创建 2FA API 路由 (`f472660`)
- [x] Step 6: 创建 `/verify-2fa` 页面 (`427e3bb`)
- [x] Step 7: 修改 Settings 页面 (`47bbeef`)
- [x] Step 8: 更新 `.env.example` + `.env` (`d0ba138`)
- [x] Step 9: Build + Lint 验证 ✅
- [x] Step 10: 单元测试 (32 tests, `30c5877`)
- [x] Step 11: 三方安全 Review 文档 (`87621ad`)
- [x] Step 12: P0/P1/P2/P3 全部修复完成 (`2506ab1` ~ `2cdde1b`)

## 三方安全 Review (Claude Code / Codex GPT-5.4 / Gemini)

日期：2026-03-09

### 三方共识 (3/3)

| # | 严重度 | 问题 | 位置 |
|---|--------|------|------|
| 1 | Critical | `updateSession()` 可绕过 2FA — `trigger==="update"` 无条件设 `twoFactorVerified=true` | `src/auth.ts:148-151` |
| 2 | Critical | API 路由不检查 2FA 状态 — proxy matcher 排除 `/api/*`，业务 API 对未验证 2FA 的用户完全开放 | `src/proxy.ts:106` |
| 3 | High | verify-setup / disable 端点无暴力破解保护 | `verify-setup/route.ts`, `disable/route.ts` |

### 两方共识 (2/3)

| # | 严重度 | 问题 | 提出者 |
|---|--------|------|--------|
| 4 | High | `isTwoFactorEnabled()` catch 静默返回 `false`，DB 异常导致 2FA 绕过 | Claude + Gemini |
| 5 | High | Trusted device cookie 无法撤销，不绑定 enrollment 版本 | Codex + Claude |
| 6 | Medium | `process.env.SURETY_DB` 并发竞态（已知限制，单用户场景可接受） | Codex + Gemini |
| 7 | Medium | Master key 只检查长度不验证 hex 格式 | Claude + Codex |

### 单方发现

| # | 严重度 | 问题 | 发现者 |
|---|--------|------|--------|
| 8 | Medium | Settings API 暴露 `totp.*` 敏感 key | Gemini |
| 9 | Low | Recovery code 不 trim 空格 | Codex |
| 10 | Low | UI 硬编码 `rememberDevice: true` | Codex |
| 11 | Low | 手写 timing-safe 比较，应用 `crypto.timingSafeEqual` | Gemini |

### 修复计划

| 优先级 | 问题 # | 修复方案 | 状态 |
|--------|--------|----------|------|
| P0 | 1 | JWT callback 改用服务端签名 nonce 验证，非盲信 trigger | [x] `2506ab1` |
| P0 | 2 | proxy matcher 扩展覆盖 API 路由，返回 401/403 JSON | [x] `44ce36f` |
| P1 | 3 | verify-setup / disable 加 brute force 保护 | [x] `da914e6` |
| P1 | 4 | `isTwoFactorEnabled()` 加 `console.error` + fail-closed | [x] `2506ab1` |
| P1 | 5 | Cookie 绑定 `totp.enrollVersion`，版本变更时旧 cookie 失效 | [x] `2506ab1` |
| P2 | 7 | Master key 加 `/^[0-9a-fA-F]{64}$/` 正则 | [x] `2506ab1` |
| P2 | 8 | Settings API 过滤 `totp.*` 前缀 key，`[key]` 路由拒绝 `totp.*` 读写 | [x] `7565d2b` |
| P2 | 9 | `normalizeRecoveryCode()` 加 `.replace(/\s/g, "")` | [x] `2506ab1` |
| P3 | 11 | 替换手写循环为 `crypto.timingSafeEqual` | [x] `2506ab1` |
| P3 | 10 | verify-2fa 页面加 "记住此设备" 复选框 | [x] `2cdde1b` |

## 模块化重构

日期：2026-03-09

将 TOTP 实现从单一文件 `src/lib/totp.ts` 重构为独立可复用模块 `src/lib/totp/`。

详见 **[docs/09-totp-module.md](./09-totp-module.md)** — 模块独立文档。

### 重构要点

| 变更 | 说明 |
|------|------|
| 模块位置 | `src/lib/totp/` — types / crypto / service / index 四文件 |
| 适配器 | `src/lib/totp.ts` 改为薄适配层（读 env、绑 settingsRepo、re-export） |
| HMAC 密钥 | 新增 `TOTP_HMAC_SECRET` 环境变量，不再依赖 `NEXTAUTH_SECRET` |
| 集成方式 | `TotpService` 类 + `TotpStore` 接口（依赖注入） |
| 测试 | 73 个独立测试，100% 覆盖率，纯内存 store，无 env 依赖 |
| Commit | `93cdd77` |
