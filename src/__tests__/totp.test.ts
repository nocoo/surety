import { describe, expect, test } from "bun:test";
import * as OTPAuth from "otpauth";

// Set required env vars BEFORE importing totp module
process.env.TOTP_MASTER_KEY = "a".repeat(64); // 32-byte hex
process.env.NEXTAUTH_SECRET = "test-nextauth-secret-for-hmac";

import {
  encryptSecret,
  decryptSecret,
  generateSecret,
  verifyToken,
  generateQRDataURL,
  generateRecoveryCode,
  hashRecoveryCode,
  verifyRecoveryCode,
  isLockedOut,
  lockoutRemainingSeconds,
  recordFailedAttempt,
  resetBruteForce,
  createTrustedDeviceCookieValue,
  verifyTrustedDeviceCookie,
  TRUSTED_DEVICE_COOKIE_NAME,
  TRUSTED_DEVICE_MAX_AGE,
  TOTP_SETTINGS_KEYS,
  type BruteForceState,
} from "@/lib/totp";

// ---------------------------------------------------------------------------
// AES-256-GCM encrypt / decrypt
// ---------------------------------------------------------------------------

describe("encryptSecret / decryptSecret", () => {
  test("round-trips a secret", () => {
    const original = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptSecret(original);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(original);
  });

  test("encrypted format is iv:ciphertext:tag (hex)", () => {
    const encrypted = encryptSecret("test");
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
    const enc1 = encryptSecret(plaintext);
    const enc2 = encryptSecret(plaintext);
    expect(enc1).not.toBe(enc2);
    // But both decrypt to the same value
    expect(decryptSecret(enc1)).toBe(plaintext);
    expect(decryptSecret(enc2)).toBe(plaintext);
  });

  test("throws on tampered ciphertext", () => {
    const encrypted = encryptSecret("secret");
    const parts = encrypted.split(":");
    // Flip a hex char in ciphertext
    const tampered = parts[0] + ":" + "ff" + parts[1]!.slice(2) + ":" + parts[2];
    expect(() => decryptSecret(tampered)).toThrow();
  });

  test("throws on invalid format", () => {
    expect(() => decryptSecret("onlytwoparts:here")).toThrow("Invalid encrypted secret format");
  });
});

