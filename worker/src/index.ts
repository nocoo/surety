/**
 * Surety D1 Proxy Worker
 *
 * Routes:
 *   POST /query   — single prepared statement (auth required)
 *   POST /batch   — atomic multi-statement (auth required)
 *   GET  /health  — liveness check (no auth)
 */

import type { Env } from "./db";
import { verifyAuth } from "./auth";
import { resolveDb } from "./db";
import { handleQuery } from "./routes/query";
import { handleBatch } from "./routes/batch";
import { handleHealth } from "./routes/health";

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

    // Health check — no auth required, always uses production DB
    if (path === "/health" && request.method === "GET") {
      const resolved = resolveDb(request, env);
      if ("error" in resolved) return withCors(resolved.error);
      return withCors(await handleHealth(resolved.db));
    }

    // All other routes require auth
    const authError = verifyAuth(request, env.WORKER_SHARED_SECRET);
    if (authError) return withCors(authError);

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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
