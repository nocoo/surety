# 10 — TOTP 2FA 实现详解

日期：2026-03-09
状态：完成
版本：v1.3.0

> 本文档是 TOTP 双因素认证的**最终实现文档**，涵盖架构、密码学、流程、状态模型和安全决策。
> 前置文档：[08-two-factor-auth.md](./08-two-factor-auth.md)（设计规划）、[09-totp-module.md](./09-totp-module.md)（独立模块 API 参考）。

---

## 1. 架构总览

### 1.1 分层设计

```
┌─────────────────────────────────────────────────────┐
│  UI Layer                                           │
│  verify-2fa/page.tsx  │  settings/page.tsx          │
├─────────────────────────────────────────────────────┤
│  API Layer (Route Handlers — thin wrappers)          │
│  /api/auth/verify-2fa     登录验证                   │
│  /api/settings/2fa/setup  开始设置                   │
│  /api/settings/2fa/verify-setup  确认启用            │
│  /api/settings/2fa/disable  禁用                    │
│  /api/settings/2fa/status   状态查询                │
├─────────────────────────────────────────────────────┤
│  Auth Layer                                          │
│  src/auth.ts — NextAuth JWT/Session callbacks        │
│  JWT claim: twoFactorVerified, recoverySession       │
├─────────────────────────────────────────────────────┤
│  Proxy Layer (唯一的访问控制执行点)                    │
│  src/proxy.ts → src/lib/proxy-logic.ts              │
├─────────────────────────────────────────────────────┤
│  Service Layer (独立模块，零宿主耦合)                  │
│  src/lib/totp/ — types / crypto / service / index   │
├─────────────────────────────────────────────────────┤
│  Adapter (薄适配层)                                   │
│  src/lib/totp.ts — 读 env、绑 settingsRepo、re-export│
├─────────────────────────────────────────────────────┤
│  Storage (KV Store)                                  │
│  settings 表 (key TEXT PK, value TEXT)               │
└─────────────────────────────────────────────────────┘
```

### 1.2 模块隔离策略

TOTP 模块（`src/lib/totp/`）遵循以下原则：

- **零 `process.env` 访问** — 所有配置通过 `TotpConfig` 显式传入
- **零框架耦合** — 不导入 Next.js、NextAuth、Drizzle ORM
- **依赖注入** — 存储通过 `TotpStore` 接口注入，不绑定具体数据库
- **纯函数** — `crypto.ts` 中所有函数接受显式参数，无副作用
- **适配器模式** — `src/lib/totp.ts` 是唯一将模块耦合到 Surety 的文件

这使得：
- 73 个测试全部使用内存 `Map` 运行，无需数据库、无需环境变量、无需 mock 框架
- 模块可直接复制到任何 TypeScript 项目使用

### 1.3 文件清单

| 文件 | 职责 |
|------|------|
| `src/lib/totp/types.ts` | 接口定义、结果类型、KV key 常量 |
| `src/lib/totp/crypto.ts` | 纯密码学函数（AES、HMAC、scrypt、TOTP） |
| `src/lib/totp/service.ts` | `TotpService` 类 — 业务操作入口 |
| `src/lib/totp/index.ts` | Barrel export |
| `src/lib/totp.ts` | Surety 适配器（env → config → singleton） |
| `src/lib/proxy-logic.ts` | 代理决策逻辑（纯函数，44 个测试） |
| `src/proxy.ts` | 代理处理器（唯一执行点） |
| `src/auth.ts` | NextAuth 配置 + JWT/Session callbacks |

---

## 2. 密码学细节

### 2.1 TOTP Secret 加密 — AES-256-GCM

TOTP 密钥（base32 格式，160 bit）在存入数据库前使用 AES-256-GCM 认证加密。

```
存储格式: {iv_hex}:{ciphertext_hex}:{auth_tag_hex}
```

| 参数 | 值 |
|------|-----|
| 算法 | AES-256-GCM |
| 密钥 | 32 字节，环境变量 `TOTP_MASTER_KEY`（64 位 hex） |
| IV | 96 bit 随机（每次加密重新生成） |
| Auth Tag | 128 bit（GCM 默认） |

