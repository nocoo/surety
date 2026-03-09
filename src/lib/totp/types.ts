/**
 * TOTP module types — zero coupling to any host application.
 */

// ---------------------------------------------------------------------------
// KV Store interface — the only external dependency
// ---------------------------------------------------------------------------

/**
 * Minimal key-value store interface for TOTP state persistence.
 * Implementations can back this with SQLite, Redis, filesystem, etc.
 */
export interface TotpStore {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): boolean;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the TOTP module. All fields have sensible defaults.
 */
export interface TotpConfig {
  /** Issuer name shown in authenticator apps (e.g. "MyApp") */
  issuer: string;
  /** Cookie name for trusted device feature */
  trustedDeviceCookieName: string;
  /** HMAC secret for signing cookies and nonces (must NOT be the auth secret) */
  hmacSecret: string;
  /** Hex-encoded 32-byte key for AES-256-GCM encryption of TOTP secrets */
  masterKeyHex: string;
  /** TOTP time window tolerance: accept ±N time steps (default: 1 = ±30s) */
  window?: number;
  /** Max failed verification attempts before lockout (default: 5) */
  maxFailedAttempts?: number;
  /** Lockout duration in minutes (default: 15) */
  lockoutMinutes?: number;
  /** Trusted device cookie lifetime in days (default: 30) */
  trustedDeviceDays?: number;
  /** Recovery code size in bytes (default: 16 = 32 hex chars) */
  recoveryCodeBytes?: number;
}

// ---------------------------------------------------------------------------
// Internal state types
// ---------------------------------------------------------------------------

export interface BruteForceState {
  failedAttempts: number;
  lockUntil: string | null; // ISO 8601
}

// ---------------------------------------------------------------------------
// Service result types
// ---------------------------------------------------------------------------

export interface SetupResult {
  qrDataURL: string;
  secret: string;
}

export interface VerifySetupResult {
  success: true;
  recoveryCode: string;
}

export interface VerifyLoginResult {
  success: true;
  nonce: string;
  nonceSig: string;
}

export interface StatusResult {
  enabled: boolean;
  recoveryCodeUsed: boolean;
}

export interface BruteForceError {
  error: string;
  locked: boolean;
  retryAfterSeconds?: number;
}

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
  enrollVersion: "totp.enrollVersion",
  twoFactorNonce: "totp.twoFactorNonce",
} as const;

/** Key prefix for sensitive TOTP settings — block from generic KV APIs */
export const SENSITIVE_KEY_PREFIX = "totp.";
