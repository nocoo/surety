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
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    twoFactorVerified?: boolean;
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
 */
async function isTwoFactorEnabled(): Promise<boolean> {
  try {
    const { settingsRepo } = await import("@/db/repositories/settings");
    return settingsRepo.get("totp.enabled") === "true";
  } catch {
    // DB not available (e.g. during build) — treat as disabled
    return false;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Trust the host header for automatic URL detection
  // This allows the app to work behind reverse proxies without manual NEXTAUTH_URL config
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
    async jwt({ token, trigger }: { token: JWT; trigger?: string }) {
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
        // Called from verify-2fa API after successful TOTP verification
        // The API sets twoFactorVerified via session update
        token.twoFactorVerified = true;
      }

      return token;
    },
    async session({ session, token }: { session: DefaultSession & { user: DefaultSession["user"] & { twoFactorVerified?: boolean } }; token: JWT }) {
      session.user.twoFactorVerified = token.twoFactorVerified ?? true;
      return session;
    },
  },
});