**为什么选 GCM**：认证加密（Authenticated Encryption），一次操作同时保证机密性和完整性，无需额外 MAC。

**Master Key 验证**：构造 `TotpService` 时严格校验 `/^[0-9a-fA-F]{64}$/`，拒绝格式错误的密钥。

### 2.2 Recovery Code 哈希 — scrypt

Recovery code 使用 `node:crypto` 的 scrypt 算法哈希存储。

```
存储格式: {salt_hex}:{derived_key_hex}
```

| 参数 | 值 |
|------|-----|
| 算法 | scrypt（`node:crypto`） |
| Salt | 16 字节随机 |
| 输出长度 | 64 字节 |
| 验证 | `crypto.timingSafeEqual` 时间恒定比较 |

**Recovery Code 格式**：16 字节随机 → hex → 每 4 字符加破折号（如 `a1b2-c3d4-e5f6-...`）。输入时自动 normalize（去空格、去破折号、转小写）。

**为什么不用 bcrypt/Bun.password**：`Bun.password.hash/verify` 是 Bun 独有 API，Next.js 的 server runtime 使用 Node.js 兼容层，`Bun` 全局对象不存在。开发阶段 `bun dev` 正常运行掩盖了此问题。改用 `node:crypto` 的 scrypt 确保跨运行时兼容。

### 2.3 Nonce 签名 — HMAC-SHA256

验证成功后签发的一次性 nonce 用于 JWT 提权（session promotion）。

```
nonce: 32 字节随机 hex（generateVerificationNonce）
签名:  HMAC-SHA256(nonce, TOTP_HMAC_SECRET).hex
验证:  crypto.timingSafeEqual(sig, expected)
```

Nonce 存入 KV store（`totp.twoFactorNonce`），消费后立即删除（单次使用）。

### 2.4 Trusted Device Cookie — HMAC-SHA256

```
Cookie 值: {email}|{expiry_iso}|{enroll_version}|{signature_hex}
签名方式:  HMAC-SHA256("{email}|{expiry}|{enrollVersion}", TOTP_HMAC_SECRET)
验证步骤:  email 匹配 → 未过期 → enrollVersion 匹配 → 签名正确（timingSafeEqual）
```

| 属性 | 值 |
|------|-----|
| Cookie 名 | `surety-2fa-trusted` |
| 有效期 | 30 天 |
| HttpOnly | 是 |
| SameSite | Lax |
| Secure | 生产环境 / HTTPS 代理 |

**Enrollment Version 绑定**：cookie 中包含 `totp.enrollVersion`（启用时的 epoch ms）。重新启用 2FA 后 enrollVersion 变化，旧 cookie 自动失效。

### 2.5 密钥分离原则

| 密钥 | 用途 | 环境变量 |
|------|------|----------|
| NEXTAUTH_SECRET | NextAuth session 签名 | `NEXTAUTH_SECRET` |
| TOTP HMAC Secret | Cookie/Nonce 签名 | `TOTP_HMAC_SECRET`（fallback 到 `NEXTAUTH_SECRET`） |
| TOTP Master Key | Secret 加密 (AES-256-GCM) | `TOTP_MASTER_KEY` |

**为什么分离**：复用 `NEXTAUTH_SECRET` 作为 TOTP HMAC 密钥会产生模块与 NextAuth 的隐性耦合。密钥分离不仅是安全最佳实践，也是模块化的前提 — 共享密钥 = 共享耦合。

---

## 3. 状态模型

### 3.1 三种状态源

2FA 状态分布在三个独立的存储中，各自有不同的生命周期和语义：

| 状态源 | 存储 | 生命周期 | 语义 |
|--------|------|----------|------|
| **KV Store (DB)** | D1 settings 表 | 持久 | 2FA 是否启用、加密密钥、recovery code 状态 |
| **JWT (Session)** | Cookie 中的 signed token | 会话级 | `twoFactorVerified`（显式 nonce 提权）、`recoverySession`（recovery code 登录标记） |
| **Trusted Device Cookie** | HttpOnly Cookie | 30 天 | 请求级免验证豁免 |

### 3.2 状态语义定义

