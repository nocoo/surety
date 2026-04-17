/**
 * 2FA API E2E Tests
 *
 * Tests the complete 2FA lifecycle via real HTTP calls:
 * - GET /api/settings/2fa/status
 * - POST /api/settings/2fa/setup
 * - POST /api/settings/2fa/verify-setup
 * - POST /api/settings/2fa/disable
 * - POST /api/auth/verify-2fa
 *
 * Note: In E2E mode (E2E_SKIP_AUTH=true), a mock session is used.
 * TOTP token generation uses the otpauth library to generate valid tokens.
 */
import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";
import * as OTPAuth from "otpauth";

interface TwoFactorStatus {
  enabled: boolean;
  recoveryCodeUsed: boolean;
}

interface SetupResponse {
  qrDataURL: string;
  secret: string;
}

interface VerifySetupResponse {
  success: boolean;
  recoveryCode: string;
  twoFactorNonce: string;
  twoFactorSig: string;
}

interface DisableResponse {
  success: boolean;
  clearRecoverySession?: boolean;
}

interface VerifyLoginResponse {
  success: boolean;
  twoFactorNonce: string;
  twoFactorSig: string;
  recoverySession?: boolean;
}

interface ErrorResponse {
  error: string;
}

/**
 * Generate a valid TOTP token from a secret
 */
function generateTotpToken(secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: "Surety",
    label: "e2e-test@example.com",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.generate();
}

/**
 * Clean up any existing 2FA state before tests
 * Uses the E2E-only reset endpoint
 */
async function cleanupTwoFactorState(): Promise<void> {
  await apiRequest("/api/settings/2fa/reset", { method: "POST" }).catch(() => {
    // Ignore errors (endpoint may not exist or 2FA not enabled)
  });
}

