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
    async get(key: string) { return data.get(key); },
    async set(key: string, value: string) { data.set(key, value); },
    async delete(key: string) { return data.delete(key); },
  };
}

// ===========================================================================
// Pure crypto function tests
// ===========================================================================

describe("parseMasterKey", () => {
  test("parses valid 64-char hex and rejects invalid inputs", () => {
    const key = parseMasterKey("a".repeat(64));
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
    
    // Invalid inputs
    expect(() => parseMasterKey("a".repeat(63))).toThrow();
    expect(() => parseMasterKey("g".repeat(64))).toThrow();
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
    const tampered = parts[0] + ":" + "ff" + (parts[1] as string).slice(2) + ":" + parts[2];
    expect(() => decryptSecret(tampered, TEST_MASTER_KEY)).toThrow();
  });

  test("throws on invalid format", () => {
    expect(() => decryptSecret("onlytwoparts:here", TEST_MASTER_KEY)).toThrow("Invalid encrypted secret format");
  });
});

describe("generateSecret", () => {
  test("returns unique base32 strings", () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
    const secrets = new Set(Array.from({ length: 5 }, () => generateSecret()));
    expect(secrets.size).toBe(5);
  });
});

describe("verifyToken", () => {
  test("validates correct tokens and rejects invalid ones", () => {
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
    // Valid token
    expect(verifyToken(secret, totp.generate(), label, TEST_ISSUER, 1)).toBe(true);
    // Invalid tokens
    expect(verifyToken(secret, "000000", label, TEST_ISSUER, 1)).toBe(false);
    expect(verifyToken(secret, "12345", label, TEST_ISSUER, 1)).toBe(false);
    expect(verifyToken(secret, "abcdef", label, TEST_ISSUER, 1)).toBe(false);
  });
});

describe("generateQRDataURL", () => {
  test("returns a data URL", async () => {
    const secret = generateSecret();
    const dataURL = await generateQRDataURL(secret, "user@example.com", TEST_ISSUER);
    expect(dataURL).toMatch(/^data:image\/png;base64,/);
  });
});

describe.concurrent("recovery code", () => {
  test("generates unique formatted hex codes", () => {
    const code = generateRecoveryCode(16);
    expect(code).toMatch(/^[0-9a-f]{4}(-[0-9a-f]{4}){7}$/);
    const codes = new Set(Array.from({ length: 5 }, () => generateRecoveryCode(16)));
    expect(codes.size).toBe(5);
  });

  test("hash and verify round-trip with normalization", async () => {
    const code = generateRecoveryCode(16);
    const hash = await hashRecoveryCode(code);
    // Valid verification
    expect(await verifyRecoveryCode(code, hash)).toBe(true);
    // Wrong code
    expect(await verifyRecoveryCode("wrong-code-1234-5678", hash)).toBe(false);
    // Normalized variants (case-insensitive, dashes/whitespace ignored)
    expect(await verifyRecoveryCode(code.replace(/-/g, "").toUpperCase(), hash)).toBe(true);
  });

  test("normalizeRecoveryCode strips dashes, whitespace, and lowercases", () => {
    expect(normalizeRecoveryCode("A1B2-C3D4")).toBe("a1b2c3d4");
    expect(normalizeRecoveryCode("  a1b2 c3d4  ")).toBe("a1b2c3d4");
  });
});

