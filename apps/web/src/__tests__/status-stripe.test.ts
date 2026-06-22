import { describe, it, expect } from "vitest";
import {
  renderPolicyStatusBadges,
  statusConfig,
  statusStripeClass,
} from "@/lib/constants/policy";
import type { PolicyStatus } from "@surety/db/types";

describe("statusStripeClass", () => {
  it("emits a 2px left border for every defined status", () => {
    for (const status of Object.keys(statusConfig) as PolicyStatus[]) {
      const cls = statusStripeClass(status);
      expect(cls).toContain("border-l-2");
      expect(cls).toContain("border-l-");
    }
  });

  it("maps semantic variants to the matching border color", () => {
    expect(statusStripeClass("Active")).toBe("border-l-2 border-l-success");
    expect(statusStripeClass("Expired")).toBe("border-l-2 border-l-destructive");
    expect(statusStripeClass("Surrendered")).toBe("border-l-2 border-l-warning");
    expect(statusStripeClass("Claimed")).toBe("border-l-2 border-l-purple");
  });

  it("falls back to muted border for outline (default) variant", () => {
    expect(statusStripeClass("Lapsed")).toBe("border-l-2 border-l-muted-foreground/30");
  });
});

describe("renderPolicyStatusBadges", () => {
  it("returns only the primary badge when plannedSurrenderAt is missing (list-view shape)", () => {
    expect(renderPolicyStatusBadges({ status: "Active" })).toEqual([
      { label: "生效中", variant: "success" },
    ]);
  });

  it("returns only the primary badge when plannedSurrenderAt is null", () => {
    expect(
      renderPolicyStatusBadges({ status: "Active", plannedSurrenderAt: null }),
    ).toEqual([{ label: "生效中", variant: "success" }]);
  });

  it("appends a rose secondary badge when Active and plannedSurrenderAt set", () => {
    expect(
      renderPolicyStatusBadges({
        status: "Active",
        plannedSurrenderAt: "2030-01-01",
      }),
    ).toEqual([
      { label: "生效中", variant: "success" },
      { label: "拟退保 2030-01-01", variant: "rose" },
    ]);
  });

  it("appends a rose secondary badge when Expired and plannedSurrenderAt set", () => {
    expect(
      renderPolicyStatusBadges({
        status: "Expired",
        plannedSurrenderAt: "2030-01-01",
      }),
    ).toEqual([
      { label: "已过期", variant: "destructive" },
      { label: "拟退保 2030-01-01", variant: "rose" },
    ]);
  });

  it.each(["Surrendered", "Claimed", "Lapsed"] as const)(
    "does NOT append rose badge for terminal status %s even when plannedSurrenderAt is set",
    (status) => {
      const badges = renderPolicyStatusBadges({
        status,
        plannedSurrenderAt: "2030-01-01",
      });
      expect(badges.length).toBe(1);
      expect(badges[0]?.variant).not.toBe("rose");
    },
  );

  it("primary badge label and variant come from statusConfig for every PolicyStatus", () => {
    for (const status of Object.keys(statusConfig) as PolicyStatus[]) {
      const badges = renderPolicyStatusBadges({ status });
      expect(badges[0]).toEqual({
        label: statusConfig[status].label,
        variant: statusConfig[status].variant,
      });
    }
  });
});
