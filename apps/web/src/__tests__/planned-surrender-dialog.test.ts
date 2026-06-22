/**
 * Unit tests for PlannedSurrenderDialog's pure helpers — the validator,
 * the payload builder, and the clear-payload builder (which the ghost
 * "清除拟退保标记" button submits).
 */
import { describe, expect, it } from "vitest";
import {
  buildClearPlannedSurrenderPayload,
  buildPlannedSurrenderPayload,
  isValidIsoDate,
  validatePlannedSurrenderForm,
} from "../components/policy-detail/planned-surrender-dialog";

const BASE = {
  plannedSurrenderAt: "2030-01-01",
  plannedSurrenderNote: "",
  effectiveDate: "2026-01-01",
};

describe("isValidIsoDate (planned-surrender)", () => {
  it("accepts a real ISO date", () => {
    expect(isValidIsoDate("2030-01-01")).toBe(true);
  });

  it("rejects round-trip overflow", () => {
    expect(isValidIsoDate("2030-13-32")).toBe(false);
  });
});

describe("validatePlannedSurrenderForm", () => {
  it("passes a valid future date", () => {
    expect(validatePlannedSurrenderForm(BASE)).toBeNull();
  });

  it("requires plannedSurrenderAt", () => {
    expect(
      validatePlannedSurrenderForm({ ...BASE, plannedSurrenderAt: "" }),
    ).toMatch(/请填写/);
  });

  it("rejects malformed date", () => {
    expect(
      validatePlannedSurrenderForm({
        ...BASE,
        plannedSurrenderAt: "2030/01/01",
      }),
    ).toMatch(/格式/);
  });

  it("rejects date earlier than effectiveDate", () => {
    expect(
      validatePlannedSurrenderForm({
        ...BASE,
        plannedSurrenderAt: "2025-12-31",
      }),
    ).toMatch(/生效日/);
  });

  it("accepts date equal to effectiveDate (boundary in)", () => {
    expect(
      validatePlannedSurrenderForm({
        ...BASE,
        plannedSurrenderAt: "2026-01-01",
      }),
    ).toBeNull();
  });

  it("rejects note longer than 500 chars", () => {
    expect(
      validatePlannedSurrenderForm({
        ...BASE,
        plannedSurrenderNote: "x".repeat(501),
      }),
    ).toMatch(/500/);
  });
});

describe("buildPlannedSurrenderPayload", () => {
  it("normalizes blank note to null", () => {
    expect(
      buildPlannedSurrenderPayload({
        plannedSurrenderAt: "2030-01-01",
        plannedSurrenderNote: "",
      }),
    ).toEqual({
      plannedSurrenderAt: "2030-01-01",
      plannedSurrenderNote: null,
    });
  });

  it("includes a non-empty note as-is", () => {
    expect(
      buildPlannedSurrenderPayload({
        plannedSurrenderAt: "2030-01-01",
        plannedSurrenderNote: "想退",
      }),
    ).toEqual({
      plannedSurrenderAt: "2030-01-01",
      plannedSurrenderNote: "想退",
    });
  });
});

describe("buildClearPlannedSurrenderPayload", () => {
  it("emits {plannedSurrenderAt: null, plannedSurrenderNote: null}", () => {
    expect(buildClearPlannedSurrenderPayload()).toEqual({
      plannedSurrenderAt: null,
      plannedSurrenderNote: null,
    });
  });
});