```
twoFactorVerified (JWT claim)
  = 当前会话是否通过显式 nonce 验证提权
  = 只在 nonce 验证成功时设为 true
  ≠ 用户是否「有效通过 2FA」

isTrusted (Cookie)
  = 当前请求是否携带有效的 trusted device cookie
  = 请求级检查，不回写到 JWT

twoFactorEnabled (DB)
  = 2FA 功能是否在数据库中启用
  = 权威数据源

effective 2FA satisfied
  = twoFactorVerified || isTrusted || !twoFactorEnabled
```

### 3.3 JWT 与 DB 脱同步问题

JWT 是签发时的快照。当用户在 Settings 中关闭 2FA 后：
- DB：`totp.*` 键全部删除
- JWT：`twoFactorVerified` 仍为 `false`（JWT 无法被后续操作修改）

**结果**：Proxy 看到 `twoFactorVerified=false` → 重定向到 `/verify-2fa` → API 返回「2FA 未启用」→ 用户卡死。

**解决方案**：Proxy 在 `twoFactorVerified=false` 时额外查询 DB 中 2FA 是否仍启用（`twoFactorEnabled`）。若 DB 显示已关闭则直接放行。

**设计原则**：当两个状态源不可能完美同步时，不强行补同步桥，而是明确语义边界 — 每个状态只表达它能可靠表达的含义。Proxy 作为唯一执行点，有能力查询权威数据源来解决偏差。

---

## 4. 完整流程

### 4.1 首次启用 2FA（Setup Flow）

```
用户 → Settings 页面点击「启用双因素认证」
  │
  ├─ POST /api/settings/2fa/setup
  │   ├─ auth 检查（需登录）
  │   ├─ 检查是否已启用（409 冲突）
  │   ├─ TotpService.setup(email)
  │   │   ├─ 生成 160-bit TOTP Secret (base32)
  │   │   ├─ AES-256-GCM 加密 → store.set("totp.encryptedSecret")
  │   │   ├─ store.set("totp.enabled", "false")  ← 尚未启用
  │   │   └─ 生成 QR data URL
  │   └─ 返回 { qrDataURL, secret }
  │
  ├─ 前端展示 QR Code + Secret 明文
  │   └─ QR 左对齐，issuer 含环境标记（"Surety" / "Surety(开发)"）
  │
  ├─ 用户扫码后输入 6 位验证码
  │
  └─ POST /api/settings/2fa/verify-setup { token }
      ├─ 暴力破解检查（5 次失败 → 锁定 15 分钟）
      ├─ 解密 Secret → 验证 TOTP token
      ├─ 【原子化】先计算所有派生值，再批量写入：
      │   ├─ enrollVersion = Date.now()
      │   ├─ recoveryCode = 16 字节随机 hex（格式化）
      │   ├─ recoveryHash = scrypt(recoveryCode)
      │   └─ 全部成功后：
      │       ├─ store.set("totp.enabled", "true")
      │       ├─ store.set("totp.enrollVersion", ...)
      │       ├─ store.set("totp.recoveryCodeHash", ...)
      │       ├─ store.set("totp.recoveryCodeUsed", "false")
      │       └─ 重置暴力破解计数器
      ├─ 生成 nonce + HMAC 签名 → 存入 store
      ├─ 返回 { recoveryCode, nonce, nonceSig }
      │   └─ 注意：不签发 trusted device cookie
      │
      └─ 前端：
          ├─ 展示 Recovery Code（明文，仅此一次）
          └─ 调用 updateSession({ twoFactorNonce, twoFactorSig })
              └─ JWT callback 验证 nonce → token.twoFactorVerified = true
```

**关键安全决策**：

1. **原子化写入**：先计算 enrollVersion、recoveryCode、recoveryHash，全部成功后再写入 DB。若 hash 函数抛异常（如运行时不兼容），不会留下 `enabled=true` 但无 recovery hash 的半损坏状态。

2. **Setup 不签发 trusted device cookie**：nonce-based JWT promotion 已解决当前会话豁免问题。Trusted device cookie 只应在登录验证时由用户主动勾选「记住此设备」后签发。信任授予必须有明确的用户意图，不能作为附带效果自动发生。

