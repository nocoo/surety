/**
 * MCP Tools: Payments
 *
 * Tools for managing policy payment records.
 * Payments are always scoped to a specific policy.
 * No FK restrict needed on delete — payments have no child references.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { paymentsRepo, policiesRepo } from "@/db/repositories";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";

/** Strip keys with undefined values (for exactOptionalPropertyTypes compat) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined(obj: Record<string, unknown>): any {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v;
  }
  return result;
}

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

      const policy = await policiesRepo.findById(policyId);
      if (!policy) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Policy with id ${policyId} not found`,
            },
          ],
        };
      }

      const items = await paymentsRepo.findByPolicyId(policyId);
      const result = items.map((p) => ({
        id: p.id,
        policyId: p.policyId,
        periodNumber: p.periodNumber,
        dueDate: p.dueDate,
        amount: p.amount,
        status: p.status,
        paidDate: p.paidDate,
        paidAmount: p.paidAmount,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // get-payment
  // -------------------------------------------------------------------------
  server.tool(
    "get-payment",
    "Get detailed information about a payment record",
    {
      paymentId: z.number().describe("The payment ID to look up"),
    },
    async ({ paymentId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const payment = await paymentsRepo.findById(paymentId);
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
    async (args) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      // Validate policy exists
      const policy = await policiesRepo.findById(args.policyId);
      if (!policy) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Policy with id ${args.policyId} not found`,
            },
          ],
        };
      }

      const payment = await paymentsRepo.create(stripUndefined(args));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(payment) }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // update-payment
  // -------------------------------------------------------------------------
  server.tool(
    "update-payment",
    "Update a payment record",
    {
      paymentId: z.number().describe("The payment ID to update"),
      periodNumber: z.number().optional().describe("Payment period number"),
      dueDate: z.string().optional().describe("Payment due date (YYYY-MM-DD)"),
      amount: z.number().optional().describe("Payment amount due"),
      status: z.enum(["Pending", "Paid", "Overdue"]).optional().describe("Payment status"),
      paidDate: z.string().optional().describe("Actual payment date (YYYY-MM-DD)"),
      paidAmount: z.number().optional().describe("Actual amount paid"),
    },
    async ({ paymentId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const updated = await paymentsRepo.update(paymentId, stripUndefined(data));
      if (!updated) {
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
        content: [{ type: "text" as const, text: JSON.stringify(updated) }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // delete-payment
  // -------------------------------------------------------------------------
  server.tool(
    "delete-payment",
    "Remove a payment record (no FK restrictions)",
    {
      paymentId: z.number().describe("The payment ID to delete"),
    },
    async ({ paymentId }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      const payment = await paymentsRepo.findById(paymentId);
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

      await paymentsRepo.delete(paymentId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ deleted: true, id: paymentId }),
          },
        ],
      };
    },
  );
}
