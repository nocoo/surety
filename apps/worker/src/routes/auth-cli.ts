import { Hono } from "hono";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

/**
 * Reject callback URLs that are not http://127.0.0.1:* or http://localhost:*.
 * CLI loopback servers cannot present a valid TLS certificate, so only http
 * is allowed and only on the loopback hostnames.
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

/**
 * CLI token mint endpoint.
 *
 * Flow:
 *   1. CLI opens GET /api/auth/cli?callback_url=http://127.0.0.1:PORT/cb&state=NONCE
 *   2. CF Access intercepts; user authenticates via Google and is bounced back
 *      with a Cf-Access-Jwt-Assertion header. accessAuth middleware verifies
 *      the JWT and writes payload.email into context as `accessEmail`.
 *   3. This handler mints a fresh API token bound to that email and 302s to
 *      callback_url?api_key=...&state=...&email=...
 *
 * Security:
 *   - callback_url must point to http://127.0.0.1:* or http://localhost:*.
 *   - `state` is echoed back unchanged for CSRF defense.
 *   - An authenticated Access session OR a valid Bearer token is required to
 *     reach this handler (middleware enforces). If neither is present the
 *     request is already rejected upstream.
 *   - Minting requires a verified Access email. Bearer-only callers (who
 *     already have a token) have no reason to call this endpoint and are
 *     rejected with 400 to avoid issuing a token without a known owner.
 */
app.get("/api/auth/cli", async (c) => {
  const callbackUrl = c.req.query("callback_url");
  const state = c.req.query("state") ?? "";

  if (!callbackUrl) {
    return c.json({ error: "callback_url is required" }, 400);
  }
  if (!isLocalhostUrl(callbackUrl)) {
    return c.json({ error: "callback_url must be a localhost URL" }, 400);
  }

  const email = c.get("accessEmail");
  if (!email) {
    return c.json(
      { error: "CF Access session required to mint a CLI token" },
      400,
    );
  }

  const repos = c.get("repos");
  const { token } = await repos.apiTokens.create(email, "CLI");

  const redirect = new URL(callbackUrl);
  redirect.searchParams.set("api_key", token);
  if (state) redirect.searchParams.set("state", state);
  redirect.searchParams.set("email", email);

  return c.redirect(redirect.toString(), 302);
});

export default app;
