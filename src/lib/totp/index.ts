/**
 * TOTP 2FA Module — reusable, zero-coupling-to-host-app.
 *
 * Public API:
 *   - TotpService    — service class (main entry point)
 *   - TotpStore      — KV store interface (implement per host app)
 *   - TotpConfig     — configuration type
 *   - crypto.*       — pure functions (for advanced use / testing)
 *   - types.*        — constants and type exports
 */

// Service
export { TotpService } from "./service";

// Types & constants
export {
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
} from "./types";

// Pure crypto functions (for direct use or testing)
export {
  encryptSecret,
  decryptSecret,
  parseMasterKey,
  generateSecret,
  createTOTP,
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
} from "./crypto";
