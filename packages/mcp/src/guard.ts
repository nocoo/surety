import { apiGet } from "./api-client";

const DISABLED_MESSAGE = [
  "MCP access is disabled.",
  "To enable it, open the Surety settings page at /settings",
  "and turn on the MCP Access toggle.",
].join(" ");

export async function checkMcpEnabled(): Promise<string | undefined> {
  if (process.env.SURETY_MCP_ENABLED === "true") {
    return undefined;
  }

  try {
    const result = await apiGet<{ key: string; value: string | null }>("/api/settings/mcp.enabled");
    if (result.value === "true") return undefined;
  } catch {
    // If we can't reach the API, consider MCP disabled
  }

  return DISABLED_MESSAGE;
}

export function mcpDisabledResult() {
  return {
    isError: true,
    content: [{ type: "text" as const, text: DISABLED_MESSAGE }],
  };
}
