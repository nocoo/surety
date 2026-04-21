/**
 * MCP Tools: Payments
 *
 * Tools for managing policy payment records.
 * Payments are always scoped to a specific policy.
 * No FK restrict needed on delete — payments have no child references.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { paymentsRepo, policiesRepo } from "@surety/db/repositories";
import { checkMcpEnabled, mcpDisabledResult } from "../guard";
import { stripUndefined } from "./shared";

export function registerPaymentTools(server: McpServer): void {
  /**
   * Validate payment status consistency.
   * - status=Paid requires paidDate and paidAmount
   * - status=Pending/Overdue must not have paidDate/paidAmount
   * Returns error message string if invalid, undefined if ok.
   */
  function validatePaymentStatus(
    status: string | undefined,
    paidDate: string | null | undefined,
    paidAmount: number | null | undefined,
  ): string | undefined {
    const effectiveStatus = status ?? "Pending";
    if (effectiveStatus === "Paid") {
      if (!paidDate || paidAmount == null) {
        return "status 'Paid' requires both paidDate and paidAmount";
      }
    } else {
      // Pending or Overdue
      if (paidDate || paidAmount != null) {
        return `status '${effectiveStatus}' must not have paidDate or paidAmount`;
      }
    }
    return undefined;
  }
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

      // Validate payment status consistency
      const statusError = validatePaymentStatus(args.status, args.paidDate, args.paidAmount);
      if (statusError) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: statusError }],
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
    "Update a payment record. To revert a paid record, set status and pass paidDate: null, paidAmount: null.",
    {
      paymentId: z.number().describe("The payment ID to update"),
      periodNumber: z.number().optional().describe("Payment period number"),
      dueDate: z.string().optional().describe("Payment due date (YYYY-MM-DD)"),
      amount: z.number().optional().describe("Payment amount due"),
      status: z.enum(["Pending", "Paid", "Overdue"]).optional().describe("Payment status"),
      paidDate: z.string().nullable().optional().describe("Actual payment date (null to clear)"),
      paidAmount: z.number().nullable().optional().describe("Actual amount paid (null to clear)"),
    },
    async ({ paymentId, ...data }) => {
      const error = await checkMcpEnabled();
      if (error) return mcpDisabledResult();

      // Fetch existing to compute effective state for validation
      const existing = await paymentsRepo.findById(paymentId);
      if (!existing) {
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

      // Compute effective state after update
      const effectiveStatus = data.status ?? existing.status;
      const effectivePaidDate = data.paidDate !== undefined ? data.paidDate : existing.paidDate;
      const effectivePaidAmount = data.paidAmount !== undefined ? data.paidAmount : existing.paidAmount;

      const statusError = validatePaymentStatus(effectiveStatus, effectivePaidDate, effectivePaidAmount);
      if (statusError) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: statusError }],
        };
      }

      const updated = await paymentsRepo.update(paymentId, stripUndefined(data));

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
