import { describe, expect, it } from "vitest";
import { msUntilLocalMidnight } from "@/hooks/use-local-date-key";

describe("msUntilLocalMidnight", () => {
	it("returns remaining ms until next local midnight", () => {
		const now = new Date(2026, 5, 15, 23, 0, 0, 0); // 23:00 local
		const ms = msUntilLocalMidnight(now);
		expect(ms).toBe(60 * 60 * 1000);
	});

	it("returns a full day at local midnight", () => {
		const now = new Date(2026, 5, 15, 0, 0, 0, 0);
		const ms = msUntilLocalMidnight(now);
		expect(ms).toBe(24 * 60 * 60 * 1000);
	});

	it("never returns negative", () => {
		const now = new Date(2026, 5, 15, 12, 30, 0, 0);
		expect(msUntilLocalMidnight(now)).toBeGreaterThan(0);
	});
});