describe("2FA API E2E", () => {
  beforeAll(async () => {
    await setupE2E();
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  });

  // Clean up 2FA state before each test to ensure isolation
  beforeEach(async () => {
    await cleanupTwoFactorState();
  });

  describe("GET /api/settings/2fa/status", () => {
    test("returns disabled status when 2FA is not set up", async () => {
      const { status, data } = await apiRequest<TwoFactorStatus>(
        "/api/settings/2fa/status"
      );

      expect(status).toBe(200);
      expect(data.enabled).toBe(false);
      expect(data.recoveryCodeUsed).toBe(false);
    });
  });

  describe("POST /api/settings/2fa/setup", () => {
    test("generates QR code and secret", async () => {
      const { status, data } = await apiRequest<SetupResponse>(
        "/api/settings/2fa/setup",
        { method: "POST" }
      );

      expect(status).toBe(200);
      expect(data.qrDataURL).toMatch(/^data:image\/png;base64,/);
      expect(data.secret).toHaveLength(32); // Base32 encoded secret
    });

    test("returns 409 if 2FA is already enabled", async () => {
      // First, set up and enable 2FA
      const { data: setupData } = await apiRequest<SetupResponse>(
        "/api/settings/2fa/setup",
        { method: "POST" }
      );

      const token = generateTotpToken(setupData.secret);
      await apiRequest<VerifySetupResponse>("/api/settings/2fa/verify-setup", {
        method: "POST",
        body: JSON.stringify({ token }),
      });

      // Try to setup again
      const { status, data } = await apiRequest<ErrorResponse>(
        "/api/settings/2fa/setup",
        { method: "POST" }
      );

      expect(status).toBe(409);
      expect(data.error).toContain("already enabled");
    });
  });

  describe("POST /api/settings/2fa/verify-setup", () => {
    test("enables 2FA with valid token and returns recovery code", async () => {
      // Setup first
      const { data: setupData } = await apiRequest<SetupResponse>(
        "/api/settings/2fa/setup",
        { method: "POST" }
      );

      // Generate valid token
      const token = generateTotpToken(setupData.secret);

      // Verify setup
      const { status, data } = await apiRequest<VerifySetupResponse>(
        "/api/settings/2fa/verify-setup",
        {
          method: "POST",
          body: JSON.stringify({ token }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.recoveryCode).toBeDefined();
      expect(data.recoveryCode.length).toBeGreaterThan(0);
      expect(data.twoFactorNonce).toBeDefined();
      expect(data.twoFactorSig).toBeDefined();

      // Verify status is now enabled
      const { data: statusData } = await apiRequest<TwoFactorStatus>(
        "/api/settings/2fa/status"
      );
      expect(statusData.enabled).toBe(true);
      // Recovery code hasn't been used yet, just generated
      expect(statusData.recoveryCodeUsed).toBe(false);
    });

    test("returns 400 for invalid token format", async () => {
      const { status, data } = await apiRequest<ErrorResponse>(
        "/api/settings/2fa/verify-setup",
        {
          method: "POST",
          body: JSON.stringify({ token: "invalid" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("6-digit");
    });

    test("returns 400 for wrong token", async () => {
      // Setup first
      await apiRequest<SetupResponse>("/api/settings/2fa/setup", {
        method: "POST",
      });

      // Use wrong token
      const { status, data } = await apiRequest<ErrorResponse>(
        "/api/settings/2fa/verify-setup",
        {
          method: "POST",
          body: JSON.stringify({ token: "000000" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test("returns 409 if 2FA is already enabled", async () => {
      // Setup and enable 2FA
      const { data: setupData } = await apiRequest<SetupResponse>(
        "/api/settings/2fa/setup",
        { method: "POST" }
      );

      const token = generateTotpToken(setupData.secret);
      await apiRequest<VerifySetupResponse>("/api/settings/2fa/verify-setup", {
        method: "POST",
        body: JSON.stringify({ token }),
      });

      // Try to verify again
      const { status, data } = await apiRequest<ErrorResponse>(
        "/api/settings/2fa/verify-setup",
        {
          method: "POST",
          body: JSON.stringify({ token }),
        }
      );

      expect(status).toBe(409);
      expect(data.error).toContain("already enabled");
    });
  });

  describe("POST /api/settings/2fa/disable", () => {
    test("disables 2FA with valid token", async () => {
      // Setup and enable 2FA
      const { data: setupData } = await apiRequest<SetupResponse>(
        "/api/settings/2fa/setup",
        { method: "POST" }
      );

      const token = generateTotpToken(setupData.secret);
      await apiRequest<VerifySetupResponse>("/api/settings/2fa/verify-setup", {
        method: "POST",
        body: JSON.stringify({ token }),
      });

      // Wait a bit for the token to change (TOTP has 30s window)
      // Generate a new valid token for disable
      const disableToken = generateTotpToken(setupData.secret);

      // Disable 2FA
      const { status, data } = await apiRequest<DisableResponse>(
        "/api/settings/2fa/disable",
        {
          method: "POST",
          body: JSON.stringify({ token: disableToken }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);

      // Verify status is now disabled
      const { data: statusData } = await apiRequest<TwoFactorStatus>(
        "/api/settings/2fa/status"
      );
      expect(statusData.enabled).toBe(false);
    });

    test("returns 400 for invalid token format", async () => {
      const { status, data } = await apiRequest<ErrorResponse>(
        "/api/settings/2fa/disable",
        {
          method: "POST",
          body: JSON.stringify({ token: "invalid" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("6-digit");
    });

    test("returns 403 for force disable without recovery session", async () => {
      // Setup and enable 2FA
      const { data: setupData } = await apiRequest<SetupResponse>(
        "/api/settings/2fa/setup",
        { method: "POST" }
      );

      const token = generateTotpToken(setupData.secret);
      await apiRequest<VerifySetupResponse>("/api/settings/2fa/verify-setup", {
        method: "POST",
        body: JSON.stringify({ token }),
      });

      // Try force disable (should fail - no recovery session in E2E mock)
      const { status, data } = await apiRequest<ErrorResponse>(
        "/api/settings/2fa/disable",
        {
          method: "POST",
          body: JSON.stringify({ force: true }),
        }
      );

      expect(status).toBe(403);
      expect(data.error).toContain("recovery code");
    });
  });

  describe("POST /api/auth/verify-2fa", () => {
    test("returns 400 when 2FA is not enabled", async () => {
      const { status, data } = await apiRequest<ErrorResponse>(
        "/api/auth/verify-2fa",
        {
          method: "POST",
          body: JSON.stringify({ token: "123456" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("not enabled");
    });

    test("verifies TOTP token and returns nonce", async () => {
      // Setup and enable 2FA
      const { data: setupData } = await apiRequest<SetupResponse>(
        "/api/settings/2fa/setup",
        { method: "POST" }
      );

      const setupToken = generateTotpToken(setupData.secret);
      await apiRequest<VerifySetupResponse>("/api/settings/2fa/verify-setup", {
        method: "POST",
        body: JSON.stringify({ token: setupToken }),
      });

      // Verify login with TOTP
      const loginToken = generateTotpToken(setupData.secret);
      const { status, data } = await apiRequest<VerifyLoginResponse>(
        "/api/auth/verify-2fa",
        {
          method: "POST",
          body: JSON.stringify({ token: loginToken, type: "totp" }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.twoFactorNonce).toBeDefined();
      expect(data.twoFactorSig).toBeDefined();
    });

    test("verifies recovery code and returns nonce with recoverySession flag", async () => {
      // Setup and enable 2FA
      const { data: setupData } = await apiRequest<SetupResponse>(
        "/api/settings/2fa/setup",
        { method: "POST" }
      );

      const setupToken = generateTotpToken(setupData.secret);
      const { data: verifyData } = await apiRequest<VerifySetupResponse>(
        "/api/settings/2fa/verify-setup",
        {
          method: "POST",
          body: JSON.stringify({ token: setupToken }),
        }
      );

      // Verify login with recovery code
      const { status, data } = await apiRequest<VerifyLoginResponse>(
        "/api/auth/verify-2fa",
        {
          method: "POST",
          body: JSON.stringify({
            token: verifyData.recoveryCode,
            type: "recovery",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.recoverySession).toBe(true);
    });

    test("returns 400 for missing token", async () => {
      // Setup and enable 2FA first
      const { data: setupData } = await apiRequest<SetupResponse>(
        "/api/settings/2fa/setup",
        { method: "POST" }
      );

      const setupToken = generateTotpToken(setupData.secret);
      await apiRequest<VerifySetupResponse>("/api/settings/2fa/verify-setup", {
        method: "POST",
        body: JSON.stringify({ token: setupToken }),
      });

      // Try without token
      const { status, data } = await apiRequest<ErrorResponse>(
        "/api/auth/verify-2fa",
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("required");
    });

    test("returns 400 for invalid TOTP format", async () => {
      // Setup and enable 2FA first
      const { data: setupData } = await apiRequest<SetupResponse>(
        "/api/settings/2fa/setup",
        { method: "POST" }
      );

      const setupToken = generateTotpToken(setupData.secret);
      await apiRequest<VerifySetupResponse>("/api/settings/2fa/verify-setup", {
        method: "POST",
        body: JSON.stringify({ token: setupToken }),
      });

      // Try invalid format
      const { status, data } = await apiRequest<ErrorResponse>(
        "/api/auth/verify-2fa",
        {
          method: "POST",
          body: JSON.stringify({ token: "invalid", type: "totp" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain("6-digit");
    });

    test("returns 401 for wrong TOTP token", async () => {
      // Setup and enable 2FA
      const { data: setupData } = await apiRequest<SetupResponse>(
        "/api/settings/2fa/setup",
        { method: "POST" }
      );

      const setupToken = generateTotpToken(setupData.secret);
      await apiRequest<VerifySetupResponse>("/api/settings/2fa/verify-setup", {
        method: "POST",
        body: JSON.stringify({ token: setupToken }),
      });

      // Try wrong token
      const { status, data } = await apiRequest<ErrorResponse>(
        "/api/auth/verify-2fa",
        {
          method: "POST",
          body: JSON.stringify({ token: "000000", type: "totp" }),
        }
      );

      expect(status).toBe(401);
      expect(data.error).toBeDefined();
    });
  });

  describe("Full 2FA lifecycle", () => {
    test("setup → enable → verify login → disable", async () => {
      // 1. Check initial status
      const { data: initialStatus } = await apiRequest<TwoFactorStatus>(
        "/api/settings/2fa/status"
      );
      expect(initialStatus.enabled).toBe(false);

      // 2. Setup
      const { data: setupData } = await apiRequest<SetupResponse>(
        "/api/settings/2fa/setup",
        { method: "POST" }
      );
      expect(setupData.secret).toBeDefined();

      // 3. Enable (verify setup)
      const setupToken = generateTotpToken(setupData.secret);
      const { data: verifyData } = await apiRequest<VerifySetupResponse>(
        "/api/settings/2fa/verify-setup",
        {
          method: "POST",
          body: JSON.stringify({ token: setupToken }),
        }
      );
      expect(verifyData.success).toBe(true);
      expect(verifyData.recoveryCode).toBeDefined();

      // 4. Check enabled status
      const { data: enabledStatus } = await apiRequest<TwoFactorStatus>(
        "/api/settings/2fa/status"
      );
      expect(enabledStatus.enabled).toBe(true);

      // 5. Verify login
      const loginToken = generateTotpToken(setupData.secret);
      const { data: loginData } = await apiRequest<VerifyLoginResponse>(
        "/api/auth/verify-2fa",
        {
          method: "POST",
          body: JSON.stringify({ token: loginToken, type: "totp" }),
        }
      );
      expect(loginData.success).toBe(true);

      // 6. Disable
      const disableToken = generateTotpToken(setupData.secret);
      const { data: disableData } = await apiRequest<DisableResponse>(
        "/api/settings/2fa/disable",
        {
          method: "POST",
          body: JSON.stringify({ token: disableToken }),
        }
      );
      expect(disableData.success).toBe(true);

      // 7. Check disabled status
      const { data: finalStatus } = await apiRequest<TwoFactorStatus>(
        "/api/settings/2fa/status"
      );
      expect(finalStatus.enabled).toBe(false);
    });
  });
});
