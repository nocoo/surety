/**
 * Unit tests for the /api/auth/cli CLI token mint endpoint.
 *
 * We test the Hono sub-app directly (not the full Worker) and inject
 * `accessAuthenticated` + `accessEmail` + `repos` via a wrapper middleware
 * to mimic what the real middleware chain produces.
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";
import authCliRoutes, { isLocalhostUrl } from "../src/routes/auth-cli";
import type { AppEnv } from "../src/lib/types";

type MintArgs = { email: string; name: string };

function makeApp(opts: {
  accessEmail?: string;
  accessAuthenticated?: boolean;
  minted?: MintArgs[];
}) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (opts.accessAuthenticated) c.set("accessAuthenticated", true);
    if (opts.accessEmail) c.set("accessEmail", opts.accessEmail);
    // Inject a fake `repos` object with just apiTokens.create
    // Cast to the shape consumers expect; only `create` is exercised here.
    c.set("repos", {
      apiTokens: {
        create: mock((email: string, name: string) => {
          opts.minted?.push({ email, name });
          return Promise.resolve({
            token: "sk_freshly_minted",
            id: 1,
            tokenPrefix: "sk_fresh",
          });
        }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    return next();
  });
  app.route("/", authCliRoutes);
  return app;
}

describe("isLocalhostUrl", () => {
  test("accepts http://127.0.0.1:* and http://localhost:*", () => {
    expect(isLocalhostUrl("http://127.0.0.1:5173/cb")).toBe(true);
    expect(isLocalhostUrl("http://localhost:8080/cb")).toBe(true);
  });

  test("rejects https / non-loopback / malformed", () => {
    expect(isLocalhostUrl("https://127.0.0.1:5173/cb")).toBe(false);
    expect(isLocalhostUrl("http://example.com/cb")).toBe(false);
    expect(isLocalhostUrl("http://192.168.1.1/cb")).toBe(false);
    expect(isLocalhostUrl("not a url")).toBe(false);
    expect(isLocalhostUrl("")).toBe(false);
  });
});

describe("GET /api/auth/cli", () => {
  let minted: MintArgs[] = [];

  beforeEach(() => {
    minted = [];
  });

  test("rejects request missing callback_url with 400", async () => {
    const app = makeApp({ accessEmail: "alice@example.com", minted });
    const res = await app.request("/api/auth/cli");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/callback_url is required/);
    expect(minted.length).toBe(0);
  });

  test("rejects non-localhost callback_url with 400", async () => {
    const app = makeApp({ accessEmail: "alice@example.com", minted });
    const res = await app.request(
      "/api/auth/cli?callback_url=" +
        encodeURIComponent("https://evil.com/cb"),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/localhost/);
    expect(minted.length).toBe(0);
  });

  test("rejects request without verified Access email with 400", async () => {
    const app = makeApp({ minted }); // no accessEmail
    const res = await app.request(
      "/api/auth/cli?callback_url=" +
        encodeURIComponent("http://127.0.0.1:5173/cb"),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Access session required/);
    expect(minted.length).toBe(0);
  });

  test("mints token and 302s back to callback with api_key+state+email", async () => {
    const app = makeApp({
      accessEmail: "alice@example.com",
      accessAuthenticated: true,
      minted,
    });
    const res = await app.request(
      "/api/auth/cli?callback_url=" +
        encodeURIComponent("http://127.0.0.1:5173/cb") +
        "&state=xyz",
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get("location");
    expect(loc).toBeTruthy();
    const url = new URL(loc!);
    expect(url.origin + url.pathname).toBe("http://127.0.0.1:5173/cb");
    expect(url.searchParams.get("api_key")).toBe("sk_freshly_minted");
    expect(url.searchParams.get("state")).toBe("xyz");
    expect(url.searchParams.get("email")).toBe("alice@example.com");
    expect(minted).toEqual([{ email: "alice@example.com", name: "CLI" }]);
  });

  test("redirect omits state when none was supplied", async () => {
    const app = makeApp({
      accessEmail: "alice@example.com",
      accessAuthenticated: true,
      minted,
    });
    const res = await app.request(
      "/api/auth/cli?callback_url=" +
        encodeURIComponent("http://localhost:9999/done"),
    );
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get("location")!);
    expect(url.searchParams.has("state")).toBe(false);
    expect(url.searchParams.get("api_key")).toBe("sk_freshly_minted");
    expect(url.searchParams.get("email")).toBe("alice@example.com");
  });

  test("accepts `callback` as an alias of `callback_url`", async () => {
    const app = makeApp({
      accessEmail: "alice@example.com",
      accessAuthenticated: true,
      minted,
    });
    const res = await app.request(
      "/api/auth/cli?callback=" +
        encodeURIComponent("http://127.0.0.1:5173/cb") +
        "&state=abc",
    );
    expect(res.status).toBe(302);
    const url = new URL(res.headers.get("location")!);
    expect(url.origin + url.pathname).toBe("http://127.0.0.1:5173/cb");
    expect(url.searchParams.get("api_key")).toBe("sk_freshly_minted");
    expect(url.searchParams.get("state")).toBe("abc");
  });
});