3. **Setup 后立即提权**：`verifySetup` 返回 nonce，前端调用 `updateSession()` 提权 JWT，避免刚启用 2FA 就被重定向到 `/verify-2fa`。

### 4.2 登录验证（Login Verification Flow）

```
Google OAuth 成功
  │
  ├─ auth.ts jwt callback (trigger="signIn")
  │   ├─ 查询 DB: isTwoFactorEnabled()
  │   └─ 2FA 启用 → token.twoFactorVerified = false
  │
  ├─ Proxy 拦截请求
  │   ├─ twoFactorVerified = false
  │   ├─ 检查 trusted device cookie
  │   │   ├─ cookie 有效 → isTrusted = true → 放行（redirect /verify-2fa → /）
  │   │   └─ cookie 无效 → redirect → /verify-2fa
  │   └─ 检查 DB twoFactorEnabled（防 JWT 过期脱同步）
  │
  ├─ /verify-2fa 页面
  │   ├─ 模式切换：TOTP 6 位码 / Recovery Code
  │   ├─ 「信任此设备」勾选框
  │   └─ 提交
  │
  └─ POST /api/auth/verify-2fa { token, type, rememberDevice }
      ├─ auth 检查 + 2FA 启用检查
      ├─ 输入验证（TOTP: 6 位数字）
      ├─ TotpService.verifyLogin(token, email, type)
      │   ├─ 暴力破解检查
      │   ├─ type="totp": 解密 → verifyToken
      │   └─ type="recovery": verifyRecoveryCode
      │       └─ 验证成功 → store.set("recoveryCodeUsed", "true")
      ├─ 生成 nonce + 签名
      ├─ 返回 { nonce, nonceSig, recoverySession? }
      │
      ├─ Trusted device cookie 签发决策：
      │   shouldIssueTrustedCookie(type, rememberDevice)
      │   ├─ type="recovery" → 永不签发（break-glass 凭证不授予持久信任）
      │   └─ type="totp" && rememberDevice → 签发 30 天 cookie
      │
      └─ 前端：
          └─ updateSession({ twoFactorNonce, twoFactorSig, recoverySession? })
              └─ JWT callback:
                  ├─ consumeNonce → token.twoFactorVerified = true
                  └─ token.recoverySession = (sessionUpdate.recoverySession === true)
```

**关键安全决策**：

1. **Recovery code 不签发 trusted device cookie**：Recovery code 是 break-glass 凭证，只应完成本次登录，不应签发长期信任。若 recovery code 泄漏，攻击者不仅能登录一次，还能拿到 30 天免验证状态。

2. **Recovery session 标记为 JWT claim**：`recoverySession` 是 session-scoped 的（JWT claim），而非全局持久的（DB flag）。只有通过 recovery code 登录的那个会话才有 force-disable 权限。

### 4.3 正常禁用 2FA

```
Settings 页面 → 输入 6 位 TOTP 码 → POST /api/settings/2fa/disable { token }
  ├─ 暴力破解检查
  ├─ 解密 → verifyToken
  ├─ 验证成功 → 删除所有 totp.* 键
  └─ 返回 { success: true }
```

### 4.4 强制禁用 2FA（Force Disable — Recovery Session Only）

```
前提：当前会话通过 recovery code 登录（session.user.recoverySession = true）

Settings 页面 → 点击「强制关闭」→ POST /api/settings/2fa/disable { force: true }
  ├─ 检查 session.user.recoverySession
  │   └─ false → 403 拒绝
  ├─ TotpService.forceDisable()  ← 无条件执行（caller 负责授权）
  │   └─ 删除所有 totp.* 键
  ├─ 返回 { success: true, clearRecoverySession: true }
  │
  └─ 前端：
      └─ updateSession({ clearRecoverySession: true })
          └─ JWT callback: token.recoverySession = false  ← 显式撤销
```

**关键安全决策**：

1. **Session-scoped 授权**：`forceDisable` 的权限来自 JWT claim `recoverySession`，不是 DB 中的全局 flag。全局 flag 会跨 session 泄漏权限 — 任何 session 使用过 recovery code 后，所有后续 session 都能 force-disable。

