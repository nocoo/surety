import { describe, expect, test } from "bun:test";
import {
  deriveDisplayStatus,
  isEffectivelyActive,
  type PolicyDbStatus,
} from "@/db/types";

describe("deriveDisplayStatus", () => {
  const past = new Date("2026-01-01");

  test("returns Active when DB status is Active and no expiryDate", () => {
    expect(deriveDisplayStatus("Active", null, past)).toBe("Active");
  });

  test("returns Active when DB status is Active and expiryDate is in the future", () => {
    expect(deriveDisplayStatus("Active", "2026-06-15", past)).toBe("Active");
  });

  test("returns Expired when DB status is Active and expiryDate is in the past", () => {
    expect(deriveDisplayStatus("Active", "2025-06-28", past)).toBe("Expired");
  });

  test("returns Expired when expiryDate equals today's date (past midnight)", () => {
    // expiryDate "2026-01-01" parsed as midnight, now is also midnight = not expired
    const now = new Date("2026-01-01T00:00:00");
    expect(deriveDisplayStatus("Active", "2026-01-01", now)).toBe("Active");
  });

  test("returns Expired when expiryDate is before now within same day", () => {
    const now = new Date("2026-01-02T12:00:00");
    expect(deriveDisplayStatus("Active", "2026-01-01", now)).toBe("Expired");
  });

  test("preserves non-Active DB statuses regardless of expiryDate", () => {
    const statuses: PolicyDbStatus[] = ["Lapsed", "Surrendered", "Claimed"];
    for (const status of statuses) {
      expect(deriveDisplayStatus(status, "2020-01-01", past)).toBe(status);
      expect(deriveDisplayStatus(status, null, past)).toBe(status);
      expect(deriveDisplayStatus(status, "2030-01-01", past)).toBe(status);
    }
  });
});

describe("isEffectivelyActive", () => {
  const now = new Date("2026-02-10");

  test("returns true for Active with no expiry", () => {
    expect(isEffectivelyActive("Active", null, now)).toBe(true);
  });

  test("returns true for Active with future expiry", () => {
    expect(isEffectivelyActive("Active", "2027-01-01", now)).toBe(true);
  });

  test("returns false for Active with past expiry", () => {
    expect(isEffectivelyActive("Active", "2025-06-28", now)).toBe(false);
  });

  test("returns false for non-Active statuses", () => {
    expect(isEffectivelyActive("Lapsed", null, now)).toBe(false);
    expect(isEffectivelyActive("Surrendered", null, now)).toBe(false);
    expect(isEffectivelyActive("Claimed", null, now)).toBe(false);
  });
});
