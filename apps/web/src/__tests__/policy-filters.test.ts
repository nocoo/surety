import { describe, it, expect } from "vitest";
import {
  countActiveFilters,
  buildChips,
  EMPTY_FILTERS,
  type PolicyFilterOptions,
  type PolicyFilterState,
} from "@/app/policies/policy-filters";

const opts: PolicyFilterOptions = {
  applicantNames: ["张伟", "李雷"],
  insuredNames: ["张伟"],
  categories: ["Life", "Medical"],
  assetNames: [],
  statuses: ["Active"],
};

describe("countActiveFilters", () => {
  it("returns 0 when all values are 'all'", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it("counts each non-'all' dimension once", () => {
    const f: PolicyFilterState = {
      ...EMPTY_FILTERS,
      applicant: "张伟",
      category: "Life",
    };
    expect(countActiveFilters(f)).toBe(2);
  });

  it("counts all five dimensions", () => {
    const f: PolicyFilterState = {
      applicant: "张伟",
      insured: "张伟",
      category: "Life",
      asset: "Property",
      status: "Active",
    };
    expect(countActiveFilters(f)).toBe(5);
  });
});

describe("buildChips", () => {
  it("returns an empty list for empty filters", () => {
    expect(buildChips(EMPTY_FILTERS, opts)).toEqual([]);
  });

  it("resolves category to its human label", () => {
    const chips = buildChips(
      { ...EMPTY_FILTERS, category: "Life" },
      opts,
    );
    expect(chips).toHaveLength(1);
    expect(chips[0]?.key).toBe("category");
    expect(chips[0]?.display("Life")).toBe("定期寿");
  });

  it("resolves status to its human label", () => {
    const chips = buildChips({ ...EMPTY_FILTERS, status: "Active" }, opts);
    expect(chips).toHaveLength(1);
    expect(chips[0]?.display("Active")).toBe("生效中");
  });

  it("falls back to the raw value when category label is unknown", () => {
    const chips = buildChips(
      { ...EMPTY_FILTERS, category: "MysteryCategory" },
      opts,
    );
    expect(chips[0]?.display("MysteryCategory")).toBe("MysteryCategory");
  });

  it("preserves the order: applicant, insured, category, asset, status", () => {
    const f: PolicyFilterState = {
      applicant: "张伟",
      insured: "李雷",
      category: "Life",
      asset: "house",
      status: "Active",
    };
    const chips = buildChips(f, opts);
    expect(chips.map((c) => c.key)).toEqual([
      "applicant",
      "insured",
      "category",
      "asset",
      "status",
    ]);
  });
});
