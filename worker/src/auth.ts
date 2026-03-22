/**
 * Shared secret authentication for Worker proxy.
 * Verifies `Authorization: Bearer <secret>` header.
 */

export function verifyAuth(
  request: Request,
  secret: string,
): Response | null {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [scheme, token] = authHeader.split(" ", 2);

  if (scheme !== "Bearer" || !token) {
    return new Response(JSON.stringify({ error: "Invalid Authorization scheme" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(token, secret)) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null; // auth passed
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);

  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }

  return diff === 0;
}
