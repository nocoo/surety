import { describe, expect, test } from "bun:test";
import { cn, hashString, getAvatarColor } from "@/lib/utils";

describe("cn utility", () => {
  test("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  test("handles conditional classes", () => {
    expect(cn("base", false && "hidden", true && "visible")).toBe(
      "base visible"
    );
  });

  test("merges tailwind classes correctly", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  test("handles empty inputs", () => {
    expect(cn()).toBe("");
  });

  test("handles undefined and null", () => {
    expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
  });
});

describe("hashString", () => {
  test("returns consistent hash for same input", () => {
    const hash1 = hashString("test");
    const hash2 = hashString("test");
    expect(hash1).toBe(hash2);
  });

  test("returns different hash for different input", () => {
    const hash1 = hashString("test1");
    const hash2 = hashString("test2");
    expect(hash1).not.toBe(hash2);
  });

  test("handles Chinese characters", () => {
    const hash1 = hashString("寿险");
    const hash2 = hashString("寿险");
    expect(hash1).toBe(hash2);

    const hash3 = hashString("重疾险");
    expect(hash1).not.toBe(hash3);
  });

  test("returns positive number", () => {
    expect(hashString("test")).toBeGreaterThanOrEqual(0);
    expect(hashString("寿险")).toBeGreaterThanOrEqual(0);
  });
});

describe("getAvatarColor", () => {
  test("returns consistent color for same name", () => {
    const color1 = getAvatarColor("张三");
    const color2 = getAvatarColor("张三");
    expect(color1).toBe(color2);
  });

  test("returns bg-* class", () => {
    const color = getAvatarColor("李四");
    expect(color).toMatch(/^bg-\w+-\d+$/);
  });
});


