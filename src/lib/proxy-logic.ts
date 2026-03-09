/**
 * Pure decision logic extracted from proxy.ts for testability.
 *
 * The proxy handler (proxy.ts) remains the sole enforcement point,
 * but the decision logic is tested independently here.
 */

// ---------------------------------------------------------------------------
// Proxy 2FA decision table
// ---------------------------------------------------------------------------

/** Possible proxy actions for a given request context */
export type ProxyAction =
  | { type: "next" }                          // Allow through
  | { type: "redirect"; to: "/" | "/login" | "/verify-2fa" }
  | { type: "json"; status: 401 | 403 };     // API error response

/** Inputs that determine the proxy routing decision */
export interface ProxyContext {
  isLoggedIn: boolean;
  pathname: string;
  twoFactorVerified: boolean | undefined;
  isTrusted: boolean;
  /** Whether 2FA is currently enabled in the DB. Used to break deadlock when
   *  JWT says unverified but 2FA has been disabled since login. */
  twoFactorEnabled: boolean;
}

/**
 * Determine the proxy action for a request based on auth/2FA state.
 *
 * This is a pure function that encodes the full proxy decision table.
 * Auth routes (/api/auth/* and /api/auth/verify-2fa) are assumed to be
 * pre-filtered before calling this function.
 */
export function resolveProxyAction(ctx: ProxyContext): ProxyAction {
  const isApiRoute = ctx.pathname.startsWith("/api/");
  const isLoginPage = ctx.pathname === "/login";
  const isVerify2FAPage = ctx.pathname === "/verify-2fa";

  // Redirect to home if logged in and trying to access login page
  if (isLoginPage && ctx.isLoggedIn) {
    return { type: "redirect", to: "/" };
  }

  // Not authenticated
  if (!isLoginPage && !ctx.isLoggedIn) {
    if (isApiRoute) {
      return { type: "json", status: 401 };
    }
    return { type: "redirect", to: "/login" };
  }

  // --- 2FA guard ---
  if (ctx.isLoggedIn) {
    if (ctx.twoFactorVerified === false) {
      // JWT says unverified — but 2FA may have been disabled since login.
      // Check DB truth to avoid deadlock (/verify-2fa ↔ "2FA not enabled").
      if (!ctx.twoFactorEnabled) {
        if (isVerify2FAPage) {
          return { type: "redirect", to: "/" };
        }
        return { type: "next" };
      }

      if (ctx.isTrusted) {
        // Trusted device — redirect away from /verify-2fa, allow everything else
        if (isVerify2FAPage) {
          return { type: "redirect", to: "/" };
        }
        return { type: "next" };
      }

      // Not verified and not trusted — block access (except /verify-2fa itself)
      if (!isVerify2FAPage) {
        if (isApiRoute) {
          return { type: "json", status: 403 };
        }
        return { type: "redirect", to: "/verify-2fa" };
      }
    } else {
      // Already verified via nonce — redirect away from /verify-2fa
      if (isVerify2FAPage) {
        return { type: "redirect", to: "/" };
      }
    }
  }

  return { type: "next" };
}

// ---------------------------------------------------------------------------
// Trusted device check (pure wrapper for testability)
// ---------------------------------------------------------------------------

/**
 * Check if a cookie value represents a valid trusted device for the given email.
 *
 * This is a thin wrapper that takes explicit dependencies:
 * - cookieValue: the raw cookie string (or undefined if no cookie)
 * - email: the user's email
 * - verifier: function that validates the cookie (injected from TotpService)
 */
export function checkTrustedDevice(
  cookieValue: string | undefined,
  email: string,
  verifier: (cookieValue: string, email: string) => boolean,
): boolean {
  if (!cookieValue) return false;
  return verifier(cookieValue, email);
}

// ---------------------------------------------------------------------------
// Trusted cookie issuance decision
// ---------------------------------------------------------------------------

/**
 * Determine whether a trusted-device cookie should be issued after 2FA verification.
 *
 * Recovery codes are break-glass credentials — they must NEVER grant persistent
 * device trust. Only TOTP verification can issue a trusted-device cookie.
 */
export function shouldIssueTrustedCookie(
  type: "totp" | "recovery",
  rememberDevice: boolean,
): boolean {
  return rememberDevice && type !== "recovery";
}
