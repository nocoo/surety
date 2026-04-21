import type { Context, Next } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppEnv } from "../lib/types";

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

  const teamDomain = c.env.CF_ACCESS_TEAM_DOMAIN;
  const aud = c.env.CF_ACCESS_AUD;

  if (!(teamDomain && aud)) return next();

  const jwt = c.req.header("Cf-Access-Jwt-Assertion");
  if (!jwt) return next();

  try {
    const jwks = getJWKS(teamDomain);
    await jwtVerify(jwt, jwks, {
      issuer: `https://${teamDomain}`,
      audience: aud,
    });
    c.set("accessAuthenticated", true);
  } catch {
    // JWT invalid — fall through to apiKeyAuth
  }

  return next();
}
