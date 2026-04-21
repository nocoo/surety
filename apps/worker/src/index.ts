/**
 * Surety D1 + R2 Proxy Worker
 *
 * Routes:
 *   POST   /query    — single prepared statement (auth required)
 *   POST   /batch    — atomic multi-statement (auth required)
 *   GET    /api/live — liveness check (no auth)
 *   PUT    /r2/:key  — upload file to R2 (auth required)
 *   GET    /r2/:key  — download file from R2 (auth required)
 *   DELETE /r2/:key  — delete file from R2 (auth required)
 */

import type { Env } from "./db";
import { verifyAuth } from "./auth";
import { resolveDb } from "./db";
import { handleQuery } from "./routes/query";
import { handleBatch } from "./routes/batch";
import { handleLive } from "./routes/live";
import { handleR2Put, handleR2Get, handleR2Delete } from "./routes/r2";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // Liveness check — no auth required, always uses production DB
    if (path === "/api/live" && request.method === "GET") {
      const resolved = resolveDb(request, env);
      if ("error" in resolved) return withCors(resolved.error);
      return withCors(await handleLive(resolved.db));
    }

    // All other routes require auth
    const authError = verifyAuth(request, env.WORKER_SHARED_SECRET);
    if (authError) return withCors(authError);

    // R2 routes — key is everything after /r2/ (may contain slashes)
    if (path.startsWith("/r2/")) {
      const key = decodeURIComponent(path.slice(4));
      if (!key) {
        return withCors(
          new Response(JSON.stringify({ error: "Missing R2 key" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      switch (request.method) {
        case "PUT":
          return withCors(await handleR2Put(request, env, key));
        case "GET":
          return withCors(await handleR2Get(request, env, key));
        case "DELETE":
          return withCors(await handleR2Delete(request, env, key));
        default:
          return withCors(
            new Response(JSON.stringify({ error: "Method not allowed" }), {
              status: 405,
              headers: { "Content-Type": "application/json" },
            }),
          );
      }
    }

    // Resolve target D1 database
    const resolved = resolveDb(request, env);
    if ("error" in resolved) return withCors(resolved.error);
    const { db } = resolved;

    // Route dispatch
    if (path === "/query" && request.method === "POST") {
      return withCors(await handleQuery(request, db));
    }

    if (path === "/batch" && request.method === "POST") {
      return withCors(await handleBatch(request, db));
    }

    return withCors(
      new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );
  },
} satisfies ExportedHandler<Env>;

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Target-DB",
  };
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
