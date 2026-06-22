import { describe, expect, it } from "vitest";
import { isObsoletedByTermination } from "../types";

describe("isObsoletedByTermination", () => {
  it("returns false when policy has no terminatedAt", () => {
    expect(
      isObsoletedByTermination(
        { dueDate: "2026-12-01", status: "Pending" },
        null,
      ),
    ).toBe(false);
  });

  it("returns false for Paid rows even if dueDate is after terminatedAt", () => {
    expect(
      isObsoletedByTermination(
        { dueDate: "2026-12-01", status: "Paid" },
        "2026-06-15",
      ),
    ).toBe(false);
  });

  it("returns false when dueDate equals terminatedAt", () => {
    expect(
      isObsoletedByTermination(
        { dueDate: "2026-06-15", status: "Pending" },
        "2026-06-15",
      ),
    ).toBe(false);
  });

  it("returns false when dueDate is before terminatedAt", () => {
    expect(
      isObsoletedByTermination(
        { dueDate: "2026-05-01", status: "Pending" },
        "2026-06-15",
      ),
    ).toBe(false);
  });

  it("returns true when dueDate is strictly after terminatedAt and status is Pending", () => {
    expect(
      isObsoletedByTermination(
        { dueDate: "2026-12-01", status: "Pending" },
        "2026-06-15",
      ),
    ).toBe(true);
  });

  it("returns true when dueDate is strictly after terminatedAt and status is Overdue", () => {
    expect(
      isObsoletedByTermination(
        { dueDate: "2026-12-01", status: "Overdue" },
        "2026-06-15",
      ),
    ).toBe(true);
  });
});
