/**
 * Unit tests for the MCP HTTP API client.
 *
 * We stub globalThis.fetch to capture outgoing requests and shape responses.
 * Exercises: base URL resolution, Bearer header injection, trailing-slash
 * normalization, HTTP verb handling, error body extraction.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { apiDelete, apiGet, apiPost, apiPut } from "../src/api-client";

type Call = { url: string; method: string; headers: Record<string, string>; body: string | null };

const originalFetch = globalThis.fetch;
let calls: Call[] = [];

function mockFetch(response: { status: number; json: unknown }) {
  globalThis.fetch = (async (input: URL | string, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const h = new Headers(init.headers);
      h.forEach((v, k) => {
        headers[k.toLowerCase()] = v;
      });
    }
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers,
      body: (init?.body as string | null | undefined) ?? null,
    });
    return new Response(JSON.stringify(response.json), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

beforeEach(() => {
  calls = [];
  process.env.SURETY_API_URL = "https://surety.example/";
  process.env.SURETY_API_TOKEN = "sk_unit_test";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.SURETY_API_URL;
  delete process.env.SURETY_API_TOKEN;
});

describe("apiGet", () => {
  test("strips trailing slash, GETs with Bearer header, parses JSON", async () => {
    mockFetch({ status: 200, json: { id: 1, name: "Alice" } });
    const body = await apiGet<{ id: number; name: string }>("/api/members/1");
    expect(body).toEqual({ id: 1, name: "Alice" });
    expect(calls.length).toBe(1);
    expect(calls[0]?.url).toBe("https://surety.example/api/members/1");
    expect(calls[0]?.method).toBe("GET");
    expect(calls[0]?.headers["authorization"]).toBe("Bearer sk_unit_test");
  });

  test("omits Authorization when no token is configured", async () => {
    delete process.env.SURETY_API_TOKEN;
    mockFetch({ status: 200, json: [] });
    await apiGet("/api/members");
    expect(calls[0]?.headers["authorization"]).toBeUndefined();
  });

  test("falls back to default base URL when env is unset", async () => {
    delete process.env.SURETY_API_URL;
    mockFetch({ status: 200, json: [] });
    await apiGet("/api/members");
    expect(calls[0]?.url).toBe("https://surety.hexly.ai/api/members");
  });

  test("surfaces server error.message on non-2xx", async () => {
    mockFetch({ status: 404, json: { error: "member not found" } });
    await expect(apiGet("/api/members/999")).rejects.toThrow("member not found");
  });

  test("falls back to HTTP N when body is not JSON", async () => {
    globalThis.fetch = (async () =>
      new Response("not json", { status: 500 })) as unknown as typeof fetch;
    await expect(apiGet("/api/members")).rejects.toThrow("HTTP 500");
  });
});

describe("apiPost", () => {
  test("sends JSON body with Content-Type and Bearer token", async () => {
    mockFetch({ status: 201, json: { id: 7 } });
    const out = await apiPost<{ id: number }>("/api/members", { name: "Bob" });
    expect(out).toEqual({ id: 7 });
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.headers["content-type"]).toBe("application/json");
    expect(calls[0]?.body).toBe(JSON.stringify({ name: "Bob" }));
  });

  test("sends null body when arg is undefined", async () => {
    mockFetch({ status: 200, json: {} });
    await apiPost("/api/action");
    expect(calls[0]?.body).toBeNull();
  });
});

describe("apiPut", () => {
  test("sends JSON body as PUT", async () => {
    mockFetch({ status: 200, json: { ok: true } });
    await apiPut("/api/members/1", { name: "Alice" });
    expect(calls[0]?.method).toBe("PUT");
    expect(calls[0]?.body).toBe(JSON.stringify({ name: "Alice" }));
  });
});

describe("apiDelete", () => {
  test("DELETEs with Bearer and returns void on success", async () => {
    mockFetch({ status: 204, json: {} });
    await apiDelete("/api/members/1");
    expect(calls[0]?.method).toBe("DELETE");
    expect(calls[0]?.headers["authorization"]).toBe("Bearer sk_unit_test");
  });

  test("throws with error body on non-2xx", async () => {
    mockFetch({ status: 403, json: { error: "forbidden" } });
    await expect(apiDelete("/api/members/1")).rejects.toThrow("forbidden");
  });
});
