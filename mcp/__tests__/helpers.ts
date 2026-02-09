/**
 * MCP Test Helpers
 *
 * Captures tool handlers from register functions for direct unit testing,
 * avoiding the need to wire up full MCP Client/Server transports.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ToolHandler = (args: any) => Promise<any>;

export interface CapturedTool {
  name: string;
  description: string;
  schema: any;
  handler: ToolHandler;
}

/**
 * Create a fake McpServer that captures tool registrations.
 * Returns a map of tool name -> handler for direct invocation in tests.
 */
export function createMockServer() {
  const tools = new Map<string, CapturedTool>();

  const server = {
    tool(
      name: string,
      description: string,
      schema: any,
      handler: ToolHandler,
    ) {
      tools.set(name, { name, description, schema, handler });
    },
  };

  return { server: server as any, tools };
}

/** Parse the JSON text from a standard MCP tool result */
export function parseResult(result: any): any {
  return JSON.parse(result.content[0].text);
}
