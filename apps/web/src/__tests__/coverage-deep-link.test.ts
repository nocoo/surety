import { describe, it, expect } from "vitest";
import { readCoverageDeepLink } from "@/app/coverage-lookup/deep-link";

function p(qs: string): URLSearchParams {
  return new URLSearchParams(qs);
}

describe("readCoverageDeepLink", () => {
  it("returns the default member type with no id when no params", () => {
    expect(readCoverageDeepLink(p(""))).toEqual({ type: "member", id: null });
  });

  it("parses ?member=N as member + numeric id", () => {
    expect(readCoverageDeepLink(p("member=42"))).toEqual({ type: "member", id: 42 });
  });

  it("parses ?asset=N as asset + numeric id", () => {
    expect(readCoverageDeepLink(p("asset=7"))).toEqual({ type: "asset", id: 7 });
  });

  it("falls back to id=null when value is non-numeric", () => {
    expect(readCoverageDeepLink(p("member=abc"))).toEqual({ type: "member", id: null });
    expect(readCoverageDeepLink(p("asset="))).toEqual({ type: "member", id: null });
  });

  it("rejects zero or negative ids", () => {
    expect(readCoverageDeepLink(p("member=0"))).toEqual({ type: "member", id: null });
    expect(readCoverageDeepLink(p("asset=-3"))).toEqual({ type: "asset", id: null });
  });

  it("prefers asset when both keys appear", () => {
    // Defensive — the palette only ever sets one, but if a future
    // deep link malforms with both we should not silently merge.
    expect(readCoverageDeepLink(p("member=1&asset=2"))).toEqual({ type: "asset", id: 2 });
  });
});