describe("brute force protection", () => {
  test("isLockedOut checks lockUntil against current time", () => {
    expect(isLockedOut({ failedAttempts: 3, lockUntil: null })).toBe(false);
    expect(isLockedOut({ failedAttempts: 5, lockUntil: new Date(Date.now() + 60000).toISOString() })).toBe(true);
    expect(isLockedOut({ failedAttempts: 5, lockUntil: new Date(Date.now() - 1000).toISOString() })).toBe(false);
  });

  test("lockoutRemainingSeconds returns seconds until unlock", () => {
    expect(lockoutRemainingSeconds({ failedAttempts: 0, lockUntil: null })).toBe(0);
    const future = new Date(Date.now() + 120000).toISOString();
    const remaining = lockoutRemainingSeconds({ failedAttempts: 5, lockUntil: future });
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(120);
  });

  test("recordFailedAttempt increments and triggers lockout at max", () => {
    // Increment without lockout
    let next = recordFailedAttempt({ failedAttempts: 2, lockUntil: null }, 5, 15);
    expect(next.failedAttempts).toBe(3);
    expect(next.lockUntil).toBeNull();
    // Trigger lockout at max
    next = recordFailedAttempt({ failedAttempts: 4, lockUntil: null }, 5, 15);
    expect(next.failedAttempts).toBe(5);
    expect(next.lockUntil).not.toBeNull();
  });

  test("resetBruteForce returns clean state", () => {
    expect(resetBruteForce()).toEqual({ failedAttempts: 0, lockUntil: null });
  });
});

describe("trusted device cookie", () => {
  test("creates and verifies valid cookies", () => {
    const email = "user@example.com";
    const cookieValue = createTrustedDeviceCookieValue(email, "v1", TEST_HMAC_SECRET, 30);
    // Valid verification
    expect(verifyTrustedDeviceCookie(cookieValue, email, TEST_HMAC_SECRET, "v1")).toBe(true);
    // Without version check
    expect(verifyTrustedDeviceCookie(cookieValue, email, TEST_HMAC_SECRET)).toBe(true);
    // Check format: email|expiry|version|signature
    const parts = cookieValue.split("|");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe(email);
    expect(parts[2]).toBe("v1");
  });

  test("rejects invalid cookies", () => {
    const email = "user@example.com";
    const cookieValue = createTrustedDeviceCookieValue(email, "v1", TEST_HMAC_SECRET, 30);
    // Wrong email
    expect(verifyTrustedDeviceCookie(cookieValue, "other@example.com", TEST_HMAC_SECRET, "v1")).toBe(false);
    // Wrong version
    expect(verifyTrustedDeviceCookie(cookieValue, email, TEST_HMAC_SECRET, "v2")).toBe(false);
    // Tampered signature
    const tampered = cookieValue.split("|").slice(0, -1).join("|") + "|" + "f".repeat(64);
    expect(verifyTrustedDeviceCookie(tampered, email, TEST_HMAC_SECRET, "v1")).toBe(false);
    // Invalid formats
    expect(verifyTrustedDeviceCookie("invalid", email, TEST_HMAC_SECRET)).toBe(false);
    expect(verifyTrustedDeviceCookie("a|b|c", email, TEST_HMAC_SECRET)).toBe(false);
    // Wrong HMAC secret
    const otherCookie = createTrustedDeviceCookieValue(email, "v1", "secret-a", 30);
    expect(verifyTrustedDeviceCookie(otherCookie, email, "secret-b", "v1")).toBe(false);
  });
});

describe("verification nonce", () => {
  test("generates unique 64-char hex nonces", () => {
    const nonce = generateVerificationNonce();
    expect(nonce).toMatch(/^[0-9a-f]{64}$/);
    const nonces = new Set(Array.from({ length: 5 }, () => generateVerificationNonce()));
    expect(nonces.size).toBe(5);
  });

  test("signNonce and verifyNonceSignature round-trip", () => {
    const nonce = generateVerificationNonce();
    const sig = signNonce(nonce, TEST_HMAC_SECRET);
    expect(sig).toMatch(/^[0-9a-f]+$/);
    // Valid signature
    expect(verifyNonceSignature(nonce, sig, TEST_HMAC_SECRET)).toBe(true);
    // Invalid signatures
    expect(verifyNonceSignature(nonce, "f".repeat(64), TEST_HMAC_SECRET)).toBe(false);
    expect(verifyNonceSignature(generateVerificationNonce(), sig, TEST_HMAC_SECRET)).toBe(false);
    expect(verifyNonceSignature(nonce, signNonce(nonce, "secret-a"), "secret-b")).toBe(false);
  });
});

