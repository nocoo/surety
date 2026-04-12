/**
 * MCP Test Helpers
 *
 * Captures tool handlers from register functions for direct unit testing,
 * avoiding the need to wire up full MCP Client/Server transports.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from "zod";

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

/**
 * Safely retrieve a tool handler from the captured tools map.
 * Throws a clear error if the tool was not registered.
 * The returned handler validates args against the tool's Zod schema
 * before invoking the actual handler (mimicking MCP SDK behavior).
 */
export function getHandler(
  tools: Map<string, CapturedTool>,
  name: string,
): ToolHandler {
  const tool = tools.get(name);
  if (!tool) {
    throw new Error(`Tool "${name}" not registered`);
  }
  // Wrap handler to validate args against schema first
  return async (args: any) => {
    const zodSchema = z.object(tool.schema);
    const parsed = zodSchema.safeParse(args);
    if (!parsed.success) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `Validation error: ${parsed.error.message}`,
          },
        ],
      };
    }
    return tool.handler(parsed.data);
  };
}

/** Parse the JSON text from a standard MCP tool result */
export function parseResult(result: any): any {
  return JSON.parse(result.content[0].text);
}
