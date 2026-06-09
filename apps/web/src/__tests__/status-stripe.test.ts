import { describe, it, expect } from "vitest";
import { statusStripeClass, statusConfig } from "@/lib/constants/policy";
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
