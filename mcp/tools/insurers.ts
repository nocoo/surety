/**
 * MCP Tools: Insurers
 *
 * Tools for managing insurance companies.
 * update-insurer syncs insurerName to related policies when name changes.
 * delete-insurer restricts if referenced by policies.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { insurersRepo, policiesRepo } from "@/db/repositories";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";
import { stripUndefined } from "./shared";

export function registerInsurerTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // list-insurers
  // -------------------------------------------------------------------------
  server.tool(
    "list-insurers",
    "List all insurance companies",
    {},
    async () => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const insurers = await insurersRepo.findAll();
      const result = insurers.map((i) => ({
        id: i.id,
        name: i.name,
        phone: i.phone,
        website: i.website,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // get-insurer
  // -------------------------------------------------------------------------
  server.tool(
    "get-insurer",
    "Get detailed information about an insurance company",
    { insurerId: z.number().describe("The insurer ID to look up") },
    async ({ insurerId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const insurer = await insurersRepo.findById(insurerId);
      if (!insurer) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Insurer with id ${insurerId} not found`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(insurer) }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // create-insurer
  // -------------------------------------------------------------------------
  server.tool(
    "create-insurer",
    "Create a new insurance company",
    {
      name: z.string().describe("Company name (must be unique)"),
      phone: z.string().optional().describe("Contact phone"),
      website: z.string().optional().describe("Company website URL"),
    },
    async (args) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const insurer = await insurersRepo.create(stripUndefined(args));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(insurer) }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // update-insurer
  // -------------------------------------------------------------------------
  server.tool(
    "update-insurer",
    "Update an insurance company. If name changes, syncs insurerName to all related policies.",
    {
      insurerId: z.number().describe("The insurer ID to update"),
      name: z.string().optional().describe("Company name"),
      phone: z.string().optional().describe("Contact phone"),
      website: z.string().optional().describe("Company website URL"),
    },
    async ({ insurerId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const updated = await insurersRepo.update(insurerId, stripUndefined(data));
      if (!updated) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Insurer with id ${insurerId} not found`,
            },
          ],
        };
      }

      // Sync insurerName to related policies when name changes
      if (data.name) {
        const allPolicies = await policiesRepo.findAll();
        const affectedPolicies = allPolicies.filter(
          (p) => p.insurerId === insurerId,
        );
        for (const p of affectedPolicies) {
          await policiesRepo.update(p.id, { insurerName: data.name });
        }
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(updated) }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // delete-insurer
  // -------------------------------------------------------------------------
  server.tool(
    "delete-insurer",
    "Delete an insurance company (fails if referenced by policies)",
    {
      insurerId: z.number().describe("The insurer ID to delete"),
    },
    async ({ insurerId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const insurer = await insurersRepo.findById(insurerId);
      if (!insurer) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Insurer with id ${insurerId} not found`,
            },
          ],
        };
      }

      // Check referencing policies (policies.insurerId → insurers.id)
      const allPolicies = await policiesRepo.findAll();
      const referencingPolicies = allPolicies.filter(
        (p) => p.insurerId === insurerId,
      );

      if (referencingPolicies.length) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Cannot delete insurer: still referenced by policies",
                policies: referencingPolicies.map((p) => ({
                  id: p.id,
                  policyNumber: p.policyNumber,
                })),
              }),
            },
          ],
        };
      }

      await insurersRepo.delete(insurerId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ deleted: true, id: insurerId }),
          },
        ],
      };
    },
  );
}
