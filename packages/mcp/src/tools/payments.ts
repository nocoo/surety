/**
 * MCP Tools: Payments
 *
 * Tools for managing policy payment records.
 * Payments are always scoped to a specific policy.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, apiDelete } from "../api-client";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";
import { stripUndefined } from "./shared";

export function registerPaymentTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // list-payments
  // -------------------------------------------------------------------------
  server.tool(
    "list-payments",
    "List payment records for a specific policy",
    {
      policyId: z.number().describe("The policy ID to list payments for"),
    },
    async ({ policyId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const items = await apiGet(`/api/policies/${policyId}/payments`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(items) }],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: String(e) }],
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // get-payment
  // -------------------------------------------------------------------------
  server.tool(
    "get-payment",
    "Get detailed information about a payment record",
    {
      policyId: z.number().describe("The policy ID the payment belongs to"),
      paymentId: z.number().describe("The payment ID to look up"),
    },
    async ({ policyId, paymentId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const items = await apiGet<Array<{ id: number }>>(`/api/policies/${policyId}/payments`);
        const payment = items.find((p) => p.id === paymentId);
        if (!payment) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Payment with id ${paymentId} not found`,
              },
            ],
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(payment) }],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: String(e) }],
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // create-payment
  // -------------------------------------------------------------------------
  server.tool(
    "create-payment",
    "Add a payment record to a policy",
    {
      policyId: z.number().describe("The policy ID to add a payment to"),
      periodNumber: z.number().describe("Payment period number (e.g. 1 for first year)"),
      dueDate: z.string().describe("Payment due date (YYYY-MM-DD)"),
      amount: z.number().describe("Payment amount due"),
      status: z
        .enum(["Pending", "Paid", "Overdue"])
        .optional()
        .describe("Payment status (default: Pending)"),
      paidDate: z.string().optional().describe("Actual payment date (YYYY-MM-DD)"),
      paidAmount: z.number().optional().describe("Actual amount paid"),
    },
    async ({ policyId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const payment = await apiPost(`/api/policies/${policyId}/payments`, stripUndefined(data));
        return {
          content: [{ type: "text" as const, text: JSON.stringify(payment) }],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: String(e) }],
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // update-payment
  // -------------------------------------------------------------------------
  server.tool(
    "update-payment",
    "Update a payment record. To revert a paid record, set status and pass paidDate: null, paidAmount: null.",
    {
      policyId: z.number().describe("The policy ID the payment belongs to"),
      paymentId: z.number().describe("The payment ID to update"),
      periodNumber: z.number().optional().describe("Payment period number"),
      dueDate: z.string().optional().describe("Payment due date (YYYY-MM-DD)"),
      amount: z.number().optional().describe("Payment amount due"),
      status: z.enum(["Pending", "Paid", "Overdue"]).optional().describe("Payment status"),
      paidDate: z.string().nullable().optional().describe("Actual payment date (null to clear)"),
      paidAmount: z.number().nullable().optional().describe("Actual amount paid (null to clear)"),
    },
    async ({ policyId, paymentId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        const updated = await apiPut(
          `/api/policies/${policyId}/payments/${paymentId}`,
          stripUndefined(data),
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(updated) }],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: String(e) }],
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // delete-payment
  // -------------------------------------------------------------------------
  server.tool(
    "delete-payment",
    "Remove a payment record (no FK restrictions)",
    {
      policyId: z.number().describe("The policy ID the payment belongs to"),
      paymentId: z.number().describe("The payment ID to delete"),
    },
    async ({ policyId, paymentId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      try {
        await apiDelete(`/api/policies/${policyId}/payments/${paymentId}`);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ deleted: true, id: paymentId }),
            },
          ],
        };
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: String(e) }],
        };
      }
    },
  );
}
