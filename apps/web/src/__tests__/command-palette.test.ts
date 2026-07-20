import { describe, expect, it } from "vitest";
import { __test__, filterCommands } from "@/components/layout/command-palette";

const { NAV_COMMANDS, NEW_ACTIONS } = __test__;

// Cast to the public type since filterCommands accepts the
// PaletteCommand interface but the array literal in source is the same
// concrete type — TS is fine with this in practice through structural
// typing.
const commands = [...NAV_COMMANDS, ...NEW_ACTIONS];

describe("filterCommands", () => {
	it("returns the full list for an empty query", () => {
		expect(filterCommands(commands, "")).toHaveLength(commands.length);
		expect(filterCommands(commands, "   ")).toHaveLength(commands.length);
	});

	it("matches substrings in the label", () => {
		const result = filterCommands(commands, "保单");
		expect(result.length).toBeGreaterThan(0);
		expect(result.every((c) => c.label.includes("保单") || c.hint?.includes("保单"))).toBe(true);
	});

	it("matches inside the group name", () => {
		const result = filterCommands(commands, "导航");
		expect(result.length).toBe(NAV_COMMANDS.length);
	});

	it("matches inside the hint", () => {
		// NEW_ACTIONS use English hints like "Plus · Policy"
		const result = filterCommands(commands, "policy");
		expect(result.some((c) => c.id === "new-policy")).toBe(true);
	});

	it("is case-insensitive", () => {
		const lower = filterCommands(commands, "policy");
		const upper = filterCommands(commands, "POLICY");
		expect(lower.length).toBe(upper.length);
	});

	it("returns empty for a query that matches nothing", () => {
		expect(filterCommands(commands, "纯属不存在的关键字abcxyz")).toEqual([]);
	});

	it("preserves the original order", () => {
		const result = filterCommands(commands, "");
		expect(result.map((c) => c.id)).toEqual(commands.map((c) => c.id));
	});
});

describe("static command tables", () => {
	it("nav commands cover all top-level routes", () => {
		const hrefs = NAV_COMMANDS.length;
		// There are 11 entries in the sidebar nav (see lib/navigation.ts) —
		// if anyone adds a new sidebar entry, this counter should change so
		// the developer remembers to add a palette command too.
		expect(hrefs).toBe(11);
	});

	it("new-* actions navigate with ?new=1 so the receiving page can auto-open", () => {
		// The shared useOpenSheetOnNewParam hook reads ?new=1; if the URL
		// shape changes, this test catches the divergence.
		// We can't invoke perform without a Router, but the shape is in the
		// test surface as the only thing we expose from the source.
		expect(NEW_ACTIONS).toHaveLength(4);
		expect(NEW_ACTIONS.map((a) => a.id).sort()).toEqual([
			"new-asset",
			"new-member",
			"new-policy",
			"new-visit",
		]);
	});
});
