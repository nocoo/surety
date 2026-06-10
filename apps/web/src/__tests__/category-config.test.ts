import { describe, it, expect } from "vitest";
import { categoryLabels } from "@/lib/constants/policy";
import { getCategoryConfig } from "@surety/api/lib/category-config";

describe("category label invariant", () => {
  // Every category enum key listed in apps/web's local categoryLabels
  // must resolve to the same Chinese label as packages/api's
  // getCategoryConfig — otherwise display surfaces and the form's
  // option list disagree about how to spell e.g. "重疾险".
  it("every web-side label matches getCategoryConfig().label", () => {
    for (const [key, webLabel] of Object.entries(categoryLabels)) {
      const apiLabel = getCategoryConfig(key).label;
      expect(apiLabel, `mismatch for ${key}`).toBe(webLabel);
    }
  });

  it("getCategoryConfig returns a typed Badge variant for every category", () => {
    const allowedVariants = new Set([
      "default",
      "secondary",
      "success",
      "warning",
      "info",
      "purple",
      "teal",
      "indigo",
      "destructive",
    ]);
    for (const key of Object.keys(categoryLabels)) {
      const variant = getCategoryConfig(key).variant;
      expect(allowedVariants.has(variant), `unknown variant for ${key}: ${variant}`).toBe(true);
    }
  });

  it("unknown category falls back to a stable default config", () => {
    const fallback = getCategoryConfig("UnknownCategory");
    // The shape must still be a valid Badge variant and the label
    // round-trips the input string for diagnostics.
    expect(fallback.variant).toBe("secondary");
    expect(fallback.label).toBe("UnknownCategory");
  });
});