// ---------------------------------------------------------------------------
// TOTP generation & verification
// ---------------------------------------------------------------------------

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
    // Generate a valid token using otpauth directly
    const totp = new OTPAuth.TOTP({
      issuer: "Surety",
      label,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const token = totp.generate();
    expect(verifyToken(secret, token, label)).toBe(true);
  });

  test("rejects an incorrect token", () => {
    const secret = generateSecret();
    expect(verifyToken(secret, "000000", "test@example.com")).toBe(false);
  });

  test("rejects non-6-digit strings", () => {
    const secret = generateSecret();
    expect(verifyToken(secret, "12345", "test@example.com")).toBe(false);
    expect(verifyToken(secret, "1234567", "test@example.com")).toBe(false);
    expect(verifyToken(secret, "abcdef", "test@example.com")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// QR code generation
// ---------------------------------------------------------------------------

describe("generateQRDataURL", () => {
  test("returns a data URL", async () => {
    const secret = generateSecret();
    const dataURL = await generateQRDataURL(secret, "user@example.com");
    expect(dataURL).toMatch(/^data:image\/png;base64,/);
  });
});

// ---------------------------------------------------------------------------
// Recovery code
// ---------------------------------------------------------------------------

describe("recovery code", () => {
  test("generateRecoveryCode returns a formatted hex string with dashes", () => {
    const code = generateRecoveryCode();
    // 32 hex chars + 7 dashes = 39 chars total
    expect(code).toMatch(/^[0-9a-f]{4}(-[0-9a-f]{4}){7}$/);
  });

  test("generates unique codes each time", () => {
    const codes = new Set(Array.from({ length: 10 }, () => generateRecoveryCode()));
    expect(codes.size).toBe(10);
  });

  test("hashRecoveryCode and verifyRecoveryCode round-trip", async () => {
    const code = generateRecoveryCode();
    const hash = await hashRecoveryCode(code);
    expect(await verifyRecoveryCode(code, hash)).toBe(true);
  });

  test("verifyRecoveryCode returns false for wrong code", async () => {
    const code = generateRecoveryCode();
    const hash = await hashRecoveryCode(code);
    expect(await verifyRecoveryCode("wrong-code-1234-5678", hash)).toBe(false);
  });

  test("verification is case-insensitive and ignores dashes", async () => {
    const code = generateRecoveryCode();
    const hash = await hashRecoveryCode(code);
    // Uppercase with dashes stripped
    const variant = code.replace(/-/g, "").toUpperCase();
    expect(await verifyRecoveryCode(variant, hash)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Brute force protection
// ---------------------------------------------------------------------------

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
    const next = recordFailedAttempt(state);
    expect(next.failedAttempts).toBe(3);
    expect(next.lockUntil).toBeNull();
  });

  test("recordFailedAttempt triggers lockout at 5 attempts", () => {
    const state: BruteForceState = { failedAttempts: 4, lockUntil: null };
    const next = recordFailedAttempt(state);
    expect(next.failedAttempts).toBe(5);
    expect(next.lockUntil).not.toBeNull();
    // Lock should be ~15 minutes in the future
    const lockTime = new Date(next.lockUntil!).getTime();
    const expected = Date.now() + 15 * 60 * 1000;
    expect(Math.abs(lockTime - expected)).toBeLessThan(2000); // within 2s tolerance
  });

  test("resetBruteForce returns clean state", () => {
    const state = resetBruteForce();
    expect(state.failedAttempts).toBe(0);
    expect(state.lockUntil).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Trusted device cookie
// ---------------------------------------------------------------------------

describe("trusted device cookie", () => {
  test("creates and verifies a cookie value", () => {
    const email = "user@example.com";
    const cookieValue = createTrustedDeviceCookieValue(email);
    expect(verifyTrustedDeviceCookie(cookieValue, email)).toBe(true);
  });

  test("rejects cookie with wrong email", () => {
    const cookieValue = createTrustedDeviceCookieValue("user@example.com");
    expect(verifyTrustedDeviceCookie(cookieValue, "other@example.com")).toBe(false);
  });

  test("rejects tampered signature", () => {
    const email = "user@example.com";
    const cookieValue = createTrustedDeviceCookieValue(email);
    const parts = cookieValue.split("|");
    // Tamper the signature
    const tampered = parts[0] + "|" + parts[1] + "|" + "f".repeat(64);
    expect(verifyTrustedDeviceCookie(tampered, email)).toBe(false);
  });

  test("rejects invalid format", () => {
    expect(verifyTrustedDeviceCookie("invalid", "user@example.com")).toBe(false);
    expect(verifyTrustedDeviceCookie("a|b", "user@example.com")).toBe(false);
  });

  test("cookie value contains email and expiry", () => {
    const email = "user@example.com";
    const cookieValue = createTrustedDeviceCookieValue(email);
    const parts = cookieValue.split("|");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe(email);
    // Expiry should be a valid ISO date
    expect(new Date(parts[1]!).toISOString()).toBe(parts[1]!);
  });

  test("TRUSTED_DEVICE_COOKIE_NAME is correct", () => {
    expect(TRUSTED_DEVICE_COOKIE_NAME).toBe("surety-2fa-trusted");
  });

  test("TRUSTED_DEVICE_MAX_AGE is 30 days in seconds", () => {
    expect(TRUSTED_DEVICE_MAX_AGE).toBe(30 * 24 * 60 * 60);
  });
});

// ---------------------------------------------------------------------------
// Settings key constants
// ---------------------------------------------------------------------------

describe("TOTP_SETTINGS_KEYS", () => {
  test("has all expected keys", () => {
    expect(TOTP_SETTINGS_KEYS.enabled).toBe("totp.enabled");
    expect(TOTP_SETTINGS_KEYS.encryptedSecret).toBe("totp.encryptedSecret");
    expect(TOTP_SETTINGS_KEYS.recoveryCodeHash).toBe("totp.recoveryCodeHash");
    expect(TOTP_SETTINGS_KEYS.recoveryCodeUsed).toBe("totp.recoveryCodeUsed");
    expect(TOTP_SETTINGS_KEYS.failedAttempts).toBe("totp.failedAttempts");
    expect(TOTP_SETTINGS_KEYS.lockUntil).toBe("totp.lockUntil");
  });
});
