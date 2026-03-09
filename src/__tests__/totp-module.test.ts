/**
 * Independent test suite for the TOTP module (src/lib/totp/).
 *
 * Tests the module in isolation — no Surety-specific imports, no process.env coupling.
 * Uses an in-memory TotpStore and explicit TotpConfig.
 */
import { describe, expect, test } from "bun:test";
import * as OTPAuth from "otpauth";
import {
  // Pure crypto functions
  encryptSecret,
  decryptSecret,
  parseMasterKey,
  generateSecret,
  verifyToken,
  generateQRDataURL,
  generateRecoveryCode,
  hashRecoveryCode,
  verifyRecoveryCode,
  normalizeRecoveryCode,
  isLockedOut,
  lockoutRemainingSeconds,
  recordFailedAttempt,
  resetBruteForce,
  createTrustedDeviceCookieValue,
  verifyTrustedDeviceCookie,
  generateVerificationNonce,
  signNonce,
  verifyNonceSignature,
  // Service & types
  TotpService,
  TOTP_SETTINGS_KEYS,
  SENSITIVE_KEY_PREFIX,
  type TotpStore,
  type TotpConfig,
  type BruteForceState,
} from "@/lib/totp/index";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_MASTER_KEY_HEX = "a".repeat(64); // 32-byte hex for testing
const TEST_MASTER_KEY = parseMasterKey(TEST_MASTER_KEY_HEX);
const TEST_HMAC_SECRET = "test-hmac-secret-for-totp-module";
const TEST_ISSUER = "TestApp";
const TEST_COOKIE_NAME = "test-2fa-trusted";

function createTestConfig(overrides?: Partial<TotpConfig>): TotpConfig {
  return {
    issuer: TEST_ISSUER,
    trustedDeviceCookieName: TEST_COOKIE_NAME,
    hmacSecret: TEST_HMAC_SECRET,
    masterKeyHex: TEST_MASTER_KEY_HEX,
    ...overrides,
  };
}

/** In-memory TotpStore for testing */
function createMemoryStore(): TotpStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get(key: string) { return data.get(key); },
    set(key: string, value: string) { data.set(key, value); },
    delete(key: string) { return data.delete(key); },
  };
}

// ===========================================================================
// Pure crypto function tests
// ===========================================================================

