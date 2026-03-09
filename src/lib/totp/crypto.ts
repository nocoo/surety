/**
 * Pure cryptographic and utility functions for TOTP 2FA.
 *
 * Every function is a pure function (or takes explicit parameters).
 * Zero dependency on process.env, host app names, or external state.
 */
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import type { BruteForceState } from "./types";

// ---------------------------------------------------------------------------
// AES-256-GCM encrypt / decrypt
// ---------------------------------------------------------------------------

export function encryptSecret(plaintext: string, masterKey: Buffer): string {
  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // format: iv:ciphertext:tag (all hex)
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}

export function decryptSecret(stored: string, masterKey: Buffer): string {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }
  const [ivHex, ciphertextHex, tagHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", masterKey, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

// ---------------------------------------------------------------------------
// Master key parsing
// ---------------------------------------------------------------------------

export function parseMasterKey(hex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("TOTP master key must be a 64-char hex string (32 bytes). Generate with: openssl rand -hex 32");
  }
  return Buffer.from(hex, "hex");
}

// ---------------------------------------------------------------------------
// TOTP generation & verification
// ---------------------------------------------------------------------------

export function generateSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 }); // 160-bit
  return secret.base32;
}

export function createTOTP(secretBase32: string, label: string, issuer: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export function verifyToken(secretBase32: string, token: string, label: string, issuer: string, window: number): boolean {
  const totp = createTOTP(secretBase32, label, issuer);
  const delta = totp.validate({ token, window });
  return delta !== null;
}

// ---------------------------------------------------------------------------
// QR code generation
// ---------------------------------------------------------------------------

export async function generateQRDataURL(secretBase32: string, label: string, issuer: string): Promise<string> {
  const totp = createTOTP(secretBase32, label, issuer);
  const uri = totp.toString();
  return QRCode.toDataURL(uri, { width: 256, margin: 2 });
}

// ---------------------------------------------------------------------------
// Recovery code
// ---------------------------------------------------------------------------

export function generateRecoveryCode(bytes: number): string {
  // Formatted as groups of 4 hex chars for readability
  const raw = randomBytes(bytes).toString("hex");
  return raw.replace(/(.{4})/g, "$1-").slice(0, -1); // e.g. "a1b2-c3d4-e5f6-..."
}

const scrypt = promisify(scryptCb);

const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_LEN = 16;

export async function hashRecoveryCode(code: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_LEN);
  const derived = (await scrypt(normalizeRecoveryCode(code), salt, SCRYPT_KEYLEN)) as Buffer;
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyRecoveryCode(code: string, hash: string): Promise<boolean> {
  const parts = hash.split(":");
  if (parts.length !== 2) return false;
  const [saltHex, keyHex] = parts as [string, string];
  const salt = Buffer.from(saltHex, "hex");
  const storedKey = Buffer.from(keyHex, "hex");
  const derived = (await scrypt(normalizeRecoveryCode(code), salt, SCRYPT_KEYLEN)) as Buffer;
  if (derived.length !== storedKey.length) return false;
  return timingSafeEqual(derived, storedKey);
}

export function normalizeRecoveryCode(code: string): string {
  // strip dashes, whitespace, and lowercase for flexible input
  return code.replace(/[-\s]/g, "").toLowerCase();
}

// ---------------------------------------------------------------------------
// Brute force protection
// ---------------------------------------------------------------------------

export function isLockedOut(state: BruteForceState): boolean {
  if (!state.lockUntil) return false;
  return new Date(state.lockUntil) > new Date();
}

export function lockoutRemainingSeconds(state: BruteForceState): number {
  if (!state.lockUntil) return 0;
  const diff = new Date(state.lockUntil).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 1000));
}

export function recordFailedAttempt(state: BruteForceState, maxAttempts: number, lockoutMinutes: number): BruteForceState {
  const attempts = state.failedAttempts + 1;
  if (attempts >= maxAttempts) {
    const lockUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000).toISOString();
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

export function createTrustedDeviceCookieValue(
  email: string,
  enrollVersion: string,
  hmacSecret: string,
  trustedDeviceDays: number,
): string {
  const expiry = new Date(Date.now() + trustedDeviceDays * 24 * 60 * 60 * 1000).toISOString();
  const payload = `${email}|${expiry}|${enrollVersion}`;
  const signature = createHmac("sha256", hmacSecret).update(payload).digest("hex");
  return `${payload}|${signature}`;
}

export function verifyTrustedDeviceCookie(
  cookieValue: string,
  email: string,
  hmacSecret: string,
  currentEnrollVersion?: string,
): boolean {
  const parts = cookieValue.split("|");
  if (parts.length !== 4) return false;
  const [cookieEmail, expiry, enrollVer, signature] = parts as [string, string, string, string];

  // verify email matches
  if (cookieEmail !== email) return false;

  // verify not expired
  if (new Date(expiry) <= new Date()) return false;

  // verify enrollment version matches (if provided)
  if (currentEnrollVersion && enrollVer !== currentEnrollVersion) return false;

  // verify signature
  const payload = `${cookieEmail}|${expiry}|${enrollVer}`;
  const expected = createHmac("sha256", hmacSecret).update(payload).digest("hex");

  // timing-safe comparison
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}

// ---------------------------------------------------------------------------
// Verification nonce (server-signed, single-use)
// ---------------------------------------------------------------------------

export function generateVerificationNonce(): string {
  return randomBytes(32).toString("hex");
}

export function signNonce(nonce: string, hmacSecret: string): string {
  return createHmac("sha256", hmacSecret).update(nonce).digest("hex");
}

export function verifyNonceSignature(nonce: string, signature: string, hmacSecret: string): boolean {
  const expected = signNonce(nonce, hmacSecret);
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}
