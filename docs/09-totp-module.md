# 09 — TOTP Module (Independent / Reusable)

Date: 2026-03-09
Status: Complete

## Overview

A self-contained TOTP two-factor authentication module with **zero coupling to any host application**. Originally extracted from the Surety 2FA implementation (see `docs/08-two-factor-auth.md`), but designed to be dropped into any TypeScript/Bun project.

**Location**: `src/lib/totp/`

## Architecture

```
src/lib/totp/
├── types.ts       # Interfaces, result types, constants
├── crypto.ts      # Pure parameterized functions (no process.env)
├── service.ts     # TotpService class (business operations)
└── index.ts       # Barrel export
```

### Design Principles

1. **No `process.env` access** — All config is passed explicitly via `TotpConfig`
2. **No framework coupling** — No Next.js, NextAuth, or ORM imports
3. **Dependency injection** — Storage via `TotpStore` interface, not concrete DB
4. **Pure functions in crypto.ts** — Every function takes explicit parameters, easily testable
5. **Service layer in service.ts** — Stateful operations via `TotpService` class

### Dependency Graph

```
index.ts (barrel)
  ├── service.ts → crypto.ts, types.ts
  ├── crypto.ts → otpauth, qrcode, node:crypto
  └── types.ts  → (none)
```

External dependencies: `otpauth`, `qrcode`, `node:crypto` (built-in), `Bun.password` (for bcrypt hashing).

## Integration Pattern

The module is integrated into a host app through a thin **adapter file** that:

1. Reads environment variables
2. Binds a concrete KV store implementation to `TotpStore`
3. Creates a lazy singleton `TotpService`
4. Re-exports everything for backward-compatible imports

