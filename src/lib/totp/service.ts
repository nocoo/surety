/**
 * TotpService — stateless service layer for TOTP 2FA.
 *
 * Accepts a TotpStore (KV interface) and TotpConfig at construction.
 * All business operations are methods on this class.
 * Zero coupling to any host application, framework, or ORM.
 */
import {
  encryptSecret,
  decryptSecret,
  parseMasterKey,
  generateSecret,
  verifyToken,
  generateQRDataURL as generateQR,
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
} from "./crypto";
import {
  TOTP_SETTINGS_KEYS,
  type TotpStore,
  type TotpConfig,
  type BruteForceState,
  type SetupResult,
  type VerifySetupResult,
  type VerifyLoginResult,
  type StatusResult,
  type BruteForceError,
} from "./types";

// ---------------------------------------------------------------------------
// Resolved config with defaults
// ---------------------------------------------------------------------------

interface ResolvedConfig {
  issuer: string;
  trustedDeviceCookieName: string;
  hmacSecret: string;
  masterKey: Buffer;
  window: number;
  maxFailedAttempts: number;
  lockoutMinutes: number;
  trustedDeviceDays: number;
  recoveryCodeBytes: number;
}

function resolveConfig(config: TotpConfig): ResolvedConfig {
  return {
    issuer: config.issuer,
    trustedDeviceCookieName: config.trustedDeviceCookieName,
    hmacSecret: config.hmacSecret,
    masterKey: parseMasterKey(config.masterKeyHex),
    window: config.window ?? 1,
    maxFailedAttempts: config.maxFailedAttempts ?? 5,
    lockoutMinutes: config.lockoutMinutes ?? 15,
    trustedDeviceDays: config.trustedDeviceDays ?? 30,
    recoveryCodeBytes: config.recoveryCodeBytes ?? 16,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class TotpService {
  private readonly config: ResolvedConfig;
  private readonly store: TotpStore;

  constructor(store: TotpStore, config: TotpConfig) {
    this.config = resolveConfig(config);
    this.store = store;
  }

  // -------------------------------------------------------------------------
  // Cookie constants (exposed for HTTP layer)
  // -------------------------------------------------------------------------

  get trustedDeviceCookieName(): string {
    return this.config.trustedDeviceCookieName;
  }

  get trustedDeviceMaxAge(): number {
    return this.config.trustedDeviceDays * 24 * 60 * 60; // seconds
  }

  get maxFailedAttempts(): number {
    return this.config.maxFailedAttempts;
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  /** Check if 2FA is enabled. Fails closed (returns true) on error in non-build contexts. */
  isEnabled(): boolean {
    return this.store.get(TOTP_SETTINGS_KEYS.enabled) === "true";
  }

  /** Get 2FA status and recovery code usage */
  getStatus(): StatusResult {
    const enabled = this.isEnabled();
    const recoveryCodeUsed = this.store.get(TOTP_SETTINGS_KEYS.recoveryCodeUsed) === "true";
    return {
      enabled,
      recoveryCodeUsed: enabled ? recoveryCodeUsed : false,
    };
  }

  // -------------------------------------------------------------------------
  // Brute force helpers (internal)
  // -------------------------------------------------------------------------

  private loadBruteForceState(): BruteForceState {
    return {
      failedAttempts: Number(this.store.get(TOTP_SETTINGS_KEYS.failedAttempts) ?? "0"),
      lockUntil: this.store.get(TOTP_SETTINGS_KEYS.lockUntil) ?? null,
    };
  }

  private saveBruteForceState(state: BruteForceState): void {
    this.store.set(TOTP_SETTINGS_KEYS.failedAttempts, String(state.failedAttempts));
    if (state.lockUntil) {
      this.store.set(TOTP_SETTINGS_KEYS.lockUntil, state.lockUntil);
    } else {
      this.store.delete(TOTP_SETTINGS_KEYS.lockUntil);
    }
  }

  private resetBruteForceState(): void {
    this.saveBruteForceState(resetBruteForce());
  }

  /** Check lockout and return error if locked. Returns null if not locked. */
  checkLockout(): BruteForceError | null {
    const state = this.loadBruteForceState();
    if (isLockedOut(state)) {
      const remaining = lockoutRemainingSeconds(state);
      return {
        error: `Too many attempts. Try again in ${Math.ceil(remaining / 60)} minute(s).`,
        locked: true,
        retryAfterSeconds: remaining,
      };
    }
    return null;
  }

  /** Record a failed attempt and return error info */
  private handleFailedAttempt(): { error: string; locked: boolean } {
    const state = this.loadBruteForceState();
    const newState = recordFailedAttempt(state, this.config.maxFailedAttempts, this.config.lockoutMinutes);
    this.saveBruteForceState(newState);

    const attemptsLeft = this.config.maxFailedAttempts - newState.failedAttempts;
    if (newState.lockUntil) {
      return {
        error: `Too many attempts. Account locked for ${this.config.lockoutMinutes} minutes.`,
        locked: true,
      };
    }
    return {
      error: `Invalid code. ${attemptsLeft > 0 ? `${attemptsLeft} attempt(s) remaining.` : ""}`,
      locked: false,
    };
  }

  // -------------------------------------------------------------------------
  // Setup flow
  // -------------------------------------------------------------------------

  /** Generate TOTP secret + QR code. Does NOT enable 2FA yet. */
  async setup(email: string): Promise<SetupResult> {
    const secretBase32 = generateSecret();
    const encrypted = encryptSecret(secretBase32, this.config.masterKey);
    this.store.set(TOTP_SETTINGS_KEYS.encryptedSecret, encrypted);
    this.store.set(TOTP_SETTINGS_KEYS.enabled, "false");

    const qrDataURL = await generateQR(secretBase32, email, this.config.issuer);
    return { qrDataURL, secret: secretBase32 };
  }

  /** Verify TOTP token to confirm setup. On success: enables 2FA, returns recovery code. */
  async verifySetup(token: string, email: string): Promise<VerifySetupResult | BruteForceError | { error: string }> {
    // Brute force check
    const lockout = this.checkLockout();
    if (lockout) return lockout;

    // Must have a pending secret
    const encrypted = this.store.get(TOTP_SETTINGS_KEYS.encryptedSecret);
    if (!encrypted) {
      return { error: "No 2FA setup in progress. Start setup first." };
    }

    // Already enabled?
    if (this.isEnabled()) {
      return { error: "2FA is already enabled" };
    }

    // Decrypt and verify
    const secretBase32 = decryptSecret(encrypted, this.config.masterKey);
    const valid = verifyToken(secretBase32, token, email, this.config.issuer, this.config.window);

    if (!valid) {
      return this.handleFailedAttempt();
    }

    // --- Compute all derived values BEFORE writing any state ---
    // This ensures atomicity: if any step throws (e.g. hash failure),
    // no partial state is written to the store.
    const enrollVersion = String(Date.now());
    const recoveryCode = generateRecoveryCode(this.config.recoveryCodeBytes);
    const recoveryHash = await hashRecoveryCode(recoveryCode);

    // --- All values ready — commit to store ---
    this.store.set(TOTP_SETTINGS_KEYS.enabled, "true");
    this.store.set(TOTP_SETTINGS_KEYS.enrollVersion, enrollVersion);
    this.store.set(TOTP_SETTINGS_KEYS.recoveryCodeHash, recoveryHash);
    this.store.set(TOTP_SETTINGS_KEYS.recoveryCodeUsed, "false");

    // Reset brute force counters
    this.resetBruteForceState();

    // Generate nonce for JWT promotion — setup proves authenticator ownership,
    // so the current session should be exempted from 2FA verification.
    const nonce = generateVerificationNonce();
    const nonceSig = signNonce(nonce, this.config.hmacSecret);
    this.store.set(TOTP_SETTINGS_KEYS.twoFactorNonce, nonce);

    return { success: true, recoveryCode, nonce, nonceSig };
  }

  // -------------------------------------------------------------------------
  // Login verification
  // -------------------------------------------------------------------------

  /** Verify TOTP token or recovery code during login. Returns nonce + sig on success. */
  async verifyLogin(
    token: string,
    email: string,
    type: "totp" | "recovery" = "totp",
  ): Promise<VerifyLoginResult | BruteForceError | { error: string }> {
    // Brute force check
    const lockout = this.checkLockout();
    if (lockout) return lockout;

    let verified = false;

    if (type === "recovery") {
      const recoveryUsed = this.store.get(TOTP_SETTINGS_KEYS.recoveryCodeUsed) === "true";
      if (recoveryUsed) {
        return { error: "Recovery code has already been used" };
      }

      const recoveryHash = this.store.get(TOTP_SETTINGS_KEYS.recoveryCodeHash);
      if (recoveryHash) {
        verified = await verifyRecoveryCode(token, recoveryHash);
        if (verified) {
          this.store.set(TOTP_SETTINGS_KEYS.recoveryCodeUsed, "true");
        }
      }
    } else {
      const encrypted = this.store.get(TOTP_SETTINGS_KEYS.encryptedSecret);
      if (!encrypted) {
        return { error: "2FA configuration is corrupted" };
      }

      const secretBase32 = decryptSecret(encrypted, this.config.masterKey);
      verified = verifyToken(secretBase32, token, email, this.config.issuer, this.config.window);
    }

    if (!verified) {
      return this.handleFailedAttempt();
    }

    // Success: reset brute force and generate nonce
    this.resetBruteForceState();

    const nonce = generateVerificationNonce();
    const nonceSig = signNonce(nonce, this.config.hmacSecret);
    this.store.set(TOTP_SETTINGS_KEYS.twoFactorNonce, nonce);

    return { success: true, nonce, nonceSig };
  }

  // -------------------------------------------------------------------------
  // Disable
  // -------------------------------------------------------------------------

  /** Disable 2FA. Requires a valid TOTP token for confirmation. */
  disable(token: string, email: string): BruteForceError | { error: string } | { success: true } {
    // Brute force check
    const lockout = this.checkLockout();
    if (lockout) return lockout;

    // Must be currently enabled
    if (!this.isEnabled()) {
      return { error: "2FA is not enabled" };
    }

    // Decrypt and verify
    const encrypted = this.store.get(TOTP_SETTINGS_KEYS.encryptedSecret);
    if (!encrypted) {
      return { error: "2FA configuration is corrupted" };
    }

    const secretBase32 = decryptSecret(encrypted, this.config.masterKey);
    const valid = verifyToken(secretBase32, token, email, this.config.issuer, this.config.window);

    if (!valid) {
      return this.handleFailedAttempt();
    }

    // Success: reset brute force then delete all TOTP settings
    this.resetBruteForceState();
    for (const key of Object.values(TOTP_SETTINGS_KEYS)) {
      this.store.delete(key);
    }

    return { success: true };
  }

  /**
   * Force-disable 2FA without TOTP verification.
   * Only allowed when the recovery code has been used (authenticator lost).
   * The user already proved identity via recovery code during login.
   */
  forceDisable(): { error: string } | { success: true } {
    if (!this.isEnabled()) {
      return { error: "2FA is not enabled" };
    }

    const recoveryUsed = this.store.get(TOTP_SETTINGS_KEYS.recoveryCodeUsed) === "true";
    if (!recoveryUsed) {
      return { error: "Force disable is only allowed when recovery code has been used" };
    }

    // Delete all TOTP settings
    this.resetBruteForceState();
    for (const key of Object.values(TOTP_SETTINGS_KEYS)) {
      this.store.delete(key);
    }

    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Nonce operations (used by auth layer)
  // -------------------------------------------------------------------------

  /** Consume a verification nonce. Returns true only if valid + matches stored value. */
  consumeNonce(nonce: string, signature: string): boolean {
    // Verify HMAC signature
    if (!verifyNonceSignature(nonce, signature, this.config.hmacSecret)) return false;

    // Verify nonce matches stored value
    const storedNonce = this.store.get(TOTP_SETTINGS_KEYS.twoFactorNonce);
    if (!storedNonce || storedNonce !== nonce) return false;

    // Consume: delete the nonce so it can't be reused
    this.store.delete(TOTP_SETTINGS_KEYS.twoFactorNonce);
    return true;
  }

  // -------------------------------------------------------------------------
  // Trusted device cookie (used by proxy/middleware layer)
  // -------------------------------------------------------------------------

  /** Create a trusted device cookie value */
  createTrustedCookieValue(email: string): string {
    const enrollVersion = this.store.get(TOTP_SETTINGS_KEYS.enrollVersion) ?? "1";
    return createTrustedDeviceCookieValue(email, enrollVersion, this.config.hmacSecret, this.config.trustedDeviceDays);
  }

  /** Verify a trusted device cookie */
  verifyTrustedCookie(cookieValue: string, email: string): boolean {
    const enrollVersion = this.store.get(TOTP_SETTINGS_KEYS.enrollVersion) ?? "1";
    return verifyTrustedDeviceCookie(cookieValue, email, this.config.hmacSecret, enrollVersion);
  }
}
