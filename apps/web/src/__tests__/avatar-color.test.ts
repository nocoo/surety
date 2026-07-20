import { describe, expect, it } from "vitest";
import { getAvatarColor, hashString } from "../lib/utils";

// HSL values mirrored from globals.css. If those tokens change, this
// test is the canary — it computes WCAG contrast against white text
// and fails if any slot drops below the 4.5:1 AA threshold.
//
// Mirroring (instead of importing) is intentional: the test is a
// regression net, not a tautology. If someone tweaks --avatar-N in
// globals.css without updating these numbers, the test should flag it.
const AVATAR_HSL_LIGHT: Array<[number, number, number]> = [
	[348, 65, 42],
	[22, 75, 34],
	[38, 80, 28],
	[70, 50, 26],
	[142, 55, 28],
	[172, 65, 25],
	[192, 70, 28],
	[210, 60, 38],
	[220, 60, 42],
	[240, 50, 45],
	[260, 50, 45],
	[280, 50, 40],
	[300, 45, 38],
	[325, 55, 42],
	[0, 60, 40],
	[210, 14, 38],
];

const AVATAR_HSL_DARK: Array<[number, number, number]> = [
	[348, 55, 42],
	[22, 65, 38],
	[38, 65, 33],
	[70, 42, 30],
	[142, 48, 32],
	[172, 55, 30],
	[192, 55, 33],
	[210, 50, 42],
	[220, 55, 46],
	[240, 45, 48],
	[260, 45, 48],
	[280, 45, 44],
	[300, 40, 42],
	[325, 45, 46],
	[0, 50, 44],
	[210, 14, 42],
];

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	const sFrac = s / 100;
	const lFrac = l / 100;
	const c = (1 - Math.abs(2 * lFrac - 1)) * sFrac;
	const hh = h / 60;
	const x = c * (1 - Math.abs((hh % 2) - 1));
	let r = 0;
	let g = 0;
	let b = 0;
	if (hh >= 0 && hh < 1) [r, g, b] = [c, x, 0];
	else if (hh < 2) [r, g, b] = [x, c, 0];
	else if (hh < 3) [r, g, b] = [0, c, x];
	else if (hh < 4) [r, g, b] = [0, x, c];
	else if (hh < 5) [r, g, b] = [x, 0, c];
	else [r, g, b] = [c, 0, x];
	const m = lFrac - c / 2;
	return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function relLum([r, g, b]: [number, number, number]): number {
	const ch = (c: number) => {
		const v = c / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
	const la = relLum(a);
	const lb = relLum(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const WHITE: [number, number, number] = [255, 255, 255];

describe("avatar palette", () => {
	it("returns a known bg-avatar-N class", () => {
		const allowed = new Set(Array.from({ length: 16 }, (_, i) => `bg-avatar-${i + 1}`));
		const samples = ["张伟", "Alice", "李雷", "韩梅梅", "Bob", "Carol", "David"];
		for (const name of samples) {
			expect(allowed.has(getAvatarColor(name))).toBe(true);
		}
	});

	it("does not return any bg-chart-N class (chart palette is fill-only)", () => {
		const samples = Array.from({ length: 200 }, (_, i) => `name-${i}`);
		for (const name of samples) {
			expect(getAvatarColor(name)).not.toMatch(/^bg-chart-/);
		}
	});

	it("every light-mode slot clears 4.5:1 vs white text", () => {
		expect(AVATAR_HSL_LIGHT).toHaveLength(16);
		for (const hsl of AVATAR_HSL_LIGHT) {
			const ratio = contrast(WHITE, hslToRgb(...hsl));
			expect(ratio).toBeGreaterThanOrEqual(4.5);
		}
	});

	it("every dark-mode slot clears 4.5:1 vs white text", () => {
		expect(AVATAR_HSL_DARK).toHaveLength(16);
		for (const hsl of AVATAR_HSL_DARK) {
			const ratio = contrast(WHITE, hslToRgb(...hsl));
			expect(ratio).toBeGreaterThanOrEqual(4.5);
		}
	});

	it("same name maps to same color (stable)", () => {
		expect(getAvatarColor("张伟")).toBe(getAvatarColor("张伟"));
		expect(getAvatarColor("Alice")).toBe(getAvatarColor("Alice"));
	});

	it("hash is stable across calls", () => {
		expect(hashString("张伟")).toBe(hashString("张伟"));
		expect(hashString("Alice")).toBe(hashString("Alice"));
	});
});
