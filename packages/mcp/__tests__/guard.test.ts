/**
 * Unit tests for the MCP guard (mcp.enabled gate).
 *
 * The guard hits /api/settings/mcp.enabled on the Worker unless the env var
 * override is set. We stub fetch to control the API response.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { checkMcpEnabled, mcpDisabledResult } from "../src/guard";

const originalFetch = globalThis.fetch;

function mockFetch(
  response: { status: number; body: unknown } | { error: Error },
) {
  globalThis.fetch = (async () => {
    if ("error" in response) throw response.error;
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

beforeEach(() => {
  delete process.env.SURETY_MCP_ENABLED;
  process.env.SURETY_API_URL = "https://surety.example";
  process.env.SURETY_API_TOKEN = "sk_test";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.SURETY_MCP_ENABLED;
  delete process.env.SURETY_API_URL;
  delete process.env.SURETY_API_TOKEN;
});

describe("checkMcpEnabled", () => {
  test("env override bypasses API check", async () => {
    process.env.SURETY_MCP_ENABLED = "true";
    globalThis.fetch = (async () => {
      throw new Error("fetch should not be called");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
    expect(await checkMcpEnabled()).toBeUndefined();
  });

  test("returns undefined when API says enabled=true", async () => {
    mockFetch({ status: 200, body: { key: "mcp.enabled", value: "true" } });
    expect(await checkMcpEnabled()).toBeUndefined();
  });

  test("returns disabled message when API says enabled=false", async () => {
    mockFetch({ status: 200, body: { key: "mcp.enabled", value: "false" } });
    const msg = await checkMcpEnabled();
    expect(msg).toContain("MCP access is disabled");
    expect(msg).toContain("/settings");
  });

  test("returns disabled message when value is null/missing", async () => {
    mockFetch({ status: 200, body: { key: "mcp.enabled", value: null } });
    expect(await checkMcpEnabled()).toContain("MCP access is disabled");
  });

  test("treats API unreachable as disabled", async () => {
    mockFetch({ error: new Error("network down") });
    expect(await checkMcpEnabled()).toContain("MCP access is disabled");
  });

  test("treats API 500 as disabled", async () => {
    mockFetch({ status: 500, body: { error: "boom" } });
    expect(await checkMcpEnabled()).toContain("MCP access is disabled");
  });
});

describe("mcpDisabledResult", () => {
  test("returns an error result with the disabled message", () => {
    const r = mcpDisabledResult();
    expect(r.isError).toBe(true);
    expect(r.content[0]?.type).toBe("text");
    expect(r.content[0]?.text).toContain("MCP access is disabled");
  });
});
