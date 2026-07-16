import { defineCommand } from "@nocoo/base-cli";
import type { ApiClient } from "../api.js";
import { emit } from "../output.js";
import { buildClient } from "../lib/client.js";

export function defineReadonlyCommands(factory: () => ApiClient = buildClient) {
  const client = factory;

  const coverage = defineCommand({
    meta: {
      name: "coverage",
      description:
        "Look up coverage for a member or asset (use --type=member|asset, --id=<n>)",
    },
    args: {
      type: {
        type: "string" as const,
        description: "Selection type: member or asset",
        default: "member",
      },
      id: {
        type: "string" as const,
        description: "Member or asset id (optional; omit for overview)",
      },
    },
    async run({ args }) {
      const params = new URLSearchParams();
      if (args.type) params.set("type", String(args.type));
      if (args.id) params.set("id", String(args.id));
      const qs = params.toString();
      const path = `/api/coverage-lookup${qs ? `?${qs}` : ""}`;
      emit(await client().get(path));
    },
  });

  const renewals = defineCommand({
    meta: {
      name: "renewals",
      description: "Renewal calendar for the next 12 months",
    },
    async run() {
      emit(await client().get("/api/renewal-calendar"));
    },
  });

  const dashboard = defineCommand({
    meta: {
      name: "dashboard",
      description: "Dashboard snapshot (counts, totals, upcoming)",
    },
    async run() {
      emit(await client().get("/api/dashboard"));
    },
  });

  return { coverage, renewals, dashboard };
}

const defaults = defineReadonlyCommands();
export const coverageCommand = defaults.coverage;
export const renewalsCommand = defaults.renewals;
export const dashboardCommand = defaults.dashboard;
