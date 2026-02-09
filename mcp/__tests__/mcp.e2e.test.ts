/**
 * MCP E2E Tests
 *
 * These tests simulate an external AI agent (e.g., Claude Code, Cursor)
 * connecting to the Surety MCP server via stdio transport.
 *
 * Flow:
 * 1. Seed a test database with known data
 * 2. Spawn MCP server as a child process (just like a real agent would)
 * 3. Connect via MCP Client + StdioClientTransport
 * 4. Call tools and verify results
 *
 * Prerequisites:
 * - SURETY_MCP_TEST_DB env var points to the seeded test database
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "path";

const MCP_ENTRY = resolve(import.meta.dir, "../index.ts");
const TEST_DB = resolve(import.meta.dir, "../../surety.mcp-test.db");

// ---------------------------------------------------------------------------
// Helper: create a fresh MCP client connected via stdio
// ---------------------------------------------------------------------------
async function createMcpClient(
  env?: Record<string, string>,
): Promise<{ client: Client; transport: StdioClientTransport }> {
  // Build a clean env: strip test-mode flags so the MCP subprocess
  // uses the file-based SURETY_DB instead of in-memory test DB
  const baseEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && k !== "BUN_ENV" && k !== "NODE_ENV") {
      baseEnv[k] = v;
    }
  }
  const transport = new StdioClientTransport({
    command: "bun",
    args: ["run", MCP_ENTRY],
    env: {
      ...baseEnv,
      NODE_ENV: "development",
      SURETY_DB: TEST_DB,
      ...env,
    },
  });
  const client = new Client({ name: "test-agent", version: "1.0.0" });
  await client.connect(transport);
  return { client, transport };
}

// Helper: call a tool and return the text content
async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ text: string; isError: boolean }> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as Array<{ type: string; text: string }>;
  const text = content.map((c) => c.text).join("\n");
  return { text, isError: result.isError === true };
}

// Helper: parse JSON from tool response
function parseToolJson(text: string): unknown {
  return JSON.parse(text);
}

// ===========================================================================
// Test setup: seed the database before all tests
// ===========================================================================

beforeAll(async () => {
  // Seed the test database via a helper script
  const seedResult = Bun.spawnSync(
    ["bun", "run", "scripts/seed-mcp-test.ts"],
    {
      cwd: resolve(import.meta.dir, "../.."),
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        SURETY_DB: TEST_DB,
      },
    },
  );
  if (seedResult.exitCode !== 0) {
    const stderr = seedResult.stderr.toString();
    throw new Error(`Failed to seed MCP test database: ${stderr}`);
  }
});

afterAll(async () => {
  // Clean up test database
  const { unlinkSync, existsSync } = await import("fs");
  if (existsSync(TEST_DB)) {
    unlinkSync(TEST_DB);
  }
});

// ===========================================================================
// 1. Security Guard: MCP disabled
// ===========================================================================

describe("MCP security guard", () => {
  test("all tools should return error when mcp.enabled is not set", async () => {
    // Seed without mcp.enabled setting (default = disabled)
    const { client, transport } = await createMcpClient();
    try {
      const result = await callTool(client, "list-members");
      expect(result.isError).toBe(true);
      expect(result.text).toContain("MCP access is disabled");
      expect(result.text).toContain("settings");
    } finally {
      await client.close();
      await transport.close();
    }
  });

  test("should return helpful guidance message when disabled", async () => {
    const { client, transport } = await createMcpClient();
    try {
      const result = await callTool(client, "list-policies");
      expect(result.isError).toBe(true);
      expect(result.text).toContain("http://localhost:7015/settings");
    } finally {
      await client.close();
      await transport.close();
    }
  });
});

// ===========================================================================
// 2. Tool discovery
// ===========================================================================

describe("MCP tool discovery", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    // Enable MCP via env override for enabled tests
    const result = createMcpClient({ SURETY_MCP_ENABLED: "true" });
    ({ client, transport } = await result);
  });

  afterAll(async () => {
    await client.close();
    await transport.close();
  });

  test("should list all available tools", async () => {
    const tools = await client.listTools();
    const toolNames = tools.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual([
      "coverage-analysis",
      "dashboard-summary",
      "get-member",
      "get-policy",
      "list-assets",
      "list-members",
      "list-policies",
      "renewal-overview",
    ]);
  });

  test("each tool should have a description", async () => {
    const tools = await client.listTools();
    for (const tool of tools.tools) {
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe("string");
    }
  });
});

// ===========================================================================
// 3. Members tools
// ===========================================================================

describe("list-members tool", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    ({ client, transport } = await createMcpClient({
      SURETY_MCP_ENABLED: "true",
    }));
  });

  afterAll(async () => {
    await client.close();
    await transport.close();
  });

  test("should return all family members", async () => {
    const result = await callTool(client, "list-members");
    expect(result.isError).toBeFalsy();
    const data = parseToolJson(result.text) as Array<{
      name: string;
      relation: string;
    }>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(7); // seed has 7 members
    // Verify key members exist
    const names = data.map((m) => m.name);
    expect(names).toContain("张伟");
    expect(names).toContain("李娜");
    expect(names).toContain("张小明");
  });

  test("each member should have essential fields", async () => {
    const result = await callTool(client, "list-members");
    const data = parseToolJson(result.text) as Array<Record<string, unknown>>;
    for (const member of data) {
      expect(member).toHaveProperty("id");
      expect(member).toHaveProperty("name");
      expect(member).toHaveProperty("relation");
    }
  });
});

describe("get-member tool", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    ({ client, transport } = await createMcpClient({
      SURETY_MCP_ENABLED: "true",
    }));
  });

  afterAll(async () => {
    await client.close();
    await transport.close();
  });

  test("should return a specific member by id", async () => {
    const result = await callTool(client, "get-member", { memberId: 1 });
    expect(result.isError).toBeFalsy();
    const data = parseToolJson(result.text) as { name: string; relation: string; policies: unknown[] };
    expect(data.name).toBe("张伟");
    expect(data.relation).toBe("Self");
    // Should include related policies
    expect(data).toHaveProperty("policies");
    expect(Array.isArray(data.policies)).toBe(true);
  });

  test("should return error for non-existent member", async () => {
    const result = await callTool(client, "get-member", { memberId: 9999 });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("not found");
  });
});

// ===========================================================================
// 4. Policies tools
// ===========================================================================

describe("list-policies tool", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    ({ client, transport } = await createMcpClient({
      SURETY_MCP_ENABLED: "true",
    }));
  });

  afterAll(async () => {
    await client.close();
    await transport.close();
  });

  test("should return all policies without filters", async () => {
    const result = await callTool(client, "list-policies");
    expect(result.isError).toBeFalsy();
    const data = parseToolJson(result.text) as Array<Record<string, unknown>>;
    expect(data.length).toBe(8); // seed has 8 policies
  });

  test("should filter by status", async () => {
    const result = await callTool(client, "list-policies", {
      status: "Active",
    });
    const data = parseToolJson(result.text) as Array<{ status: string }>;
    expect(data.length).toBeGreaterThan(0);
    for (const policy of data) {
      expect(policy.status).toBe("Active");
    }
  });

  test("should filter by category", async () => {
    const result = await callTool(client, "list-policies", {
      category: "Medical",
    });
    const data = parseToolJson(result.text) as Array<{ category: string }>;
    expect(data.length).toBe(2); // 2 Medical policies in seed
    for (const policy of data) {
      expect(policy.category).toBe("Medical");
    }
  });

  test("should filter by memberId (insured member)", async () => {
    const result = await callTool(client, "list-policies", { memberId: 1 });
    const data = parseToolJson(result.text) as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThan(0);
  });

  test("each policy should have essential fields", async () => {
    const result = await callTool(client, "list-policies");
    const data = parseToolJson(result.text) as Array<Record<string, unknown>>;
    for (const policy of data) {
      expect(policy).toHaveProperty("id");
      expect(policy).toHaveProperty("productName");
      expect(policy).toHaveProperty("policyNumber");
      expect(policy).toHaveProperty("category");
      expect(policy).toHaveProperty("status");
      expect(policy).toHaveProperty("premium");
      expect(policy).toHaveProperty("sumAssured");
    }
  });
});

describe("get-policy tool", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    ({ client, transport } = await createMcpClient({
      SURETY_MCP_ENABLED: "true",
    }));
  });

  afterAll(async () => {
    await client.close();
    await transport.close();
  });

  test("should return full policy detail", async () => {
    const result = await callTool(client, "get-policy", { policyId: 1 });
    expect(result.isError).toBeFalsy();
    const data = parseToolJson(result.text) as Record<string, unknown>;
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("productName");
    expect(data).toHaveProperty("policyNumber");
    expect(data).toHaveProperty("applicantName");
    expect(data).toHaveProperty("insuredName");
    expect(data).toHaveProperty("beneficiaries");
  });

  test("should return error for non-existent policy", async () => {
    const result = await callTool(client, "get-policy", { policyId: 9999 });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("not found");
  });
});

// ===========================================================================
// 5. Assets tool
// ===========================================================================

describe("list-assets tool", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    ({ client, transport } = await createMcpClient({
      SURETY_MCP_ENABLED: "true",
    }));
  });

  afterAll(async () => {
    await client.close();
    await transport.close();
  });

  test("should return all assets", async () => {
    const result = await callTool(client, "list-assets");
    expect(result.isError).toBeFalsy();
    const data = parseToolJson(result.text) as Array<{
      name: string;
      type: string;
    }>;
    expect(data.length).toBe(3); // seed has 3 assets
    const types = data.map((a) => a.type);
    expect(types).toContain("RealEstate");
    expect(types).toContain("Vehicle");
  });

  test("each asset should have essential fields", async () => {
    const result = await callTool(client, "list-assets");
    const data = parseToolJson(result.text) as Array<Record<string, unknown>>;
    for (const asset of data) {
      expect(asset).toHaveProperty("id");
      expect(asset).toHaveProperty("name");
      expect(asset).toHaveProperty("type");
      expect(asset).toHaveProperty("identifier");
      expect(asset).toHaveProperty("ownerName");
    }
  });
});

// ===========================================================================
// 6. Coverage analysis tool
// ===========================================================================

describe("coverage-analysis tool", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    ({ client, transport } = await createMcpClient({
      SURETY_MCP_ENABLED: "true",
    }));
  });

  afterAll(async () => {
    await client.close();
    await transport.close();
  });

  test("should return coverage analysis for a member", async () => {
    const result = await callTool(client, "coverage-analysis", {
      type: "member",
      id: 1,
    });
    expect(result.isError).toBeFalsy();
    const data = parseToolJson(result.text) as Record<string, unknown>;
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("totalPremium");
    expect(data).toHaveProperty("totalSumAssured");
    expect(data).toHaveProperty("policies");
  });

  test("should return coverage analysis for an asset", async () => {
    const result = await callTool(client, "coverage-analysis", {
      type: "asset",
      id: 1,
    });
    expect(result.isError).toBeFalsy();
    const data = parseToolJson(result.text) as Record<string, unknown>;
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("policies");
  });

  test("should return error for non-existent target", async () => {
    const result = await callTool(client, "coverage-analysis", {
      type: "member",
      id: 9999,
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("not found");
  });
});

// ===========================================================================
// 7. Renewal overview tool
// ===========================================================================

describe("renewal-overview tool", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    ({ client, transport } = await createMcpClient({
      SURETY_MCP_ENABLED: "true",
    }));
  });

  afterAll(async () => {
    await client.close();
    await transport.close();
  });

  test("should return renewal timeline", async () => {
    const result = await callTool(client, "renewal-overview");
    expect(result.isError).toBeFalsy();
    const data = parseToolJson(result.text) as Record<string, unknown>;
    expect(data).toHaveProperty("policies");
    expect(Array.isArray(data.policies)).toBe(true);
  });

  test("should accept optional months parameter", async () => {
    const result = await callTool(client, "renewal-overview", { months: 6 });
    expect(result.isError).toBeFalsy();
    const data = parseToolJson(result.text) as Record<string, unknown>;
    expect(data).toHaveProperty("policies");
  });
});

// ===========================================================================
// 8. Dashboard summary tool
// ===========================================================================

describe("dashboard-summary tool", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    ({ client, transport } = await createMcpClient({
      SURETY_MCP_ENABLED: "true",
    }));
  });

  afterAll(async () => {
    await client.close();
    await transport.close();
  });

  test("should return dashboard statistics", async () => {
    const result = await callTool(client, "dashboard-summary");
    expect(result.isError).toBeFalsy();
    const data = parseToolJson(result.text) as Record<string, unknown>;
    expect(data).toHaveProperty("memberCount");
    expect(data).toHaveProperty("policyCount");
    expect(data).toHaveProperty("totalPremium");
    expect(data).toHaveProperty("totalSumAssured");
    expect(data.memberCount).toBe(7);
    expect(data.policyCount).toBe(8);
  });

  test("should include category breakdown", async () => {
    const result = await callTool(client, "dashboard-summary");
    const data = parseToolJson(result.text) as {
      byCategory: Record<string, unknown>;
    };
    expect(data).toHaveProperty("byCategory");
    expect(typeof data.byCategory).toBe("object");
  });
});
