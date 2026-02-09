/**
 * MCP Security Guard
 *
 * Checks whether MCP access is enabled before executing any tool.
 * MCP is disabled by default. Users must explicitly enable it
 * in the Surety settings page.
 *
 * Two ways to enable:
 * 1. Database setting: settings.mcp.enabled = "true"
 * 2. Environment variable: SURETY_MCP_ENABLED = "true" (for testing)
 */

import { settingsRepo } from "@/db/repositories";

const DISABLED_MESSAGE = [
  "MCP access is disabled.",
  "To enable it, open the Surety settings page at http://localhost:7015/settings",
  "and turn on the MCP Access toggle.",
].join(" ");

/**
 * Check if MCP access is enabled.
 * Returns undefined if enabled, or an error message string if disabled.
 */
export function checkMcpEnabled(): string | undefined {
  // Environment override (for testing)
  if (process.env.SURETY_MCP_ENABLED === "true") {
    return undefined;
  }

  const enabled = settingsRepo.get("mcp.enabled");
  if (enabled === "true") {
    return undefined;
  }

  return DISABLED_MESSAGE;
}

/**
 * Create a tool error result for when MCP is disabled.
 */
export function mcpDisabledResult() {
  return {
    isError: true,
    content: [{ type: "text" as const, text: DISABLED_MESSAGE }],
  };
}
