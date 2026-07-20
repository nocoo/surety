import { describe, expect, it } from "vitest";
import { readCoverageDeepLink, selectorKindForDeepLink } from "@/app/coverage-lookup/deep-link";

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

	it("treats a value-less ?asset as 'asset tab, no id selected'", () => {
		// Regression: previously fell back to member tab because the read
		// checked truthy `params.get("asset")`. After clicking the asset
		// tab without picking an asset, the URL is `?asset=` and the page
		// must keep the asset selector visible.
		expect(readCoverageDeepLink(p("asset"))).toEqual({ type: "asset", id: null });
		expect(readCoverageDeepLink(p("asset="))).toEqual({ type: "asset", id: null });
	});

	it("treats a value-less ?member as 'member tab, no id selected'", () => {
		expect(readCoverageDeepLink(p("member"))).toEqual({ type: "member", id: null });
		expect(readCoverageDeepLink(p("member="))).toEqual({ type: "member", id: null });
	});

	it("falls back to id=null when value is non-numeric", () => {
		expect(readCoverageDeepLink(p("member=abc"))).toEqual({ type: "member", id: null });
		expect(readCoverageDeepLink(p("asset=junk"))).toEqual({ type: "asset", id: null });
	});

	it("rejects zero or negative ids", () => {
		expect(readCoverageDeepLink(p("member=0"))).toEqual({ type: "member", id: null });
		expect(readCoverageDeepLink(p("asset=-3"))).toEqual({ type: "asset", id: null });
	});

	it("prefers asset when both keys appear", () => {
		// Defensive — the palette only ever sets one, but if a future
		// deep link malforms with both we should not silently merge.
		expect(readCoverageDeepLink(p("member=1&asset=2"))).toEqual({ type: "asset", id: 2 });
		// Same defense when asset has no value.
		expect(readCoverageDeepLink(p("member=1&asset"))).toEqual({ type: "asset", id: null });
	});
});

describe("selectorKindForDeepLink", () => {
	// The page renders <MemberSelector/> vs <AssetSelector/> based purely
	// on this mapping. Pinning it down here so future refactors of the
	// selector switch can't silently send users to the wrong panel.
	it("URL with no params → member selector (default landing)", () => {
		expect(selectorKindForDeepLink(readCoverageDeepLink(p("")))).toBe("member-selector");
	});

	it("clicking the asset tab without picking → asset selector visible", () => {
		// Regression: previously fell back to member-selector.
		expect(selectorKindForDeepLink(readCoverageDeepLink(p("asset")))).toBe("asset-selector");
		expect(selectorKindForDeepLink(readCoverageDeepLink(p("asset=")))).toBe("asset-selector");
	});

	it("?asset=N keeps the asset selector visible", () => {
		expect(selectorKindForDeepLink(readCoverageDeepLink(p("asset=42")))).toBe("asset-selector");
	});

	it("?member / ?member=N → member selector", () => {
		expect(selectorKindForDeepLink(readCoverageDeepLink(p("member")))).toBe("member-selector");
		expect(selectorKindForDeepLink(readCoverageDeepLink(p("member=42")))).toBe("member-selector");
	});
});
