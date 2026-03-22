import NextAuth, { type DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";

// ---------------------------------------------------------------------------
// NextAuth type extensions for 2FA
// ---------------------------------------------------------------------------

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      twoFactorVerified?: boolean;
      /** True when this session was authenticated via recovery code (not TOTP) */
      recoverySession?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    twoFactorVerified?: boolean;
    /** True when this session was authenticated via recovery code (not TOTP) */
    recoverySession?: boolean;
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Get allowed emails from environment variable
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

// For reverse proxy environments with HTTPS, we need secure cookies
// Set USE_SECURE_COOKIES=true in .env when using HTTPS reverse proxy in development
const useSecureCookies =
  process.env.NODE_ENV === "production" ||
  process.env.NEXTAUTH_URL?.startsWith("https://") ||
  process.env.USE_SECURE_COOKIES === "true";

// Skip auth/2FA in E2E test mode
const skipAuth = process.env.E2E_SKIP_AUTH === "true";

/**
 * Check if TOTP 2FA is enabled by reading the settings DB.
 * Lazy-imported to avoid circular dependency and keep auth.ts lightweight.
 * Fails closed (returns true = 2FA required) on DB error in non-build contexts.
 */
async function isTwoFactorEnabled(): Promise<boolean> {
  try {
    const { getTotpService } = await import("@/lib/totp");
    const totp = await getTotpService();
    return totp.isEnabled();
  } catch (err) {
    // During build, DB is unavailable — safe to skip
    if (process.env.NODE_ENV === "production" && typeof (globalThis as Record<string, unknown>).EdgeRuntime === "undefined") {
      console.error("[2FA] Failed to check isTwoFactorEnabled, failing closed:", err);
      return true; // fail closed: require 2FA
    }
    // Build-time / edge compilation — treat as disabled
    return false;
  }
}

/**
 * Verify a 2FA nonce from session update. Consumes the nonce (single-use).
 * Returns true only if the nonce is valid and matches the stored value.
 */
async function consumeVerificationNonce(nonce: string, signature: string): Promise<boolean> {
  try {
    const { getTotpService } = await import("@/lib/totp");
    const totp = await getTotpService();
    return totp.consumeNonce(nonce, signature);
  } catch {
    return false;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Trust the host header for automatic URL detection
  // This allows the app to work behind reverse proxies without manual NEXTAUTH_URL config
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // Cookie configuration for reverse proxy environments
  cookies: {
    pkceCodeVerifier: {
      name: useSecureCookies
        ? "__Secure-authjs.pkce.code_verifier"
        : "authjs.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    state: {
      name: useSecureCookies ? "__Secure-authjs.state" : "authjs.state",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: useSecureCookies
        ? "__Secure-authjs.callback-url"
        : "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    sessionToken: {
      name: useSecureCookies
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      name: useSecureCookies ? "__Host-authjs.csrf-token" : "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  callbacks: {
    async signIn({ user }) {
      // Only allow specific emails
      const email = user.email?.toLowerCase();
      if (!email || !allowedEmails.includes(email)) {
        return false;
      }
      return true;
    },
    async jwt({ token, trigger, session: sessionUpdate }: { token: JWT; trigger?: string; session?: Record<string, unknown> }) {
      if (skipAuth) {
        token.twoFactorVerified = true;
        return token;
      }

      if (trigger === "signIn") {
        // Fresh login: check if 2FA is enabled
        const enabled = await isTwoFactorEnabled();
        // If 2FA not enabled, user is verified by default
        // If enabled, user must verify via /verify-2fa (trusted device checked in proxy)
        token.twoFactorVerified = !enabled;
      }

      if (trigger === "update") {
        // Only promote to verified if the client presents a valid server-signed nonce
        const nonce = sessionUpdate?.twoFactorNonce as string | undefined;
        const sig = sessionUpdate?.twoFactorSig as string | undefined;
        if (nonce && sig) {
          const valid = await consumeVerificationNonce(nonce, sig);
          if (valid) {
            token.twoFactorVerified = true;
            // Sync recoverySession: set to true only when explicitly flagged (recovery code login),
            // otherwise clear it. This ensures re-setup or normal TOTP verification revokes the
            // one-time force-disable privilege granted by recovery code authentication.
            token.recoverySession = sessionUpdate?.recoverySession === true;
          }
        }
        // Allow clearing recoverySession without a nonce (e.g. after force-disable)
        if (sessionUpdate?.clearRecoverySession === true) {
          token.recoverySession = false;
        }
        // If no nonce or invalid nonce, twoFactorVerified remains unchanged
      }

      return token;
    },
    async session({ session, token }: { session: DefaultSession & { user: DefaultSession["user"] & { twoFactorVerified?: boolean; recoverySession?: boolean } }; token: JWT }) {
      // NOTE: twoFactorVerified reflects explicit nonce promotion only.
      // Trusted-device cookie is a request-scoped bypass checked in proxy.
      // Effective 2FA satisfied = twoFactorVerified || trusted cookie valid.
      // Proxy is the sole enforcement point for access control.
      session.user.twoFactorVerified = token.twoFactorVerified ?? true;
      session.user.recoverySession = token.recoverySession ?? false;
      return session;
    },
  },
});
