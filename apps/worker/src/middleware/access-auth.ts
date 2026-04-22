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

  const teamDomain = c.env.CF_ACCESS_TEAM_DOMAIN;
  const aud = c.env.CF_ACCESS_AUD;

  if (!(teamDomain && aud)) return next();

  const jwt = c.req.header("Cf-Access-Jwt-Assertion");
  if (!jwt) return next();

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
    // JWT invalid — fall through to apiKeyAuth
  }

  return next();
}
