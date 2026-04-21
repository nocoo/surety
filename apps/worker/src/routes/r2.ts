/**
 * R2 route handlers: PUT, GET, DELETE.
 * All handlers stream data — no intermediate buffering.
 */

import type { Env } from "../db";
import { resolveR2 } from "../r2";

/**
 * PUT /r2/:key — Upload file to R2.
 * Streams request body directly into R2 bucket.
 */
export async function handleR2Put(
  request: Request,
  env: Env,
  key: string,
): Promise<Response> {
  const resolved = resolveR2(request, env);
  if ("error" in resolved) return resolved.error;

  const contentType =
    request.headers.get("Content-Type") || "application/octet-stream";

  const object = await resolved.bucket.put(key, request.body, {
    httpMetadata: { contentType },
  });

  return new Response(
    JSON.stringify({
      key: object.key,
      size: object.size,
      etag: object.etag,
    }),
    {
      status: 201,
      headers: { "Content-Type": "application/json" },
    },
  );
}

/**
 * GET /r2/:key — Download/stream file from R2.
 * Returns the object body with preserved Content-Type.
 */
export async function handleR2Get(
  request: Request,
  env: Env,
  key: string,
): Promise<Response> {
  const resolved = resolveR2(request, env);
  if ("error" in resolved) return resolved.error;

  const object = await resolved.bucket.get(key);

  if (!object) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType || "application/octet-stream",
  );
  headers.set("Content-Length", object.size.toString());
  headers.set("ETag", object.etag);
  // Private: browser can cache, CDNs must not
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(object.body, { headers });
}

/**
 * DELETE /r2/:key — Delete file from R2.
 * Idempotent: returns 204 even if key didn't exist.
 */
export async function handleR2Delete(
  request: Request,
  env: Env,
  key: string,
): Promise<Response> {
  const resolved = resolveR2(request, env);
  if ("error" in resolved) return resolved.error;

  await resolved.bucket.delete(key);

  return new Response(null, { status: 204 });
}
