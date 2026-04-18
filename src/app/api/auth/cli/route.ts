import { NextRequest, NextResponse } from "next/server";
import { auth, signIn } from "@/auth";
import { getReposFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * CLI login endpoint.
 *
 * Flow:
 *   1. CLI opens GET /api/auth/cli?callback_url=http://127.0.0.1:PORT/cb&state=NONCE
 *   2. If user has no NextAuth session, redirect through Google OAuth and come
 *      back here (NextAuth's signIn() preserves the callbackUrl).
 *   3. Once authenticated, mint a fresh API token bound to the user's email and
 *      301-redirect to callback_url?api_key=...&state=...&email=...
 *
 * Security:
 *   - The callback URL must point to localhost (http://127.0.0.1:* or
 *     http://localhost:*). Anything else is rejected to prevent token leakage.
 *   - The `state` value is echoed back unchanged so the CLI can defeat CSRF.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const callbackUrl = url.searchParams.get("callback_url");
  const state = url.searchParams.get("state") ?? "";

  if (!callbackUrl) {
    return NextResponse.json(
      { error: "callback_url is required" },
      { status: 400 },
    );
  }

  if (!isLocalhostUrl(callbackUrl)) {
    return NextResponse.json(
      { error: "callback_url must be a localhost URL" },
      { status: 400 },
    );
  }

  // Require an authenticated session before issuing a token. If the user
  // hasn't logged in yet, kick them through Google OAuth and come back here.
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    const selfUrl = new URL("/api/auth/cli", url);
    selfUrl.searchParams.set("callback_url", callbackUrl);
    if (state) selfUrl.searchParams.set("state", state);
    return signIn("google", { redirectTo: selfUrl.toString() });
  }

  // 2FA users cannot use CLI authentication by design.
  // CLI tokens bypass 2FA verification, so we reject token issuance entirely.
  try {
    const { getTotpService } = await import("@/lib/totp");
    const totp = await getTotpService();
    if (await totp.isEnabled()) {
      return NextResponse.json(
        { error: "CLI authentication is not available for accounts with 2FA enabled" },
        { status: 403 },
      );
    }
  } catch {
    // DB unavailable — fail closed (reject token issuance)
    return NextResponse.json(
      { error: "Unable to verify 2FA status" },
      { status: 503 },
    );
  }

  // Mint a new long-lived token for this CLI session.
  const { repos } = await getReposFromRequest();
  const { token } = await repos.apiTokens.create(email, "CLI");

  const redirect = new URL(callbackUrl);
  redirect.searchParams.set("api_key", token);
  if (state) redirect.searchParams.set("state", state);
  redirect.searchParams.set("email", email);

  return NextResponse.redirect(redirect.toString());
}

/**
 * Reject anything that is not http://127.0.0.1:* or http://localhost:*.
 * Both schemes are required to be `http:` because CLI loopback servers cannot
 * present a valid TLS certificate.
 */
export function isLocalhostUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:") return false;
  return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
}