2. **显式撤销 recoverySession**：force-disable 成功后，API 返回 `clearRecoverySession: true`，前端调用 `updateSession` 清除 JWT claim。防止同一会话中 force-disable → re-setup → 再次 force-disable 的攻击路径。

3. **Nonce 验证路径也会清除 recoverySession**：当 JWT callback 处理 nonce 验证时，`token.recoverySession = sessionUpdate?.recoverySession === true`。如果 sessionUpdate 中没有显式传 `recoverySession: true`（如正常 TOTP 验证后的 nonce），该 claim 自动清零。

---

## 5. Proxy 访问控制

### 5.1 决策逻辑

Proxy 是**唯一的访问控制执行点**。决策逻辑提取为纯函数 `resolveProxyAction(ctx: ProxyContext)`，独立于 Next.js，有 44 个回归测试覆盖。

```typescript
interface ProxyContext {
  isLoggedIn: boolean;
  pathname: string;
  twoFactorVerified: boolean | undefined;  // JWT claim
  isTrusted: boolean;                       // Cookie check
  twoFactorEnabled: boolean;                // DB truth
}
```

### 5.2 决策表

| isLoggedIn | twoFactorVerified | twoFactorEnabled (DB) | isTrusted | 路径 | 动作 |
|:---:|:---:|:---:|:---:|------|------|
| false | — | — | — | /login | next |
| false | — | — | — | 其他页面 | redirect → /login |
| false | — | — | — | /api/* | 401 JSON |
| true | — | — | — | /login | redirect → / |
| true | false | **false** | — | /verify-2fa | redirect → /（**防死锁**） |
| true | false | **false** | — | 其他 | next（2FA 已关闭，放行） |
| true | false | true | **true** | /verify-2fa | redirect → / |
| true | false | true | **true** | 其他 | next（trusted device 放行） |
| true | false | true | false | /verify-2fa | next（显示验证页） |
| true | false | true | false | 其他页面 | redirect → /verify-2fa |
| true | false | true | false | /api/* | 403 JSON |
| true | true/undefined | — | — | /verify-2fa | redirect → / |
| true | true/undefined | — | — | 其他 | next |

### 5.3 Pre-filter

以下路径在进入决策逻辑**之前**无条件放行：
- `/api/auth/*` — OAuth 流程
- `/api/live` — 健康检查（matcher 排除）
- 静态资源（`_next/static`, `_next/image`, favicons 等 — matcher 排除）

### 5.4 Trusted Device 检查流程

```
proxy.ts → isTrustedDevice(req, email)
  ├─ 读取 cookie "surety-2fa-trusted"
  ├─ getTotpService() → totp.verifyTrustedCookie(value, email)
  │   ├─ 解析 cookie: email | expiry | enrollVersion | signature
  │   ├─ 验证 email 匹配
  │   ├─ 验证未过期
  │   ├─ 验证 enrollVersion 匹配当前值
  │   └─ HMAC-SHA256 签名验证（timingSafeEqual）
  └─ 异常 → false（DB 不可用时 fail closed）
```

### 5.5 DB 回退查询

当 `twoFactorVerified=false` 时，Proxy 额外查询 DB：

```typescript
const { getTotpService } = await import("@/lib/totp");
const totp = await getTotpService();
twoFactorEnabled = totp.isEnabled();
```

DB 不可用时 fail closed（假设 2FA 仍启用）。这确保 Proxy 不会因为查不到 DB 就放行未验证的请求。

---

## 6. JWT 生命周期

### 6.1 JWT Claims

| Claim | 类型 | 含义 | 设置时机 |
|-------|------|------|----------|
| `twoFactorVerified` | `boolean` | 当前会话是否通过显式 nonce 验证 | signIn / update(nonce) |
| `recoverySession` | `boolean` | 当前会话是否通过 recovery code 登录 | update(nonce + recoverySession) |

### 6.2 JWT Callback 状态机

```
trigger="signIn":
  └─ isTwoFactorEnabled() ? false : true → token.twoFactorVerified

trigger="update":
  ├─ 有 nonce + sig:
  │   ├─ consumeNonce() 成功:
  │   │   ├─ token.twoFactorVerified = true
  │   │   └─ token.recoverySession = (sessionUpdate.recoverySession === true)
  │   │       ↑ 未显式传 true 则清为 false（防止 sticky claim）
  │   └─ consumeNonce() 失败: 不变
  │
  └─ 有 clearRecoverySession:
      └─ token.recoverySession = false
```

**关键设计**：

1. **Nonce 单次消费**：nonce 验证成功后从 KV store 删除，无法重放。

2. **recoverySession 同步清除**：在 nonce 验证路径中，`recoverySession` 始终从 `sessionUpdate` 同步。不传 = 清零。这确保：
   - Recovery code 登录 → `updateSession({ nonce, sig, recoverySession: true })` → claim 设为 true
   - 正常 TOTP 验证 → `updateSession({ nonce, sig })` → claim 清为 false
   - Re-setup 2FA 后验证 → claim 清为 false

3. **独立的 clearRecoverySession 信号**：force-disable 后不需要 nonce，但需要清 recoverySession。通过 `updateSession({ clearRecoverySession: true })` 单独处理。

---

## 7. 暴力破解防护

### 7.1 机制

| 参数 | 默认值 |
|------|--------|
| 最大失败次数 | 5 |
| 锁定时长 | 15 分钟 |
| 状态存储 | `totp.failedAttempts` + `totp.lockUntil` |

### 7.2 覆盖范围

所有需要验证 TOTP/Recovery code 的端点均有暴力破解保护：

| 端点 | 保护 |
|------|------|
| `verifySetup` | 有 — 防止猜测正在设置的 Secret |
| `verifyLogin` | 有 — 登录验证 |
| `disable` | 有 — 禁用确认 |
| `forceDisable` | 无需 — 不验证 TOTP（靠 JWT claim 授权） |

### 7.3 流程

```
检查锁定（在 TOTP 运算之前，防 CPU DoS）
  ├─ 已锁定 → 返回 { error, locked: true, retryAfterSeconds }
  └─ 未锁定 → 执行验证
      ├─ 成功 → 重置计数器（failedAttempts=0, lockUntil=null）
      └─ 失败 → recordFailedAttempt
          ├─ attempts < max → 返回剩余次数
          └─ attempts >= max → 设置 lockUntil，返回锁定信息
```

---

## 8. 关键安全决策与教训

本节记录在实现和三方 Review（Claude Code / Codex GPT-5.4 / Gemini）过程中发现并修复的安全问题。

### 8.1 P0: updateSession() 可绕过 2FA

**问题**：原实现中 `trigger === "update"` 无条件设置 `twoFactorVerified=true`。攻击者在浏览器控制台调用 `updateSession({})` 即可绕过 2FA。

**修复**：JWT promotion 必须持有服务端签名的 nonce。`consumeNonce()` 验证 HMAC 签名 + 匹配存储值 + 删除（单次使用）。

### 8.2 P0: API 路由不检查 2FA

**问题**：原 proxy matcher 排除了 `/api/*`，业务 API 对未验证 2FA 的用户完全开放。

**修复**：Proxy matcher 扩展覆盖 API 路由。未验证 2FA 的 API 请求返回 403 JSON。只有 `/api/auth/*` 和 `/api/live` 被 pre-filter 放行。

### 8.3 Recovery Code 不应签发持久信任

**问题**：Recovery code 验证成功后默认签发 30 天 trusted-device cookie。

**影响**：如果 recovery code 泄漏，攻击者不仅能完成一次登录，还能在该浏览器上获得 30 天免验证状态。

**修复**：`shouldIssueTrustedCookie(type, rememberDevice)` — recovery type 永不签发 cookie。

### 8.4 Setup 不应自动签发 Trusted Device Cookie

**问题**：`verify-setup` 路由在首次启用时无条件签发 trusted device cookie，用户从未被询问。

**修复**：移除 cookie 签发。Nonce-based JWT promotion 已解决当前会话问题。Cookie 只在登录验证时按用户意愿签发。

### 8.5 forceDisable 的全局 DB Flag 跨 Session 泄漏

**问题**：`forceDisable()` 检查 DB 中 `recoveryCodeUsed` 全局标记。一旦任何 session 使用了 recovery code，所有后续 session 都能 force-disable。

**修复**：`recoverySession` 改为 session-scoped JWT claim。API 层检查 `session.user.recoverySession`，service 层 `forceDisable()` 无条件执行（caller 负责授权）。

### 8.6 Sticky recoverySession JWT Claim

**问题**：`recoverySession` 只设为 `true`，永远不清为 `false`。同一会话中 force-disable → re-setup → 可再次 force-disable 新 2FA。

**修复**：三个撤销点：
1. Nonce 验证路径：`token.recoverySession = sessionUpdate?.recoverySession === true`（不传即清）
2. Force-disable 后：API 返回 `clearRecoverySession`，前端调用 `updateSession`
3. JWT callback 处理 `clearRecoverySession` 信号

### 8.7 Bun.password 不可在 Next.js Server Runtime 使用

**问题**：`Bun.password.hash/verify` 在 `bun dev` 下正常，部署后在 API route 中触发 `ReferenceError`。

**修复**：使用 `node:crypto` scrypt + `timingSafeEqual` 替代。

**教训**：Bun + Next.js 技术栈中，API route / middleware 必须只使用 Node.js 标准 API。Bun 特有 API 仅限构建脚本和独立进程。

### 8.8 verifySetup 非原子化写入

**问题**：先写 `enabled=true`，再计算 `recoveryCodeHash`。Hash 函数异常时 DB 处于半启用状态。

**修复**：compute all → write all。先计算所有派生值（enrollVersion、recoveryCode、recoveryHash），全部成功后再批量写入。

### 8.9 Settings KV API 暴露 TOTP 敏感数据

**问题**：通用 Settings API 暴露了 `totp.*` 前缀的加密密文和哈希，且可被直接写入 `totp.enabled=false` 关闭 2FA。

**修复**：Settings API 过滤 `totp.*` 前缀，`[key]` 路由拒绝 `totp.*` 读写。

---

## 9. 测试覆盖

### 9.1 TOTP 模块测试

文件：`src/__tests__/totp-module.test.ts`
- **77+ 测试**，100% 行覆盖率和函数覆盖率
- 纯内存 `Map<string, string>` 作为 `TotpStore`，无 DB / 无 env / 无 mock
- 覆盖：加解密、TOTP 生成验证、QR 码、recovery code 全生命周期、暴力破解状态机、cookie 创建验证、nonce 签名验证、完整 setup/verify/login/disable 流程、边界情况

### 9.2 Proxy 决策逻辑测试

文件：`src/__tests__/proxy-logic.test.ts`
- **44 测试**覆盖完整决策表
- 纯函数测试，无 Next.js 依赖
- 覆盖：登录/未登录、2FA 启用/禁用、trusted/untrusted、各路径类型

### 9.3 Pre-commit 集成

```bash
# pre-commit hook 执行
bun run scripts/check-coverage.ts  # 包含 totp-module 测试，覆盖率 ≥ 90%
eslint                              # 零错误零警告
```

---

## 10. 环境变量清单

| 变量 | 必需 | 示例 | 说明 |
|------|:---:|------|------|
| `TOTP_MASTER_KEY` | 是 | `openssl rand -hex 32` | AES-256-GCM 加密密钥 |
| `TOTP_HMAC_SECRET` | 推荐 | `openssl rand -base64 32` | HMAC 签名密钥（fallback: `NEXTAUTH_SECRET`） |
| `NEXTAUTH_SECRET` | 是 | — | NextAuth session 签名 + HMAC fallback |
| `E2E_SKIP_AUTH` | 否 | `true` | E2E 测试时跳过所有 auth/2FA |

---

## 11. 文档关系

```
docs/08-two-factor-auth.md  ← 设计规划 + 三方 Review 记录 + 实施进度
docs/09-totp-module.md      ← 独立模块 API 参考（可移植到其他项目）
docs/10-totp-implementation-details.md  ← 本文档：最终实现详解
```

- **08** 是「计划」和「Review 历史」— 记录了从零到一的决策过程
- **09** 是「模块手册」— 面向复用者的 API 参考
- **10** 是「实现全景」— 面向维护者的完整技术细节 + 安全决策