describe("parseMasterKey", () => {
  test("parses a valid 64-char hex string", () => {
    const key = parseMasterKey("a".repeat(64));
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  test("rejects short hex", () => {
    expect(() => parseMasterKey("a".repeat(63))).toThrow();
  });

  test("rejects non-hex characters", () => {
    expect(() => parseMasterKey("g".repeat(64))).toThrow();
  });

  test("rejects empty string", () => {
    expect(() => parseMasterKey("")).toThrow();
  });
});

describe("encryptSecret / decryptSecret", () => {
  test("round-trips a secret", () => {
    const original = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptSecret(original, TEST_MASTER_KEY);
    const decrypted = decryptSecret(encrypted, TEST_MASTER_KEY);
    expect(decrypted).toBe(original);
  });

  test("encrypted format is iv:ciphertext:tag (hex)", () => {
    const encrypted = encryptSecret("test", TEST_MASTER_KEY);
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // IV = 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // All parts are hex
    for (const part of parts) {
      expect(part).toMatch(/^[0-9a-f]+$/);
    }
  });

  test("different encryptions produce different ciphertexts (random IV)", () => {
    const plaintext = "SAME_SECRET";
    const enc1 = encryptSecret(plaintext, TEST_MASTER_KEY);
    const enc2 = encryptSecret(plaintext, TEST_MASTER_KEY);
    expect(enc1).not.toBe(enc2);
    // But both decrypt to the same value
    expect(decryptSecret(enc1, TEST_MASTER_KEY)).toBe(plaintext);
    expect(decryptSecret(enc2, TEST_MASTER_KEY)).toBe(plaintext);
  });

  test("throws on tampered ciphertext", () => {
    const encrypted = encryptSecret("secret", TEST_MASTER_KEY);
    const parts = encrypted.split(":");
    const tampered = parts[0] + ":" + "ff" + parts[1]!.slice(2) + ":" + parts[2];
    expect(() => decryptSecret(tampered, TEST_MASTER_KEY)).toThrow();
  });

  test("throws on invalid format", () => {
    expect(() => decryptSecret("onlytwoparts:here", TEST_MASTER_KEY)).toThrow("Invalid encrypted secret format");
  });
});

describe("generateSecret", () => {
  test("returns a base32 string", () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  });

  test("generates unique secrets each time", () => {
    const secrets = new Set(Array.from({ length: 10 }, () => generateSecret()));
    expect(secrets.size).toBe(10);
  });
});

describe("verifyToken", () => {
  test("validates a correct current token", () => {
    const secret = generateSecret();
    const label = "test@example.com";
    const totp = new OTPAuth.TOTP({
      issuer: TEST_ISSUER,
      label,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const token = totp.generate();
    expect(verifyToken(secret, token, label, TEST_ISSUER, 1)).toBe(true);
  });

  test("rejects an incorrect token", () => {
    const secret = generateSecret();
    expect(verifyToken(secret, "000000", "test@example.com", TEST_ISSUER, 1)).toBe(false);
  });

  test("rejects non-6-digit strings", () => {
    const secret = generateSecret();
    expect(verifyToken(secret, "12345", "test@example.com", TEST_ISSUER, 1)).toBe(false);
    expect(verifyToken(secret, "1234567", "test@example.com", TEST_ISSUER, 1)).toBe(false);
    expect(verifyToken(secret, "abcdef", "test@example.com", TEST_ISSUER, 1)).toBe(false);
  });
});

describe("generateQRDataURL", () => {
  test("returns a data URL", async () => {
    const secret = generateSecret();
    const dataURL = await generateQRDataURL(secret, "user@example.com", TEST_ISSUER);
    expect(dataURL).toMatch(/^data:image\/png;base64,/);
  });
});

describe("recovery code", () => {
  test("generateRecoveryCode returns a formatted hex string with dashes", () => {
    const code = generateRecoveryCode(16);
    // 32 hex chars + 7 dashes = 39 chars total
    expect(code).toMatch(/^[0-9a-f]{4}(-[0-9a-f]{4}){7}$/);
  });

  test("generates unique codes each time", () => {
    const codes = new Set(Array.from({ length: 10 }, () => generateRecoveryCode(16)));
    expect(codes.size).toBe(10);
  });

  test("hashRecoveryCode and verifyRecoveryCode round-trip", async () => {
    const code = generateRecoveryCode(16);
    const hash = await hashRecoveryCode(code);
    expect(await verifyRecoveryCode(code, hash)).toBe(true);
  });

  test("verifyRecoveryCode returns false for wrong code", async () => {
    const code = generateRecoveryCode(16);
    const hash = await hashRecoveryCode(code);
    expect(await verifyRecoveryCode("wrong-code-1234-5678", hash)).toBe(false);
  });

  test("verification is case-insensitive and ignores dashes", async () => {
    const code = generateRecoveryCode(16);
    const hash = await hashRecoveryCode(code);
    const variant = code.replace(/-/g, "").toUpperCase();
    expect(await verifyRecoveryCode(variant, hash)).toBe(true);
  });

  test("verification ignores whitespace", async () => {
    const code = generateRecoveryCode(16);
    const hash = await hashRecoveryCode(code);
    const withSpaces = ` ${code.replace(/-/g, " ")} `;
    expect(await verifyRecoveryCode(withSpaces, hash)).toBe(true);
  });

  test("normalizeRecoveryCode strips dashes, whitespace, and lowercases", () => {
    expect(normalizeRecoveryCode("A1B2-C3D4")).toBe("a1b2c3d4");
    expect(normalizeRecoveryCode("  a1b2 c3d4  ")).toBe("a1b2c3d4");
  });
});

describe("brute force protection", () => {
  test("isLockedOut returns false when not locked", () => {
    expect(isLockedOut({ failedAttempts: 3, lockUntil: null })).toBe(false);
  });

  test("isLockedOut returns true when locked (future lockUntil)", () => {
    const future = new Date(Date.now() + 60000).toISOString();
    expect(isLockedOut({ failedAttempts: 5, lockUntil: future })).toBe(true);
  });

  test("isLockedOut returns false when lock has expired", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isLockedOut({ failedAttempts: 5, lockUntil: past })).toBe(false);
  });

  test("lockoutRemainingSeconds returns 0 when not locked", () => {
    expect(lockoutRemainingSeconds({ failedAttempts: 0, lockUntil: null })).toBe(0);
  });

  test("lockoutRemainingSeconds returns positive value when locked", () => {
    const future = new Date(Date.now() + 120000).toISOString(); // 2 min
    const remaining = lockoutRemainingSeconds({ failedAttempts: 5, lockUntil: future });
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(120);
  });

  test("recordFailedAttempt increments count", () => {
    const state: BruteForceState = { failedAttempts: 2, lockUntil: null };
    const next = recordFailedAttempt(state, 5, 15);
    expect(next.failedAttempts).toBe(3);
    expect(next.lockUntil).toBeNull();
  });

  test("recordFailedAttempt triggers lockout at max attempts", () => {
    const state: BruteForceState = { failedAttempts: 4, lockUntil: null };
    const next = recordFailedAttempt(state, 5, 15);
    expect(next.failedAttempts).toBe(5);
    expect(next.lockUntil).not.toBeNull();
    const lockTime = new Date(next.lockUntil!).getTime();
    const expected = Date.now() + 15 * 60 * 1000;
    expect(Math.abs(lockTime - expected)).toBeLessThan(2000);
  });

  test("resetBruteForce returns clean state", () => {
    const state = resetBruteForce();
    expect(state.failedAttempts).toBe(0);
    expect(state.lockUntil).toBeNull();
  });
});

describe("trusted device cookie", () => {
  test("creates and verifies a cookie value", () => {
    const email = "user@example.com";
    const cookieValue = createTrustedDeviceCookieValue(email, "v1", TEST_HMAC_SECRET, 30);
    expect(verifyTrustedDeviceCookie(cookieValue, email, TEST_HMAC_SECRET, "v1")).toBe(true);
  });

  test("rejects cookie with wrong email", () => {
    const cookieValue = createTrustedDeviceCookieValue("user@example.com", "v1", TEST_HMAC_SECRET, 30);
    expect(verifyTrustedDeviceCookie(cookieValue, "other@example.com", TEST_HMAC_SECRET, "v1")).toBe(false);
  });

  test("rejects tampered signature", () => {
    const email = "user@example.com";
    const cookieValue = createTrustedDeviceCookieValue(email, "v1", TEST_HMAC_SECRET, 30);
    const parts = cookieValue.split("|");
    const tampered = parts.slice(0, -1).join("|") + "|" + "f".repeat(64);
    expect(verifyTrustedDeviceCookie(tampered, email, TEST_HMAC_SECRET, "v1")).toBe(false);
  });

  test("rejects invalid format", () => {
    expect(verifyTrustedDeviceCookie("invalid", "user@example.com", TEST_HMAC_SECRET)).toBe(false);
    expect(verifyTrustedDeviceCookie("a|b", "user@example.com", TEST_HMAC_SECRET)).toBe(false);
    expect(verifyTrustedDeviceCookie("a|b|c", "user@example.com", TEST_HMAC_SECRET)).toBe(false);
  });

  test("cookie value contains email, expiry, and enrollVersion", () => {
    const email = "user@example.com";
    const cookieValue = createTrustedDeviceCookieValue(email, "v1", TEST_HMAC_SECRET, 30);
    const parts = cookieValue.split("|");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe(email);
    expect(new Date(parts[1]!).toISOString()).toBe(parts[1]!);
    expect(parts[2]).toBe("v1");
  });

  test("rejects cookie with wrong enrollment version", () => {
    const email = "user@example.com";
    const cookieValue = createTrustedDeviceCookieValue(email, "v1", TEST_HMAC_SECRET, 30);
    expect(verifyTrustedDeviceCookie(cookieValue, email, TEST_HMAC_SECRET, "v2")).toBe(false);
  });

  test("accepts cookie when no enrollment version check is required", () => {
    const email = "user@example.com";
    const cookieValue = createTrustedDeviceCookieValue(email, "v1", TEST_HMAC_SECRET, 30);
    expect(verifyTrustedDeviceCookie(cookieValue, email, TEST_HMAC_SECRET)).toBe(true);
  });

  test("rejects cookie signed with different HMAC secret", () => {
    const email = "user@example.com";
    const cookieValue = createTrustedDeviceCookieValue(email, "v1", "secret-a", 30);
    expect(verifyTrustedDeviceCookie(cookieValue, email, "secret-b", "v1")).toBe(false);
  });
});

describe("verification nonce", () => {
  test("generateVerificationNonce returns 64-char hex string", () => {
    const nonce = generateVerificationNonce();
    expect(nonce).toMatch(/^[0-9a-f]{64}$/);
  });

  test("generates unique nonces each time", () => {
    const nonces = new Set(Array.from({ length: 10 }, () => generateVerificationNonce()));
    expect(nonces.size).toBe(10);
  });

  test("signNonce returns a hex string", () => {
    const nonce = generateVerificationNonce();
    const sig = signNonce(nonce, TEST_HMAC_SECRET);
    expect(sig).toMatch(/^[0-9a-f]+$/);
  });

  test("verifyNonceSignature validates correct signature", () => {
    const nonce = generateVerificationNonce();
    const sig = signNonce(nonce, TEST_HMAC_SECRET);
    expect(verifyNonceSignature(nonce, sig, TEST_HMAC_SECRET)).toBe(true);
  });

  test("verifyNonceSignature rejects wrong signature", () => {
    const nonce = generateVerificationNonce();
    expect(verifyNonceSignature(nonce, "f".repeat(64), TEST_HMAC_SECRET)).toBe(false);
  });

  test("verifyNonceSignature rejects signature for different nonce", () => {
    const nonce1 = generateVerificationNonce();
    const nonce2 = generateVerificationNonce();
    const sig1 = signNonce(nonce1, TEST_HMAC_SECRET);
    expect(verifyNonceSignature(nonce2, sig1, TEST_HMAC_SECRET)).toBe(false);
  });

  test("verifyNonceSignature rejects with different HMAC secret", () => {
    const nonce = generateVerificationNonce();
    const sig = signNonce(nonce, "secret-a");
    expect(verifyNonceSignature(nonce, sig, "secret-b")).toBe(false);
  });
});

describe("TOTP_SETTINGS_KEYS", () => {
  test("has all expected keys", () => {
    expect(TOTP_SETTINGS_KEYS.enabled).toBe("totp.enabled");
    expect(TOTP_SETTINGS_KEYS.encryptedSecret).toBe("totp.encryptedSecret");
    expect(TOTP_SETTINGS_KEYS.recoveryCodeHash).toBe("totp.recoveryCodeHash");
    expect(TOTP_SETTINGS_KEYS.recoveryCodeUsed).toBe("totp.recoveryCodeUsed");
    expect(TOTP_SETTINGS_KEYS.failedAttempts).toBe("totp.failedAttempts");
    expect(TOTP_SETTINGS_KEYS.lockUntil).toBe("totp.lockUntil");
    expect(TOTP_SETTINGS_KEYS.enrollVersion).toBe("totp.enrollVersion");
    expect(TOTP_SETTINGS_KEYS.twoFactorNonce).toBe("totp.twoFactorNonce");
  });
});

describe("SENSITIVE_KEY_PREFIX", () => {
  test("is 'totp.'", () => {
    expect(SENSITIVE_KEY_PREFIX).toBe("totp.");
  });

  test("all TOTP_SETTINGS_KEYS start with the prefix", () => {
    for (const key of Object.values(TOTP_SETTINGS_KEYS)) {
      expect(key.startsWith(SENSITIVE_KEY_PREFIX)).toBe(true);
    }
  });
});

// ===========================================================================
// TotpService integration tests (with in-memory store)
// ===========================================================================

describe("TotpService", () => {
  function createService(overrides?: Partial<TotpConfig>) {
    const store = createMemoryStore();
    const config = createTestConfig(overrides);
    const service = new TotpService(store, config);
    return { service, store };
  }

  describe("isEnabled / getStatus", () => {
    test("returns false when nothing is set", () => {
      const { service } = createService();
      expect(service.isEnabled()).toBe(false);
    });

    test("returns true when enabled=true in store", () => {
      const { service, store } = createService();
      store.set(TOTP_SETTINGS_KEYS.enabled, "true");
      expect(service.isEnabled()).toBe(true);
    });

    test("getStatus returns enabled and recovery code status", () => {
      const { service, store } = createService();
      expect(service.getStatus()).toEqual({ enabled: false, recoveryCodeUsed: false });

      store.set(TOTP_SETTINGS_KEYS.enabled, "true");
      store.set(TOTP_SETTINGS_KEYS.recoveryCodeUsed, "true");
      expect(service.getStatus()).toEqual({ enabled: true, recoveryCodeUsed: true });
    });

    test("getStatus hides recovery code status when disabled", () => {
      const { service, store } = createService();
      store.set(TOTP_SETTINGS_KEYS.recoveryCodeUsed, "true");
      expect(service.getStatus()).toEqual({ enabled: false, recoveryCodeUsed: false });
    });
  });

  describe("setup", () => {
    test("generates QR code and stores encrypted secret", async () => {
      const { service, store } = createService();
      const result = await service.setup("user@example.com");

      expect(result.qrDataURL).toMatch(/^data:image\/png;base64,/);
      expect(result.secret).toMatch(/^[A-Z2-7]+=*$/);
      expect(store.get(TOTP_SETTINGS_KEYS.encryptedSecret)).toBeDefined();
      expect(store.get(TOTP_SETTINGS_KEYS.enabled)).toBe("false");
    });
  });

  describe("verifySetup", () => {
    test("enables 2FA on valid token and returns recovery code", async () => {
      const { service, store } = createService();
      const setupResult = await service.setup("user@example.com");

      // Generate valid token
      const totp = new OTPAuth.TOTP({
        issuer: TEST_ISSUER,
        label: "user@example.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(setupResult.secret),
      });
      const token = totp.generate();

      const result = await service.verifySetup(token, "user@example.com");
      expect("success" in result && result.success).toBe(true);
      expect("recoveryCode" in result).toBe(true);
      expect(store.get(TOTP_SETTINGS_KEYS.enabled)).toBe("true");
      expect(store.get(TOTP_SETTINGS_KEYS.enrollVersion)).toBeDefined();
      expect(store.get(TOTP_SETTINGS_KEYS.recoveryCodeHash)).toBeDefined();
    });

    test("returns nonce + sig for JWT promotion on success", async () => {
      const { service, store } = createService();
      const setupResult = await service.setup("user@example.com");

      const totp = new OTPAuth.TOTP({
        issuer: TEST_ISSUER,
        label: "user@example.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(setupResult.secret),
      });
      const token = totp.generate();

      const result = await service.verifySetup(token, "user@example.com");
      expect("nonce" in result).toBe(true);
      expect("nonceSig" in result).toBe(true);
      if ("nonce" in result && "nonceSig" in result) {
        expect(typeof result.nonce).toBe("string");
        expect(typeof result.nonceSig).toBe("string");
        // Nonce should be stored for consumption by auth layer
        expect(store.get(TOTP_SETTINGS_KEYS.twoFactorNonce)).toBe(result.nonce);
        // Nonce should be consumable
        expect(service.consumeNonce(result.nonce, result.nonceSig)).toBe(true);
        // Can't reuse
        expect(service.consumeNonce(result.nonce, result.nonceSig)).toBe(false);
      }
    });

    test("returns error on invalid token", async () => {
      const { service } = createService();
      await service.setup("user@example.com");

      const result = await service.verifySetup("000000", "user@example.com");
      expect("error" in result).toBe(true);
    });

    test("returns error when no setup in progress", async () => {
      const { service } = createService();

      const result = await service.verifySetup("123456", "user@example.com");
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("No 2FA setup in progress");
      }
    });
  });

  describe("verifyLogin", () => {
    async function setupEnabled() {
      const { service, store } = createService();
      const setupResult = await service.setup("user@example.com");

      // Generate valid token and complete setup
      const totpInstance = new OTPAuth.TOTP({
        issuer: TEST_ISSUER,
        label: "user@example.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(setupResult.secret),
      });
      const token = totpInstance.generate();
      await service.verifySetup(token, "user@example.com");

      return { service, store, secret: setupResult.secret, totpInstance };
    }

    test("returns nonce on valid TOTP token", async () => {
      const { service, totpInstance } = await setupEnabled();
      const token = totpInstance.generate();

      const result = await service.verifyLogin(token, "user@example.com");
      expect("success" in result && result.success).toBe(true);
      expect("nonce" in result).toBe(true);
      expect("nonceSig" in result).toBe(true);
    });

    test("returns error on invalid token", async () => {
      const { service } = await setupEnabled();

      const result = await service.verifyLogin("000000", "user@example.com");
      expect("error" in result).toBe(true);
    });

    test("locks out after max failed attempts", async () => {
      const { service } = await setupEnabled();

      // Use up all attempts
      for (let i = 0; i < 5; i++) {
        await service.verifyLogin("000000", "user@example.com");
      }

      // Next attempt should be locked
      const result = await service.verifyLogin("000000", "user@example.com");
      expect("locked" in result && result.locked).toBe(true);
    });

    test("recovery code works and marks as used", async () => {
      const { service, store } = createService();
      const setupResult = await service.setup("user@example.com");

      // Complete setup to get recovery code
      const totpInstance = new OTPAuth.TOTP({
        issuer: TEST_ISSUER,
        label: "user@example.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(setupResult.secret),
      });
      const setupToken = totpInstance.generate();
      const verifyResult = await service.verifySetup(setupToken, "user@example.com");
      expect("recoveryCode" in verifyResult).toBe(true);

      const recoveryCode = (verifyResult as { recoveryCode: string }).recoveryCode;

      // Use recovery code
      const loginResult = await service.verifyLogin(recoveryCode, "user@example.com", "recovery");
      expect("success" in loginResult && loginResult.success).toBe(true);
      expect(store.get(TOTP_SETTINGS_KEYS.recoveryCodeUsed)).toBe("true");

      // Can't reuse recovery code
      const reuse = await service.verifyLogin(recoveryCode, "user@example.com", "recovery");
      expect("error" in reuse).toBe(true);
      if ("error" in reuse) {
        expect(reuse.error).toContain("already been used");
      }
    });
  });

  describe("disable", () => {
    test("disables 2FA on valid token", async () => {
      const { service, store } = createService();
      const setupResult = await service.setup("user@example.com");

      const totpInstance = new OTPAuth.TOTP({
        issuer: TEST_ISSUER,
        label: "user@example.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(setupResult.secret),
      });
      let token = totpInstance.generate();
      await service.verifySetup(token, "user@example.com");
      expect(service.isEnabled()).toBe(true);

      // Disable with fresh token
      token = totpInstance.generate();
      const result = service.disable(token, "user@example.com");
      expect("success" in result && result.success).toBe(true);
      expect(service.isEnabled()).toBe(false);

      // All TOTP keys should be deleted
      for (const key of Object.values(TOTP_SETTINGS_KEYS)) {
        expect(store.get(key)).toBeUndefined();
      }
    });

    test("returns error when not enabled", () => {
      const { service } = createService();
      const result = service.disable("123456", "user@example.com");
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("not enabled");
      }
    });
  });

  describe("forceDisable", () => {
    async function setupEnabled() {
      const { service, store } = createService();
      const setupResult = await service.setup("user@example.com");

      const totpInstance = new OTPAuth.TOTP({
        issuer: TEST_ISSUER,
        label: "user@example.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(setupResult.secret),
      });
      const token = totpInstance.generate();
      await service.verifySetup(token, "user@example.com");

      return { service, store };
    }

    test("unconditionally disables 2FA when enabled", async () => {
      const { service, store } = await setupEnabled();
      expect(service.isEnabled()).toBe(true);

      const result = service.forceDisable();
      expect("success" in result && result.success).toBe(true);
      expect(service.isEnabled()).toBe(false);

      // All TOTP keys should be deleted
      for (const key of Object.values(TOTP_SETTINGS_KEYS)) {
        expect(store.get(key)).toBeUndefined();
      }
    });

    test("works regardless of recovery code usage status", async () => {
      // forceDisable no longer checks recoveryCodeUsed — caller handles authorization
      const { service } = await setupEnabled();
      expect(service.isEnabled()).toBe(true);

      const result = service.forceDisable();
      expect("success" in result && result.success).toBe(true);
      expect(service.isEnabled()).toBe(false);
    });

    test("also works when recovery code has been used", async () => {
      const { service, store } = createService();
      const setupResult = await service.setup("user@example.com");

      const totpInstance = new OTPAuth.TOTP({
        issuer: TEST_ISSUER,
        label: "user@example.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(setupResult.secret),
      });
      const token = totpInstance.generate();
      const verifyResult = await service.verifySetup(token, "user@example.com");
      const recoveryCode = (verifyResult as { recoveryCode: string }).recoveryCode;

      // Use recovery code
      await service.verifyLogin(recoveryCode, "user@example.com", "recovery");
      expect(store.get(TOTP_SETTINGS_KEYS.recoveryCodeUsed)).toBe("true");

      const result = service.forceDisable();
      expect("success" in result && result.success).toBe(true);
      expect(service.isEnabled()).toBe(false);
    });

    test("returns error when 2FA is not enabled", () => {
      const { service } = createService();
      const result = service.forceDisable();
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("not enabled");
      }
    });
  });

  describe("consumeNonce", () => {
    test("consumes a valid nonce", () => {
      const { service, store } = createService();
      const nonce = generateVerificationNonce();
      const sig = signNonce(nonce, TEST_HMAC_SECRET);
      store.set(TOTP_SETTINGS_KEYS.twoFactorNonce, nonce);

      expect(service.consumeNonce(nonce, sig)).toBe(true);
      // Nonce should be deleted after consumption
      expect(store.get(TOTP_SETTINGS_KEYS.twoFactorNonce)).toBeUndefined();
    });

    test("rejects invalid signature", () => {
      const { service, store } = createService();
      const nonce = generateVerificationNonce();
      store.set(TOTP_SETTINGS_KEYS.twoFactorNonce, nonce);

      expect(service.consumeNonce(nonce, "f".repeat(64))).toBe(false);
    });

    test("rejects nonce not in store", () => {
      const { service } = createService();
      const nonce = generateVerificationNonce();
      const sig = signNonce(nonce, TEST_HMAC_SECRET);

      expect(service.consumeNonce(nonce, sig)).toBe(false);
    });

    test("prevents nonce reuse", () => {
      const { service, store } = createService();
      const nonce = generateVerificationNonce();
      const sig = signNonce(nonce, TEST_HMAC_SECRET);
      store.set(TOTP_SETTINGS_KEYS.twoFactorNonce, nonce);

      expect(service.consumeNonce(nonce, sig)).toBe(true);
      expect(service.consumeNonce(nonce, sig)).toBe(false); // already consumed
    });
  });

  describe("trusted device cookie via service", () => {
    test("createTrustedCookieValue and verifyTrustedCookie round-trip", async () => {
      const { service, store } = createService();
      store.set(TOTP_SETTINGS_KEYS.enrollVersion, "42");

      const cookieValue = service.createTrustedCookieValue("user@example.com");
      expect(service.verifyTrustedCookie(cookieValue, "user@example.com")).toBe(true);
    });

    test("rejects cookie for wrong email", async () => {
      const { service, store } = createService();
      store.set(TOTP_SETTINGS_KEYS.enrollVersion, "42");

      const cookieValue = service.createTrustedCookieValue("user@example.com");
      expect(service.verifyTrustedCookie(cookieValue, "other@example.com")).toBe(false);
    });

    test("rejects cookie after enrollment version change", async () => {
      const { service, store } = createService();
      store.set(TOTP_SETTINGS_KEYS.enrollVersion, "42");
      const cookieValue = service.createTrustedCookieValue("user@example.com");

      // Change enrollment version (simulating 2FA re-enrollment)
      store.set(TOTP_SETTINGS_KEYS.enrollVersion, "99");
      expect(service.verifyTrustedCookie(cookieValue, "user@example.com")).toBe(false);
    });

    test("trustedDeviceCookieName returns configured name", () => {
      const { service } = createService();
      expect(service.trustedDeviceCookieName).toBe(TEST_COOKIE_NAME);
    });

    test("trustedDeviceMaxAge returns days in seconds", () => {
      const { service } = createService({ trustedDeviceDays: 7 });
      expect(service.trustedDeviceMaxAge).toBe(7 * 24 * 60 * 60);
    });
  });

  describe("configurable defaults", () => {
    test("maxFailedAttempts defaults to 5", () => {
      const { service } = createService();
      expect(service.maxFailedAttempts).toBe(5);
    });

    test("maxFailedAttempts can be overridden", () => {
      const { service } = createService({ maxFailedAttempts: 3 });
      expect(service.maxFailedAttempts).toBe(3);
    });
  });
});
