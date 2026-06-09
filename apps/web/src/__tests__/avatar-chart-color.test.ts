import { describe, it, expect } from "vitest";
import { getAvatarColor, AVATAR_PALETTE_SIZE, hashString } from "../lib/utils";
import { getChartColorForName, getChartColor } from "../lib/chart-config";

describe("avatar / chart color alignment", () => {
  it("getAvatarColor returns one of bg-chart-1..16", () => {
    const allowed = new Set(
      Array.from({ length: AVATAR_PALETTE_SIZE }, (_, i) => `bg-chart-${i + 1}`),
    );
    const samples = ["张伟", "Alice", "李雷", "韩梅梅", "Bob", "Carol", "David"];
    for (const name of samples) {
      expect(allowed.has(getAvatarColor(name))).toBe(true);
    }
  });

  it("same name maps to the same avatar slot and same chart slot", () => {
    const samples = ["张伟", "李雷", "韩梅梅", "Alice"];
    for (const name of samples) {
      const avatarClass = getAvatarColor(name);
      const chartColor = getChartColorForName(name);
      const avatarIndex = Number(avatarClass.replace("bg-chart-", "")) - 1;
      const positionalChartColor = getChartColor(avatarIndex);
      expect(chartColor).toBe(positionalChartColor);
    }
  });

  it("hash is stable across calls", () => {
    expect(hashString("张伟")).toBe(hashString("张伟"));
    expect(hashString("Alice")).toBe(hashString("Alice"));
  });

  it("getChartColorForName returns an hsl(var(--chart-N)) string", () => {
    const c = getChartColorForName("张伟");
    expect(c).toMatch(/^hsl\(var\(--chart-\d+\)\)$/);
  });
});
