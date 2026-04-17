/**
 * Regression tests for proxy decision logic and 2FA cookie issuance.
 *
 * These tests cover the pure decision functions extracted from proxy.ts
 * and verify-2fa/route.ts. They ensure:
 *
 * 1. resolveProxyAction() — full proxy 2FA decision table
 * 2. checkTrustedDevice() — trusted device cookie validation integration
 * 3. shouldIssueTrustedCookie() — recovery code must NOT issue trusted cookie
 *
 * Regression targets:
 * - Fix 2 (5b5ad2e): recovery code login no longer issues trusted cookie
 * - Fix 3 (525dbd0): trusted-device users redirected away from /verify-2fa
 */
import { describe, expect, test } from "bun:test";
import {
  resolveProxyAction,
  checkTrustedDevice,
  shouldIssueTrustedCookie,
  type ProxyContext,
  type ProxyAction,
} from "@/lib/proxy-logic";

// ===========================================================================
// resolveProxyAction — Full proxy decision table
// ===========================================================================

describe("resolveProxyAction", () => {
  // -----------------------------------------------------------------------
  // Helper to build context with defaults
  // -----------------------------------------------------------------------
  function ctx(overrides: Partial<ProxyContext> = {}): ProxyContext {
    return {
      isLoggedIn: true,
      pathname: "/",
      twoFactorVerified: true,
      isTrusted: false,
      twoFactorEnabled: true,
      ...overrides,
    };
  }

  // -----------------------------------------------------------------------
  // Unauthenticated user
  // -----------------------------------------------------------------------

  describe("unauthenticated user", () => {
    test("page request → redirect to /login", () => {
      const action = resolveProxyAction(ctx({ isLoggedIn: false, pathname: "/dashboard" }));
      expect(action).toEqual({ type: "redirect", to: "/login" });
    });

    test("API request → 401 JSON", () => {
      const action = resolveProxyAction(ctx({ isLoggedIn: false, pathname: "/api/policies" }));
      expect(action).toEqual({ type: "json", status: 401 });
    });

    test("/login page → allow through (can see login page)", () => {
      const action = resolveProxyAction(ctx({ isLoggedIn: false, pathname: "/login" }));
      expect(action).toEqual({ type: "next" });
    });
  });

  // -----------------------------------------------------------------------
  // Authenticated, 2FA verified (or not required)
  // -----------------------------------------------------------------------

  describe("authenticated, 2FA verified", () => {
    test("normal page → allow through", () => {
      const action = resolveProxyAction(ctx({ twoFactorVerified: true, pathname: "/dashboard" }));
      expect(action).toEqual({ type: "next" });
    });

    test("API request → allow through", () => {
      const action = resolveProxyAction(ctx({ twoFactorVerified: true, pathname: "/api/policies" }));
      expect(action).toEqual({ type: "next" });
    });

    test("/login page → redirect to / (already logged in)", () => {
      const action = resolveProxyAction(ctx({ twoFactorVerified: true, pathname: "/login" }));
      expect(action).toEqual({ type: "redirect", to: "/" });
    });

    test("/verify-2fa → redirect to / (already verified, no re-prompt)", () => {
      const action = resolveProxyAction(ctx({ twoFactorVerified: true, pathname: "/verify-2fa" }));
      expect(action).toEqual({ type: "redirect", to: "/" });
    });
  });

  // -----------------------------------------------------------------------
  // Authenticated, 2FA NOT verified, NOT trusted device
  // -----------------------------------------------------------------------

  describe("authenticated, 2FA not verified, not trusted", () => {
    const base: Partial<ProxyContext> = {
      isLoggedIn: true,
      twoFactorVerified: false,
      isTrusted: false,
    };

    test("normal page → redirect to /verify-2fa", () => {
      const action = resolveProxyAction(ctx({ ...base, pathname: "/dashboard" }));
      expect(action).toEqual({ type: "redirect", to: "/verify-2fa" });
    });

    test("API request → 403 JSON (2FA required)", () => {
      const action = resolveProxyAction(ctx({ ...base, pathname: "/api/policies" }));
      expect(action).toEqual({ type: "json", status: 403 });
    });

    test("/verify-2fa page → allow through (user needs to complete 2FA)", () => {
      const action = resolveProxyAction(ctx({ ...base, pathname: "/verify-2fa" }));
      expect(action).toEqual({ type: "next" });
    });

    test("/login page → redirect to / (already logged in, even if 2FA pending)", () => {
      const action = resolveProxyAction(ctx({ ...base, pathname: "/login" }));
      expect(action).toEqual({ type: "redirect", to: "/" });
    });
  });

  // -----------------------------------------------------------------------
  // [REGRESSION] Authenticated, 2FA NOT verified, IS trusted device
  // Covers Fix 3 (525dbd0): trusted device users redirected away from /verify-2fa
  // -----------------------------------------------------------------------

  describe("authenticated, 2FA not verified, trusted device", () => {
    const base: Partial<ProxyContext> = {
      isLoggedIn: true,
      twoFactorVerified: false,
      isTrusted: true,
    };

    test("normal page → allow through (trusted device bypasses 2FA)", () => {
      const action = resolveProxyAction(ctx({ ...base, pathname: "/dashboard" }));
      expect(action).toEqual({ type: "next" });
    });

    test("API request → allow through (trusted device bypasses 2FA)", () => {
      const action = resolveProxyAction(ctx({ ...base, pathname: "/api/policies" }));
      expect(action).toEqual({ type: "next" });
    });

    test("[REGRESSION] /verify-2fa → redirect to / (trusted device should not re-prompt)", () => {
      const action = resolveProxyAction(ctx({ ...base, pathname: "/verify-2fa" }));
      expect(action).toEqual({ type: "redirect", to: "/" });
    });
  });

  // -----------------------------------------------------------------------
  // [REGRESSION] JWT stale: twoFactorVerified=false but 2FA disabled in DB
  // Covers deadlock: proxy redirects to /verify-2fa, but API says "2FA not enabled"
  // -----------------------------------------------------------------------

  describe("2FA disabled in DB but JWT stale (twoFactorVerified=false)", () => {
    const base: Partial<ProxyContext> = {
      isLoggedIn: true,
      twoFactorVerified: false,
      isTrusted: false,
      twoFactorEnabled: false,
    };

    test("[REGRESSION] normal page → allow through (2FA no longer active)", () => {
      const action = resolveProxyAction(ctx({ ...base, pathname: "/dashboard" }));
      expect(action).toEqual({ type: "next" });
    });

    test("[REGRESSION] API request → allow through (2FA no longer active)", () => {
      const action = resolveProxyAction(ctx({ ...base, pathname: "/api/policies" }));
      expect(action).toEqual({ type: "next" });
    });

    test("[REGRESSION] /verify-2fa → redirect to / (no 2FA to verify)", () => {
      const action = resolveProxyAction(ctx({ ...base, pathname: "/verify-2fa" }));
      expect(action).toEqual({ type: "redirect", to: "/" });
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases: twoFactorVerified undefined (2FA not configured)
  // -----------------------------------------------------------------------

  describe("twoFactorVerified undefined (2FA not configured)", () => {
    test("normal page → allow through", () => {
      const action = resolveProxyAction(ctx({ twoFactorVerified: undefined, pathname: "/dashboard" }));
      expect(action).toEqual({ type: "next" });
    });

    test("/verify-2fa → redirect to / (2FA not configured, no reason to be here)", () => {
      // When twoFactorVerified is undefined (2FA not configured), the else branch
      // catches isVerify2FAPage and redirects home — consistent with "verified" behavior
      const action = resolveProxyAction(ctx({ twoFactorVerified: undefined, pathname: "/verify-2fa" }));
      expect(action).toEqual({ type: "redirect", to: "/" });
    });
  });

  // -----------------------------------------------------------------------
  // Decision table completeness: exhaustive matrix
  // -----------------------------------------------------------------------

  describe("decision table completeness", () => {
    const scenarios: Array<{ label: string; ctx: Partial<ProxyContext>; expected: ProxyAction }> = [
      // Not logged in
      { label: "guest → /", ctx: { isLoggedIn: false, pathname: "/" }, expected: { type: "redirect", to: "/login" } },
      { label: "guest → /api/x", ctx: { isLoggedIn: false, pathname: "/api/x" }, expected: { type: "json", status: 401 } },
      { label: "guest → /login", ctx: { isLoggedIn: false, pathname: "/login" }, expected: { type: "next" } },

      // Logged in, verified
      { label: "verified → /", ctx: { isLoggedIn: true, twoFactorVerified: true, pathname: "/" }, expected: { type: "next" } },
      { label: "verified → /verify-2fa", ctx: { isLoggedIn: true, twoFactorVerified: true, pathname: "/verify-2fa" }, expected: { type: "redirect", to: "/" } },
      { label: "verified → /login", ctx: { isLoggedIn: true, twoFactorVerified: true, pathname: "/login" }, expected: { type: "redirect", to: "/" } },

      // Logged in, not verified, not trusted
      { label: "unverified+untrusted → /", ctx: { isLoggedIn: true, twoFactorVerified: false, isTrusted: false, pathname: "/" }, expected: { type: "redirect", to: "/verify-2fa" } },
      { label: "unverified+untrusted → /api/x", ctx: { isLoggedIn: true, twoFactorVerified: false, isTrusted: false, pathname: "/api/x" }, expected: { type: "json", status: 403 } },
      { label: "unverified+untrusted → /verify-2fa", ctx: { isLoggedIn: true, twoFactorVerified: false, isTrusted: false, pathname: "/verify-2fa" }, expected: { type: "next" } },

      // Logged in, not verified, trusted
      { label: "unverified+trusted → /", ctx: { isLoggedIn: true, twoFactorVerified: false, isTrusted: true, pathname: "/" }, expected: { type: "next" } },
      { label: "unverified+trusted → /api/x", ctx: { isLoggedIn: true, twoFactorVerified: false, isTrusted: true, pathname: "/api/x" }, expected: { type: "next" } },
      { label: "unverified+trusted → /verify-2fa", ctx: { isLoggedIn: true, twoFactorVerified: false, isTrusted: true, pathname: "/verify-2fa" }, expected: { type: "redirect", to: "/" } },
    ];

    for (const { label, ctx: overrides, expected } of scenarios) {
      test(label, () => {
        expect(resolveProxyAction(ctx(overrides))).toEqual(expected);
      });
    }
  });
});

// ===========================================================================
// checkTrustedDevice — Cookie validation integration
// ===========================================================================

describe("checkTrustedDevice", () => {
  const alwaysTrue = () => true;
  const alwaysFalse = () => false;

  test("handles cookie presence and verifier delegation", async () => {
    // No cookie: returns false regardless of verifier
    expect(await checkTrustedDevice(undefined, "user@example.com", alwaysTrue)).toBe(false);
    expect(await checkTrustedDevice("", "user@example.com", alwaysTrue)).toBe(false);
    
    // With cookie: delegates to verifier
    expect(await checkTrustedDevice("some-value", "user@example.com", alwaysTrue)).toBe(true);
    expect(await checkTrustedDevice("some-value", "user@example.com", alwaysFalse)).toBe(false);
  });

  test("passes correct arguments to verifier", async () => {
    const capturedArgs: string[][] = [];
    await checkTrustedDevice("cookie-123", "alice@example.com", (cv, em) => {
      capturedArgs.push([cv, em]);
      return true;
    });
    expect(capturedArgs).toEqual([["cookie-123", "alice@example.com"]]);
  });
});

// ===========================================================================
// [REGRESSION] shouldIssueTrustedCookie
// Covers Fix 2 (5b5ad2e): recovery code login must NOT issue trusted cookie
// ===========================================================================

describe("shouldIssueTrustedCookie", () => {
  test("TOTP issues cookie only when rememberDevice=true", () => {
    expect(shouldIssueTrustedCookie("totp", true)).toBe(true);
    expect(shouldIssueTrustedCookie("totp", false)).toBe(false);
  });

  test("[REGRESSION] recovery NEVER issues cookie regardless of rememberDevice", () => {
    expect(shouldIssueTrustedCookie("recovery", true)).toBe(false);
    expect(shouldIssueTrustedCookie("recovery", false)).toBe(false);
  });
});
