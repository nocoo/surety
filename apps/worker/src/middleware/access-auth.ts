import type { Context, Next } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppEnv } from "../lib/types";
import { isLocalhost } from "./is-localhost";

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksCacheTeamDomain: string | null = null;

function getJWKS(teamDomain: string) {
  if (jwksCache && jwksCacheTeamDomain === teamDomain) return jwksCache;
  jwksCache = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
  jwksCacheTeamDomain = teamDomain;
  return jwksCache;
}

// The bearer-token API host bypasses CF Access entirely; apiKeyAuth handles it.
function isMachineEndpoint(c: Context<AppEnv>): boolean {
  const host = c.req.header("host") ?? "";
  return host === "surety-api.hexly.ai";
}

/**
 * Verify the Cloudflare Access JWT for browser-facing requests.
 *
 * Fail-CLOSED: if accessAuth is expected to run on a request (i.e. not a
 * whitelisted path / localhost / machine endpoint), every failure mode
 * short-circuits with an error response instead of falling through to
 * apiKeyAuth. Falling through was a CSRF-like footgun — a request that
 * never traversed CF Access (config drift, header strip, forged JWT)
 * would be treated as "no Access session, try apiKey" and could pass via
 * other means.
 *
 * Whitelist short-circuits (still set or skip flags, then next()):
 *   - /api/live (public liveness probe)
 *   - localhost / dev host (with bearer-token escape hatch for CLI dev)
 *   - surety-api.hexly.ai (machine endpoint — apiKeyAuth gates it)
 *   - E2E_SKIP_AUTH=true in a non-production environment (L2-HTTP runner)
 *
 * Fail-closed responses on the CF Access-protected host:
 *   - env missing → 500 (deployment configuration error)
 *   - Cf-Access-Jwt-Assertion missing → 401
 *   - JWT signature / issuer / audience invalid → 403
 */
export async function accessAuth(c: Context<AppEnv>, next: Next) {
  if (c.req.path === "/api/live") return next();

  if (isLocalhost(c)) {
    // Don't short-circuit when the caller sent a bearer token — let
    // apiKeyAuth verify it so `accessEmail` gets populated for /api/me.
    const hasBearer = (c.req.header("Authorization") ?? "").startsWith(
      "Bearer ",
    );
    if (!hasBearer) {
      c.set("accessAuthenticated", true);
      c.set("sessionAuthenticated", true);
    }
    return next();
  }

  if (isMachineEndpoint(c)) return next();

  // L2-HTTP harness (wrangler dev) sets E2E_SKIP_AUTH=true so the
  // browser-host code path is reachable without a real CF Access JWT.
  // Match the apiKeyAuth/originGuard bypass shape: only honoured when
  // ENVIRONMENT is not production, so a leaked var on prod cannot
  // re-open the fail-open hole this commit closes.
  if (
    c.env?.E2E_SKIP_AUTH === "true" &&
    c.env?.ENVIRONMENT !== "production"
  ) {
    return next();
  }

  const teamDomain = c.env.CF_ACCESS_TEAM_DOMAIN;
  const aud = c.env.CF_ACCESS_AUD;

  if (!(teamDomain && aud)) {
    return c.json(
      {
        error:
          "Access authentication not configured. Set CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD.",
      },
      500,
    );
  }

  const jwt = c.req.header("Cf-Access-Jwt-Assertion");
  if (!jwt) {
    return c.json({ error: "Missing Access JWT" }, 401);
  }

  try {
    const jwks = getJWKS(teamDomain);
    const { payload } = await jwtVerify(jwt, jwks, {
      issuer: `https://${teamDomain}`,
      audience: aud,
    });
    c.set("accessAuthenticated", true);
    c.set("sessionAuthenticated", true);
    if (typeof payload.email === "string") {
      c.set("accessEmail", payload.email);
    }
  } catch {
    return c.json({ error: "Invalid Access JWT" }, 403);
  }

  return next();
}
