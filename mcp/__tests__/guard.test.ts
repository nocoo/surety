/**
 * Unit Tests: MCP Guard
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createTestDb, resetTestDb } from "@/db";
import { settingsRepo } from "@/db/repositories";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";

// Initialize in-memory test database
createTestDb();

describe("checkMcpEnabled", () => {
  beforeEach(() => {
    resetTestDb();
    delete process.env.SURETY_MCP_ENABLED;
  });

  afterEach(() => {
    delete process.env.SURETY_MCP_ENABLED;
  });

  test("should return error message when mcp.enabled is not set", () => {
    const result = checkMcpEnabled();
    expect(result).toBeDefined();
    expect(result).toContain("MCP access is disabled");
    expect(result).toContain("http://localhost:7015/settings");
  });

  test("should return error message when mcp.enabled is false", () => {
    settingsRepo.set("mcp.enabled", "false");
    const result = checkMcpEnabled();
    expect(result).toBeDefined();
    expect(result).toContain("MCP access is disabled");
  });

  test("should return undefined when mcp.enabled is true", () => {
    settingsRepo.set("mcp.enabled", "true");
    const result = checkMcpEnabled();
    expect(result).toBeUndefined();
  });

  test("should return undefined when SURETY_MCP_ENABLED env is true", () => {
    process.env.SURETY_MCP_ENABLED = "true";
    const result = checkMcpEnabled();
    expect(result).toBeUndefined();
  });

  test("env override should take precedence over db setting", () => {
    settingsRepo.set("mcp.enabled", "false");
    process.env.SURETY_MCP_ENABLED = "true";
    const result = checkMcpEnabled();
    expect(result).toBeUndefined();
  });
});

describe("mcpDisabledResult", () => {
  test("should return error result with guidance message", () => {
    const result = mcpDisabledResult();
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    const first = result.content[0]!;
    expect(first.type).toBe("text");
    expect(first.text).toContain("MCP access is disabled");
    expect(first.text).toContain("http://localhost:7015/settings");
  });
});