describe("TOTP_SETTINGS_KEYS and SENSITIVE_KEY_PREFIX", () => {
  test("all keys have correct prefix and values", () => {
    expect(SENSITIVE_KEY_PREFIX).toBe("totp.");
    expect(TOTP_SETTINGS_KEYS.enabled).toBe("totp.enabled");
    expect(TOTP_SETTINGS_KEYS.encryptedSecret).toBe("totp.encryptedSecret");
    // All keys start with prefix
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

  // Each block creates its own store/service — fully isolated, so we mark
  // the slow scrypt-bound blocks as concurrent to overlap their hash work.
  describe.concurrent("isEnabled / getStatus", () => {
    test("reflects store state correctly", async () => {
      const { service, store } = createService();
      // Initially disabled
      expect(await service.isEnabled()).toBe(false);
      expect(await service.getStatus()).toEqual({ enabled: false, recoveryCodeUsed: false });
      // Enable
      await store.set(TOTP_SETTINGS_KEYS.enabled, "true");
      expect(await service.isEnabled()).toBe(true);
      // Status with recovery code used
      await store.set(TOTP_SETTINGS_KEYS.recoveryCodeUsed, "true");
      expect(await service.getStatus()).toEqual({ enabled: true, recoveryCodeUsed: true });
    });

    test("getStatus hides recovery code status when disabled", async () => {
      const { service, store } = createService();
      await store.set(TOTP_SETTINGS_KEYS.recoveryCodeUsed, "true");
      expect(await service.getStatus()).toEqual({ enabled: false, recoveryCodeUsed: false });
    });
  });

  describe.concurrent("setup", () => {
    test("generates QR code and stores encrypted secret", async () => {
      const { service, store } = createService();
      const result = await service.setup("user@example.com");

      expect(result.qrDataURL).toMatch(/^data:image\/png;base64,/);
      expect(result.secret).toMatch(/^[A-Z2-7]+=*$/);
      expect(await store.get(TOTP_SETTINGS_KEYS.encryptedSecret)).toBeDefined();
      expect(await store.get(TOTP_SETTINGS_KEYS.enabled)).toBe("false");
    });
  });

  describe.concurrent("verifySetup", () => {
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
      expect(await store.get(TOTP_SETTINGS_KEYS.enabled)).toBe("true");
      expect(await store.get(TOTP_SETTINGS_KEYS.enrollVersion)).toBeDefined();
      expect(await store.get(TOTP_SETTINGS_KEYS.recoveryCodeHash)).toBeDefined();
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
        expect(await store.get(TOTP_SETTINGS_KEYS.twoFactorNonce)).toBe(result.nonce);
        // Nonce should be consumable
        expect(await service.consumeNonce(result.nonce, result.nonceSig)).toBe(true);
        // Can't reuse
        expect(await service.consumeNonce(result.nonce, result.nonceSig)).toBe(false);
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

  describe.concurrent("verifyLogin", () => {
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
      expect(await store.get(TOTP_SETTINGS_KEYS.recoveryCodeUsed)).toBe("true");

      // Can't reuse recovery code
      const reuse = await service.verifyLogin(recoveryCode, "user@example.com", "recovery");
      expect("error" in reuse).toBe(true);
      if ("error" in reuse) {
        expect(reuse.error).toContain("already been used");
      }
    });
  });

  describe.concurrent("disable", () => {
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
      expect(await service.isEnabled()).toBe(true);

      // Disable with fresh token
      token = totpInstance.generate();
      const result = await service.disable(token, "user@example.com");
      expect("success" in result && result.success).toBe(true);
      expect(await service.isEnabled()).toBe(false);

      // All TOTP keys should be deleted
      for (const key of Object.values(TOTP_SETTINGS_KEYS)) {
        expect(await store.get(key)).toBeUndefined();
      }
    });

    test("returns error when not enabled", async () => {
      const { service } = createService();
      const result = await service.disable("123456", "user@example.com");
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("not enabled");
      }
    });
  });

  describe.concurrent("forceDisable", () => {
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
      await service.verifySetup(totpInstance.generate(), "user@example.com");
      return { service, store, totpInstance };
    }

    test("unconditionally disables 2FA and cleans up keys", async () => {
      const { service, store } = await setupEnabled();
      expect(await service.isEnabled()).toBe(true);

      const result = await service.forceDisable();
      expect("success" in result && result.success).toBe(true);
      expect(await service.isEnabled()).toBe(false);
      for (const key of Object.values(TOTP_SETTINGS_KEYS)) {
        expect(await store.get(key)).toBeUndefined();
      }
    });

    test("works even after recovery code has been used", async () => {
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
      const verifyResult = await service.verifySetup(totpInstance.generate(), "user@example.com");
      const recoveryCode = (verifyResult as { recoveryCode: string }).recoveryCode;
      await service.verifyLogin(recoveryCode, "user@example.com", "recovery");
      expect(await store.get(TOTP_SETTINGS_KEYS.recoveryCodeUsed)).toBe("true");

      const forceResult = await service.forceDisable();
      expect("success" in forceResult && forceResult.success).toBe(true);
      expect(await service.isEnabled()).toBe(false);
    });

    test("returns error when 2FA is not enabled", async () => {
      const { service } = createService();
      const result = await service.forceDisable();
      expect("error" in result && result.error).toContain("not enabled");
    });
  });

  describe("consumeNonce", () => {
    test("consumes valid nonce and prevents reuse", async () => {
      const { service, store } = createService();
      const nonce = generateVerificationNonce();
      const sig = signNonce(nonce, TEST_HMAC_SECRET);
      await store.set(TOTP_SETTINGS_KEYS.twoFactorNonce, nonce);

      expect(await service.consumeNonce(nonce, sig)).toBe(true);
      expect(await store.get(TOTP_SETTINGS_KEYS.twoFactorNonce)).toBeUndefined();
      // Can't reuse
      expect(await service.consumeNonce(nonce, sig)).toBe(false);
    });

    test("rejects invalid nonces", async () => {
      const { service, store } = createService();
      const nonce = generateVerificationNonce();
      await store.set(TOTP_SETTINGS_KEYS.twoFactorNonce, nonce);
      // Invalid signature
      expect(await service.consumeNonce(nonce, "f".repeat(64))).toBe(false);
      // Not in store
      expect(await service.consumeNonce(generateVerificationNonce(), signNonce(nonce, TEST_HMAC_SECRET))).toBe(false);
    });
  });

  describe("trusted device cookie via service", () => {
    test("round-trip and rejection scenarios", async () => {
      const { service, store } = createService();
      await store.set(TOTP_SETTINGS_KEYS.enrollVersion, "42");

      const cookieValue = await service.createTrustedCookieValue("user@example.com");
      // Valid
      expect(await service.verifyTrustedCookie(cookieValue, "user@example.com")).toBe(true);
      // Wrong email
      expect(await service.verifyTrustedCookie(cookieValue, "other@example.com")).toBe(false);
      // Enrollment version change
      await store.set(TOTP_SETTINGS_KEYS.enrollVersion, "99");
      expect(await service.verifyTrustedCookie(cookieValue, "user@example.com")).toBe(false);
    });

    test("exposes cookie config", () => {
      const { service } = createService({ trustedDeviceDays: 7 });
      expect(service.trustedDeviceCookieName).toBe(TEST_COOKIE_NAME);
      expect(service.trustedDeviceMaxAge).toBe(7 * 24 * 60 * 60);
    });
  });

  describe("configurable defaults", () => {
    test("maxFailedAttempts has default and can be overridden", () => {
      expect(createService().service.maxFailedAttempts).toBe(5);
      expect(createService({ maxFailedAttempts: 3 }).service.maxFailedAttempts).toBe(3);
    });
  });
});
