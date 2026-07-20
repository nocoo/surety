import { describe, expect, it } from "vitest";
import { familySubtitle, greetingForHour } from "@/lib/greeting";

describe("greetingForHour", () => {
	it("returns 凌晨好 for early morning", () => {
		expect(greetingForHour(0)).toBe("凌晨好");
		expect(greetingForHour(4)).toBe("凌晨好");
	});

	it("returns 早上好 for morning", () => {
		expect(greetingForHour(5)).toBe("早上好");
		expect(greetingForHour(10)).toBe("早上好");
	});

	it("returns 上午好 just before noon", () => {
		expect(greetingForHour(11)).toBe("上午好");
		expect(greetingForHour(12)).toBe("上午好");
	});

	it("returns 下午好 in the afternoon", () => {
		expect(greetingForHour(13)).toBe("下午好");
		expect(greetingForHour(17)).toBe("下午好");
	});

	it("returns 晚上好 in the evening", () => {
		expect(greetingForHour(18)).toBe("晚上好");
		expect(greetingForHour(23)).toBe("晚上好");
	});

	it("returns a safe default for invalid input", () => {
		expect(greetingForHour(-1)).toBe("你好");
		expect(greetingForHour(24)).toBe("你好");
		expect(greetingForHour(NaN)).toBe("你好");
	});
});

describe("familySubtitle", () => {
	it("prompts to add members when none exist", () => {
		expect(familySubtitle(0, 0)).toBe("添加家庭成员开始守护他们");
		expect(familySubtitle(0, 5)).toBe("添加家庭成员开始守护他们");
	});

	it("prompts to add a policy when members exist but no policies", () => {
		expect(familySubtitle(3, 0)).toBe("已有 3 位家庭成员，添加保单开始守护");
	});

	it("reports current coverage when both exist", () => {
		expect(familySubtitle(5, 12)).toBe("已为家中 5 位成员守护 12 份保单");
		expect(familySubtitle(1, 1)).toBe("已为家中 1 位成员守护 1 份保单");
	});
});
