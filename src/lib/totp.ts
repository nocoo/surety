/**
 * TOTP two-factor authentication utilities.
 *
 * - AES-256-GCM for secret encryption at rest
 * - otpauth for TOTP generation/verification
 * - qrcode for QR data URL generation
 * - Brute force protection with lockout
 */
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTP_ISSUER = "Surety";
const TOTP_WINDOW = 1; // accept ±1 time step (±30s)
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const TRUSTED_DEVICE_DAYS = 30;
const RECOVERY_CODE_BYTES = 16; // 32 hex chars

// ---------------------------------------------------------------------------
// Master key helpers
// ---------------------------------------------------------------------------

function getMasterKey(): Buffer {
  const hex = process.env.TOTP_MASTER_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("TOTP_MASTER_KEY must be a 64-char hex string (32 bytes). Generate with: openssl rand -hex 32");
  }
  return Buffer.from(hex, "hex");
}

// ---------------------------------------------------------------------------
// AES-256-GCM encrypt / decrypt
// ---------------------------------------------------------------------------

export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // format: iv:ciphertext:tag (all hex)
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}

export function decryptSecret(stored: string): string {
  const key = getMasterKey();
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }
  const [ivHex, ciphertextHex, tagHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

// ---------------------------------------------------------------------------
// TOTP generation & verification
// ---------------------------------------------------------------------------

export function generateSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 }); // 160-bit
  return secret.base32;
}

export function createTOTP(secretBase32: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export function verifyToken(secretBase32: string, token: string, label: string): boolean {
  const totp = createTOTP(secretBase32, label);
  const delta = totp.validate({ token, window: TOTP_WINDOW });
  return delta !== null;
}

// ---------------------------------------------------------------------------
// QR code generation
// ---------------------------------------------------------------------------

export async function generateQRDataURL(secretBase32: string, label: string): Promise<string> {
  const totp = createTOTP(secretBase32, label);
  const uri = totp.toString();
  return QRCode.toDataURL(uri, { width: 256, margin: 2 });
}

// ---------------------------------------------------------------------------
// Recovery code
// ---------------------------------------------------------------------------

export function generateRecoveryCode(): string {
  // 32-char hex string, formatted as 8 groups of 4 for readability
  const raw = randomBytes(RECOVERY_CODE_BYTES).toString("hex");
  return raw.replace(/(.{4})/g, "$1-").slice(0, -1); // e.g. "a1b2-c3d4-e5f6-..."
}

export async function hashRecoveryCode(code: string): Promise<string> {
  // Use Bun's built-in bcrypt-compatible password hashing
  return Bun.password.hash(normalizeRecoveryCode(code));
}

export async function verifyRecoveryCode(code: string, hash: string): Promise<boolean> {
  return Bun.password.verify(normalizeRecoveryCode(code), hash);
}

function normalizeRecoveryCode(code: string): string {
  // strip dashes and lowercase for flexible input
  return code.replace(/-/g, "").toLowerCase();
}

// ---------------------------------------------------------------------------
// Brute force protection
// ---------------------------------------------------------------------------

export interface BruteForceState {
  failedAttempts: number;
  lockUntil: string | null; // ISO 8601
}

export function isLockedOut(state: BruteForceState): boolean {
  if (!state.lockUntil) return false;
  return new Date(state.lockUntil) > new Date();
}

export function lockoutRemainingSeconds(state: BruteForceState): number {
  if (!state.lockUntil) return 0;
  const diff = new Date(state.lockUntil).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 1000));
}

export function recordFailedAttempt(state: BruteForceState): BruteForceState {
  const attempts = state.failedAttempts + 1;
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
    return { failedAttempts: attempts, lockUntil };
  }
  return { failedAttempts: attempts, lockUntil: null };
}

export function resetBruteForce(): BruteForceState {
  return { failedAttempts: 0, lockUntil: null };
}

// ---------------------------------------------------------------------------
// Trusted device cookie (HMAC-SHA256)
// ---------------------------------------------------------------------------

function getHmacKey(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for trusted device cookies");
  return secret;
}

export function createTrustedDeviceCookieValue(email: string): string {
  const expiry = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const payload = `${email}|${expiry}`;
  const signature = createHmac("sha256", getHmacKey()).update(payload).digest("hex");
  return `${payload}|${signature}`;
}

export function verifyTrustedDeviceCookie(cookieValue: string, email: string): boolean {
  const parts = cookieValue.split("|");
  if (parts.length !== 3) return false;
  const [cookieEmail, expiry, signature] = parts as [string, string, string];

  // verify email matches
  if (cookieEmail !== email) return false;

  // verify not expired
  if (new Date(expiry) <= new Date()) return false;

  // verify signature
  const payload = `${cookieEmail}|${expiry}`;
  const expected = createHmac("sha256", getHmacKey()).update(payload).digest("hex");

  // timing-safe comparison
  if (signature.length !== expected.length) return false;
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return false;

  let diff = 0;
  for (let i = 0; i < sigBuf.length; i++) {
    diff |= (sigBuf[i] ?? 0) ^ (expBuf[i] ?? 0);
  }
  return diff === 0;
}

export const TRUSTED_DEVICE_COOKIE_NAME = "surety-2fa-trusted";
export const TRUSTED_DEVICE_MAX_AGE = TRUSTED_DEVICE_DAYS * 24 * 60 * 60; // seconds

// ---------------------------------------------------------------------------
// Settings key constants
// ---------------------------------------------------------------------------

export const TOTP_SETTINGS_KEYS = {
  enabled: "totp.enabled",
  encryptedSecret: "totp.encryptedSecret",
  recoveryCodeHash: "totp.recoveryCodeHash",
  recoveryCodeUsed: "totp.recoveryCodeUsed",
  failedAttempts: "totp.failedAttempts",
  lockUntil: "totp.lockUntil",
} as const;
