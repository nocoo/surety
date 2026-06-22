/**
 * Unit tests for TerminationDialog's pure helpers — the validator and the
 * payload builder. The dialog UI itself is exercised in L3 (browser); these
 * pin the boundary checks that drive both inline error display and the
 * server-side rejection contract.
 */
import { describe, expect, it } from "vitest";
import {
  buildTerminationPayload,
  getInitialTerminationForm,
  isValidIsoDate,
  validateTerminationForm,
} from "../components/policy-detail/termination-dialog";

const BASE = {
  terminatedAt: "2026-06-15",
  terminationReason: "",
  effectiveDate: "2026-01-01",
  today: "2026-06-20",
};

describe("isValidIsoDate", () => {
  it("accepts a real ISO date", () => {
    expect(isValidIsoDate("2026-06-15")).toBe(true);
  });

  it("rejects wrong shape", () => {
    expect(isValidIsoDate("2026/06/15")).toBe(false);
    expect(isValidIsoDate("06-15")).toBe(false);
  });

  it("rejects round-trip overflow like 2026-99-99", () => {
    expect(isValidIsoDate("2026-99-99")).toBe(false);
  });
});

describe("validateTerminationForm", () => {
  it("passes a valid terminatedAt within range", () => {
    expect(validateTerminationForm(BASE)).toBeNull();
  });

  it("requires terminatedAt", () => {
    expect(
      validateTerminationForm({ ...BASE, terminatedAt: "" }),
    ).toMatch(/请填写/);
  });

  it("rejects malformed terminatedAt", () => {
    expect(
      validateTerminationForm({ ...BASE, terminatedAt: "not-a-date" }),
    ).toMatch(/格式/);
  });

  it("rejects terminatedAt earlier than effectiveDate", () => {
    expect(
      validateTerminationForm({ ...BASE, terminatedAt: "2025-12-31" }),
    ).toMatch(/生效日/);
  });

  it("rejects terminatedAt later than today", () => {
    expect(
      validateTerminationForm({ ...BASE, terminatedAt: "2026-07-01" }),
    ).toMatch(/今天/);
  });

  it("rejects reason longer than 500 chars", () => {
    expect(
      validateTerminationForm({
        ...BASE,
        terminationReason: "a".repeat(501),
      }),
    ).toMatch(/500/);
  });

  it("accepts terminatedAt equal to effectiveDate (boundary in)", () => {
    expect(
      validateTerminationForm({ ...BASE, terminatedAt: "2026-01-01" }),
    ).toBeNull();
  });

  it("accepts terminatedAt equal to today (boundary in)", () => {
    expect(
      validateTerminationForm({ ...BASE, terminatedAt: "2026-06-20" }),
    ).toBeNull();
  });
});

describe("buildTerminationPayload", () => {
  it("omits terminationReason when blank", () => {
    const payload = buildTerminationPayload({
      targetStatus: "Surrendered",
      terminatedAt: "2026-06-15",
      terminationReason: "",
    });
    expect(payload).toEqual({
      status: "Surrendered",
      terminatedAt: "2026-06-15",
    });
    expect("terminationReason" in payload).toBe(false);
  });

  it("includes terminationReason when provided", () => {
    expect(
      buildTerminationPayload({
        targetStatus: "Lapsed",
        terminatedAt: "2026-06-15",
        terminationReason: "客户解约",
      }),
    ).toEqual({
      status: "Lapsed",
      terminatedAt: "2026-06-15",
      terminationReason: "客户解约",
    });
  });
});

describe("getInitialTerminationForm", () => {
  it("reuses existing terminatedAt + terminationReason on a terminal row (edit path)", () => {
    expect(
      getInitialTerminationForm(
        {
          status: "Surrendered",
          terminatedAt: "2026-04-01",
          terminationReason: "原因",
        },
        "2026-06-01",
      ),
    ).toEqual({ terminatedAt: "2026-04-01", terminationReason: "原因" });
  });

  it("legacy terminal row (null terminatedAt) leaves date blank — does NOT auto-fill today", () => {
    expect(
      getInitialTerminationForm(
        {
          status: "Surrendered",
          terminatedAt: null,
          terminationReason: null,
        },
        "2026-06-01",
      ),
    ).toEqual({ terminatedAt: "", terminationReason: "" });
  });

  it("fresh termination from Active defaults date to today", () => {
    expect(
      getInitialTerminationForm(
        {
          status: "Active",
          terminatedAt: null,
          terminationReason: null,
        },
        "2026-06-01",
      ),
    ).toEqual({ terminatedAt: "2026-06-01", terminationReason: "" });
  });

  it("fresh termination from Expired (display) also defaults to today", () => {
    expect(
      getInitialTerminationForm(
        {
          status: "Expired",
          terminatedAt: null,
          terminationReason: null,
        },
        "2026-06-01",
      ),
    ).toEqual({ terminatedAt: "2026-06-01", terminationReason: "" });
  });

  it("blank reason is empty string even when terminatedAt is present", () => {
    expect(
      getInitialTerminationForm(
        {
          status: "Surrendered",
          terminatedAt: "2026-04-01",
          terminationReason: null,
        },
        "2026-06-01",
      ),
    ).toEqual({ terminatedAt: "2026-04-01", terminationReason: "" });
  });
});