Example adapter (Surety's `src/lib/totp.ts`):

```typescript
import { TotpService, type TotpStore, type TotpConfig } from "./totp/index";

let _service: TotpService | null = null;

export async function getTotpService(): Promise<TotpService> {
  if (_service) return _service;

  const { settingsRepo } = await import("@/db/repositories/settings");
  const store: TotpStore = {
    get: (key) => settingsRepo.get(key),
    set: (key, value) => { settingsRepo.set(key, value); },
    delete: (key) => settingsRepo.delete(key),
  };

  const config: TotpConfig = {
    issuer: "MyApp",
    trustedDeviceCookieName: "myapp-2fa-trusted",
    hmacSecret: process.env.TOTP_HMAC_SECRET!,
    masterKeyHex: process.env.TOTP_MASTER_KEY!,
  };

  _service = new TotpService(store, config);
  return _service;
}
```

## API Reference

### TotpStore Interface

The only external dependency. Implement this to connect the module to your storage backend.

```typescript
interface TotpStore {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): boolean;
}
```

Compatible with any KV store: SQLite settings table, Redis, `Map<string, string>`, filesystem, etc.

### TotpConfig

```typescript
interface TotpConfig {
  issuer: string;               // Shown in authenticator apps (e.g. "MyApp")
  trustedDeviceCookieName: string; // Cookie name for trusted device
  hmacSecret: string;           // HMAC secret for signing cookies/nonces
  masterKeyHex: string;         // 64-char hex string (32 bytes) for AES-256-GCM

  // Optional (defaults shown):
  window?: number;              // TOTP time window tolerance (default: 1 = ±30s)
  maxFailedAttempts?: number;   // Brute force threshold (default: 5)
  lockoutMinutes?: number;      // Lockout duration (default: 15)
  trustedDeviceDays?: number;   // Cookie lifetime (default: 30)
  recoveryCodeBytes?: number;   // Recovery code entropy (default: 16 = 32 hex chars)
}
```

### TotpService Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `isEnabled()` | `boolean` | Check if 2FA is enabled |
| `getStatus()` | `StatusResult` | Get enabled state + recovery code usage |
| `setup(email)` | `Promise<SetupResult>` | Generate secret + QR code (does not enable yet) |
| `verifySetup(token, email)` | `Promise<VerifySetupResult \| BruteForceError \| {error}>` | Confirm setup, enable 2FA, return recovery code |
| `verifyLogin(token, email, type?)` | `Promise<VerifyLoginResult \| BruteForceError \| {error}>` | Verify TOTP or recovery code, return signed nonce |
| `disable(token, email)` | `BruteForceError \| {error} \| {success}` | Disable 2FA (requires valid token) |
| `consumeNonce(nonce, signature)` | `boolean` | Consume single-use verification nonce |
| `createTrustedCookieValue(email)` | `string` | Create HMAC-signed trusted device cookie |
| `verifyTrustedCookie(value, email)` | `boolean` | Verify trusted device cookie signature + expiry |
| `checkLockout()` | `BruteForceError \| null` | Check if account is locked out |

### Getters

| Getter | Type | Description |
|--------|------|-------------|
| `trustedDeviceCookieName` | `string` | Cookie name from config |
| `trustedDeviceMaxAge` | `number` | Cookie max-age in seconds |
| `maxFailedAttempts` | `number` | Brute force threshold |

### Result Types

```typescript
interface SetupResult { qrDataURL: string; secret: string }
interface VerifySetupResult { success: true; recoveryCode: string }
interface VerifyLoginResult { success: true; nonce: string; nonceSig: string }
interface StatusResult { enabled: boolean; recoveryCodeUsed: boolean }
interface BruteForceError { error: string; locked: boolean; retryAfterSeconds?: number }
```

### Pure Crypto Functions (crypto.ts)

All exported from `index.ts` for direct use or testing:

| Function | Purpose |
|----------|---------|
| `encryptSecret(plaintext, masterKey)` | AES-256-GCM encrypt |
| `decryptSecret(stored, masterKey)` | AES-256-GCM decrypt |
| `parseMasterKey(hex)` | Validate and parse 64-char hex → Buffer |
| `generateSecret()` | Generate 160-bit TOTP secret (base32) |
| `createTOTP(secret, label, issuer)` | Create OTPAuth.TOTP instance |
| `verifyToken(secret, token, label, issuer, window)` | Verify 6-digit TOTP token |
| `generateQRDataURL(secret, label, issuer)` | Generate QR code data URL |
| `generateRecoveryCode(bytes)` | Generate formatted recovery code |
| `hashRecoveryCode(code)` | Bcrypt hash recovery code |
| `verifyRecoveryCode(code, hash)` | Verify recovery code against hash |
| `normalizeRecoveryCode(code)` | Strip dashes/whitespace, lowercase |
| `isLockedOut(state)` | Check if brute force lockout is active |
| `lockoutRemainingSeconds(state)` | Get remaining lockout time |
| `recordFailedAttempt(state, max, minutes)` | Update brute force state |
| `resetBruteForce()` | Reset to zero state |
| `createTrustedDeviceCookieValue(email, ver, secret, days)` | Create HMAC-signed cookie |
| `verifyTrustedDeviceCookie(value, email, secret, ver?)` | Verify cookie |
| `generateVerificationNonce()` | Generate 32-byte random nonce |
| `signNonce(nonce, secret)` | HMAC-SHA256 sign nonce |
| `verifyNonceSignature(nonce, sig, secret)` | Verify nonce signature (timing-safe) |

### Constants

```typescript
const TOTP_SETTINGS_KEYS = {
  enabled: "totp.enabled",
  encryptedSecret: "totp.encryptedSecret",
  recoveryCodeHash: "totp.recoveryCodeHash",
  recoveryCodeUsed: "totp.recoveryCodeUsed",
  failedAttempts: "totp.failedAttempts",
  lockUntil: "totp.lockUntil",
  enrollVersion: "totp.enrollVersion",
  twoFactorNonce: "totp.twoFactorNonce",
};

const SENSITIVE_KEY_PREFIX = "totp.";  // Block from generic KV APIs
```

## Storage Keys

All module state is stored in the KV store under the `totp.` prefix:

| Key | Value | Description |
|-----|-------|-------------|
| `totp.enabled` | `"true"` / `"false"` | Whether 2FA is active |
| `totp.encryptedSecret` | `"{iv}:{ct}:{tag}"` | AES-256-GCM encrypted TOTP secret |
| `totp.recoveryCodeHash` | bcrypt hash | Hashed recovery code |
| `totp.recoveryCodeUsed` | `"true"` / `"false"` | Whether recovery code was consumed |
| `totp.failedAttempts` | `"0"` ~ `"5"` | Consecutive failed attempts |
| `totp.lockUntil` | ISO 8601 | Lockout expiry timestamp |
| `totp.enrollVersion` | epoch ms string | Used to invalidate trusted cookies on re-enrollment |
| `totp.twoFactorNonce` | 64-char hex | Single-use verification nonce |

## Security Properties

| Property | Implementation |
|----------|---------------|
| Secret encryption | AES-256-GCM with 96-bit random IV |
| Master key | 32-byte hex, validated on construction |
| Cookie signing | HMAC-SHA256 with dedicated secret |
| Nonce signing | HMAC-SHA256, single-use (consumed after verification) |
| Timing attacks | `crypto.timingSafeEqual` for all signature comparisons |
| Brute force | Configurable max attempts + lockout duration |
| Recovery code | Bcrypt hashed, single-use |
| Cookie invalidation | Bound to enrollment version — re-enabling 2FA invalidates all existing cookies |
| Key separation | HMAC secret and master key are independent of auth secrets |

## Testing

Independent test suite: `src/__tests__/totp-module.test.ts`

- **73 tests** covering all module functionality
- **100% line and function coverage** on all 4 module files
- Uses in-memory `Map<string, string>` as `TotpStore` — no database, no env vars
- Tests are fully self-contained and portable

Run:
```bash
bun test src/__tests__/totp-module.test.ts
```

### Test Coverage Areas

1. **crypto.ts**: encrypt/decrypt round-trip, master key validation, TOTP generation/verification, QR generation, recovery code lifecycle, brute force state machine, cookie creation/verification, nonce signing/verification
2. **service.ts**: full setup flow, verify-setup flow (success + errors), login verification (TOTP + recovery), disable flow, nonce consumption, trusted cookie operations, brute force integration, edge cases (corrupted state, already enabled, etc.)
3. **types.ts**: constant values, key prefix validation
4. **index.ts**: barrel export completeness

## Environment Variables

When integrating, the adapter needs these env vars (or equivalent):

| Variable | Example | Description |
|----------|---------|-------------|
| `TOTP_MASTER_KEY` | `openssl rand -hex 32` | 32-byte hex for AES-256-GCM encryption |
| `TOTP_HMAC_SECRET` | `openssl rand -base64 32` | Dedicated HMAC secret (NOT the auth secret) |

## Porting to Another Project

1. Copy `src/lib/totp/` directory (4 files)
2. Install dependencies: `bun add otpauth qrcode @types/qrcode`
3. Write an adapter file that implements `TotpStore` with your storage backend
4. Create `TotpConfig` with your app's issuer name and secrets
5. Instantiate `TotpService` and wire it into your auth/API layer
6. Copy `src/__tests__/totp-module.test.ts` for validation (adjust import paths)
