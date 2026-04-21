import { describe, expect, test } from "bun:test";
import {
  deriveDisplayStatus,
  isEffectivelyActive,
  type PolicyDbStatus,
} from "@surety/db/types";

describe("deriveDisplayStatus", () => {
  // Use explicit local-timezone Date construction for deterministic tests
  const past = new Date(2026, 0, 1); // Jan 1, 2026 local midnight

  test("returns Active when DB status is Active and no expiryDate", () => {
    expect(deriveDisplayStatus("Active", null, past)).toBe("Active");
  });

  test("returns Active when DB status is Active and expiryDate is in the future", () => {
    expect(deriveDisplayStatus("Active", "2026-06-15", past)).toBe("Active");
  });

  test("returns Expired when DB status is Active and expiryDate is in the past", () => {
    expect(deriveDisplayStatus("Active", "2025-06-28", past)).toBe("Expired");
  });

  test("returns Active when expiryDate equals now's date at midnight", () => {
    // expiryDate "2026-01-01" → local midnight; now is also local midnight = not expired
    const now = new Date(2026, 0, 1, 0, 0, 0);
    expect(deriveDisplayStatus("Active", "2026-01-01", now)).toBe("Active");
  });

  test("returns Expired when expiryDate is before now within same day", () => {
    const now = new Date(2026, 0, 2, 12, 0, 0); // Jan 2 noon
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
  const now = new Date(2026, 1, 10); // Feb 10, 2026

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
