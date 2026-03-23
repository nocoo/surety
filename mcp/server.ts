/**
 * MCP Server Registration
 *
 * Registers all tools with the McpServer instance.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMemberTools } from "./tools/members";
import { registerPolicyTools } from "./tools/policies";
import { registerAssetTools } from "./tools/assets";
import { registerInsurerTools } from "./tools/insurers";
import { registerBeneficiaryTools } from "./tools/beneficiaries";
import { registerPaymentTools } from "./tools/payments";
import { registerCashValueTools } from "./tools/cash-values";
import { registerCoverageItemTools } from "./tools/coverage-items";
import { registerCoverageTools } from "./tools/coverage";

export function registerTools(server: McpServer): void {
  registerMemberTools(server);
  registerPolicyTools(server);
  registerAssetTools(server);
  registerInsurerTools(server);
  registerBeneficiaryTools(server);
  registerPaymentTools(server);
  registerCashValueTools(server);
  registerCoverageItemTools(server);
  registerCoverageTools(server);
}
