/**
 * Surety adapter for the TOTP module.
 *
 * This is the ONLY file that couples the generic totp/ module to the Surety app.
 * It reads env vars, binds settingsRepo as the TotpStore, and re-exports
 * everything consumers need so existing import paths (`@/lib/totp`) keep working.
 */
import { TotpService, type TotpStore, type TotpConfig } from "./totp/index";

// Re-export everything from the module for backward compatibility
export {
  TotpService,
  type TotpStore,
  type TotpConfig,
  type BruteForceState,
  type SetupResult,
  type VerifySetupResult,
  type VerifyLoginResult,
  type StatusResult,
  type BruteForceError,
  TOTP_SETTINGS_KEYS,
  SENSITIVE_KEY_PREFIX,
  // Pure crypto re-exports (used by existing tests and API routes)
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
  generateVerificationNonce,
  signNonce,
  verifyNonceSignature,
} from "./totp/index";

// ---------------------------------------------------------------------------
// Surety-specific config
// ---------------------------------------------------------------------------

function getHmacSecret(): string {
  // Prefer dedicated TOTP_HMAC_SECRET; fall back to NEXTAUTH_SECRET for migration
  const secret = process.env.TOTP_HMAC_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("TOTP_HMAC_SECRET (or NEXTAUTH_SECRET as fallback) is required");
  return secret;
}

function getMasterKeyHex(): string {
  const hex = process.env.TOTP_MASTER_KEY;
  if (!hex) throw new Error("TOTP_MASTER_KEY is required");
  return hex;
}

const SURETY_TOTP_ISSUER =
  process.env.NODE_ENV === "production" ? "Surety" : "Surety(开发)";

const SURETY_TOTP_CONFIG: TotpConfig = {
  issuer: SURETY_TOTP_ISSUER,
  trustedDeviceCookieName: "surety-2fa-trusted",
  hmacSecret: "", // lazy — set at service creation time
  masterKeyHex: "", // lazy — set at service creation time
};

// ---------------------------------------------------------------------------
// Lazy singleton — created on first use to avoid env var issues at import time
// ---------------------------------------------------------------------------

let _service: TotpService | null = null;

/**
 * Get the Surety TotpService instance. Lazily creates a singleton bound to settingsRepo.
 * Must be called after DB is initialized (not at module top level).
 */
export async function getTotpService(): Promise<TotpService> {
  if (_service) return _service;

  const { settingsRepo } = await import("@/db/repositories/settings");

  // settingsRepo already satisfies TotpStore interface (get/set/delete)
  const store: TotpStore = {
    get: (key: string) => settingsRepo.get(key),
    set: (key: string, value: string) => { settingsRepo.set(key, value); },
    delete: (key: string) => settingsRepo.delete(key),
  };

  const config: TotpConfig = {
    ...SURETY_TOTP_CONFIG,
    hmacSecret: getHmacSecret(),
    masterKeyHex: getMasterKeyHex(),
  };

  _service = new TotpService(store, config);
  return _service;
}

// ---------------------------------------------------------------------------
// Backward-compatible constants (cookie name & max age)
// ---------------------------------------------------------------------------

export const TRUSTED_DEVICE_COOKIE_NAME = "surety-2fa-trusted";
export const TRUSTED_DEVICE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
