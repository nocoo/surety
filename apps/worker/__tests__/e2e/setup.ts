/**
 * L2 E2E test harness — full Hono app over an in-memory SQLite DB.
 *
 * Replaces the production `dbMiddleware` (which expects a D1 binding) with one
 * that wires the bun:sqlite test DB into the request context. Auth is bypassed
 * via E2E_SKIP_AUTH so suites can drive routes directly.
 */
import { Hono } from "hono";
import { createTestDb, resetTestDb } from "@surety/db";
import { createAllRepos } from "@surety/db/repositories";

import liveRoutes from "../../src/routes/live";
import membersRoutes from "../../src/routes/members";
import policiesRoutes from "../../src/routes/policies";
import insurersRoutes from "../../src/routes/insurers";
import assetsRoutes from "../../src/routes/assets";
import hospitalsRoutes from "../../src/routes/hospitals";
import doctorsRoutes from "../../src/routes/doctors";
import medicalVisitsRoutes from "../../src/routes/medical-visits";
import dashboardRoutes from "../../src/routes/dashboard";
import settingsRoutes from "../../src/routes/settings";
import backupRoutes from "../../src/routes/backup";
import coverageLookupRoutes from "../../src/routes/coverage-lookup";
import renewalCalendarRoutes from "../../src/routes/renewal-calendar";
import authRoutes from "../../src/routes/auth";
import authCliRoutes from "../../src/routes/auth-cli";
import meRoutes from "../../src/routes/me";
import type { AppEnv } from "../../src/lib/types";

export interface TestEnv {
  app: Hono<AppEnv>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repos: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bindings: Record<string, any>;
}

/**
 * Build a test app instance with a freshly reset in-memory DB.
 * Each call returns an isolated DB so suites don't bleed state.
 */
export function buildTestApp(): TestEnv {
  process.env.SURETY_TARGET_DB = "test";
  process.env.E2E_SKIP_AUTH = "true";

  const db = createTestDb();
  resetTestDb();
  const repos = createAllRepos(db);

  const r2: Map<string, { body: ArrayBuffer; contentType?: string }> =
    new Map();
  const fakeR2 = {
    async put(
      key: string,
      body: ReadableStream | ArrayBuffer | Uint8Array | string,
      opts?: { httpMetadata?: { contentType?: string } },
    ) {
      let bytes: ArrayBuffer;
      if (body instanceof ReadableStream) {
        const r = await new Response(body).arrayBuffer();
        bytes = r;
      } else if (typeof body === "string") {
        bytes = new TextEncoder().encode(body).buffer as ArrayBuffer;
      } else if (body instanceof Uint8Array) {
        bytes = body.buffer.slice(
          body.byteOffset,
          body.byteOffset + body.byteLength,
        ) as ArrayBuffer;
      } else {
        bytes = body;
      }
      r2.set(key, { body: bytes, contentType: opts?.httpMetadata?.contentType });
    },
    async get(key: string) {
      const obj = r2.get(key);
      if (!obj) return null;
      return {
        body: new Response(obj.body).body,
      };
    },
    async delete(key: string) {
      r2.delete(key);
    },
  };

  const fakeD1 = {
    prepare: (_sql: string) => ({
      first: async () => ({ probe: 1 }),
    }),
  };

  const app = new Hono<AppEnv>();
  app.use("/api/*", async (c, next) => {
    c.set("db", db);
    c.set("repos", repos);
    return next();
  });

  app.route("/", liveRoutes);
  app.route("/", membersRoutes);
  app.route("/", policiesRoutes);
  app.route("/", insurersRoutes);
  app.route("/", assetsRoutes);
  app.route("/", hospitalsRoutes);
  app.route("/", doctorsRoutes);
  app.route("/", medicalVisitsRoutes);
  app.route("/", dashboardRoutes);
  app.route("/", settingsRoutes);
  app.route("/", backupRoutes);
  app.route("/", coverageLookupRoutes);
  app.route("/", renewalCalendarRoutes);
  app.route("/", authRoutes);
  app.route("/", authCliRoutes);
  app.route("/", meRoutes);

  const bindings = {
    DB: fakeD1,
    ATTACHMENTS: fakeR2,
    E2E_SKIP_AUTH: "true",
  };

  return { app, db, repos, bindings };
}

export async function jsonRequest(
  env: TestEnv,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", host: "localhost:7016" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await env.app.request(path, init, env.bindings);
  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed };
}
