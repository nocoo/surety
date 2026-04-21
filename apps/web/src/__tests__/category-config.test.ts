import { describe, expect, test } from "bun:test";
import {
  CATEGORY_CONFIG,
  getCategoryConfig,
  MEMBER_AVATAR_COLORS,
  getMemberColorIndex,
  getMemberAvatarColors,
  getNameInitial,
} from "@surety/api/lib/category-config";

describe("category-config", () => {
  describe("CATEGORY_CONFIG", () => {
    test("has all 6 categories with Chinese labels", () => {
      expect(Object.keys(CATEGORY_CONFIG)).toHaveLength(6);
      expect(CATEGORY_CONFIG.Life.label).toBe("寿险");
      expect(CATEGORY_CONFIG.CriticalIllness.label).toBe("重疾险");
      expect(CATEGORY_CONFIG.Medical.label).toBe("医疗险");
      expect(CATEGORY_CONFIG.Accident.label).toBe("意外险");
      expect(CATEGORY_CONFIG.Annuity.label).toBe("年金险");
      expect(CATEGORY_CONFIG.Property.label).toBe("财产险");
    });
  });

  describe("getCategoryConfig", () => {
    test("returns correct config for valid categories", () => {
      expect(getCategoryConfig("Life").label).toBe("寿险");
      expect(getCategoryConfig("Medical").variant).toBe("success");
      expect(getCategoryConfig("Property").accentClass).toBe("text-teal");
    });

    test("returns default config for unknown category", () => {
      const config = getCategoryConfig("UnknownCategory");
      expect(config.label).toBe("UnknownCategory");
      expect(config.variant).toBe("secondary");
      expect(config.accentClass).toBe("text-muted-foreground");
      expect(config.accentSoftClass).toBe("bg-muted text-muted-foreground");
    });

    test("returns default config for empty string", () => {
      const config = getCategoryConfig("");
      expect(config.label).toBe("");
      expect(config.variant).toBe("secondary");
    });
  });

  describe("MEMBER_AVATAR_COLORS", () => {
    test("has 8 color options", () => {
      expect(MEMBER_AVATAR_COLORS).toHaveLength(8);
    });

    test("each color has bg and text properties", () => {
      for (const color of MEMBER_AVATAR_COLORS) {
        expect(color.bg).toBeDefined();
        expect(color.text).toBeDefined();
        expect(color.bg).toMatch(/^bg-/);
        expect(color.text).toMatch(/^text-/);
      }
    });
  });

  describe("getMemberColorIndex", () => {
    test("returns consistent index within valid range for various inputs", () => {
      // Consistency: same name → same index
      expect(getMemberColorIndex("张三")).toBe(getMemberColorIndex("张三"));
      
      // Valid range for various inputs (Chinese, English, edge cases)
      const testNames = ["张三", "李四", "John", "A", "", "测试用户名很长"];
      for (const name of testNames) {
        const index = getMemberColorIndex(name);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(MEMBER_AVATAR_COLORS.length);
      }
      
      // Different names produce variation
      const indices = new Set(["张三", "李四", "王五", "赵六"].map(getMemberColorIndex));
      expect(indices.size).toBeGreaterThan(1);
    });
  });

  describe("getMemberAvatarColors", () => {
    test("returns consistent valid colors from palette", () => {
      const testNames = ["张三", "李四", "李娜"];
      for (const name of testNames) {
        const colors = getMemberAvatarColors(name);
        // Valid format
        expect(colors.bg).toMatch(/^bg-/);
        expect(colors.text).toMatch(/^text-/);
        // Comes from palette
        expect(MEMBER_AVATAR_COLORS.some(c => c.bg === colors.bg && c.text === colors.text)).toBe(true);
      }
      // Consistency: same name → same colors
      expect(getMemberAvatarColors("李娜").bg).toBe(getMemberAvatarColors("李娜").bg);
    });
  });

  describe("getNameInitial", () => {
    test("extracts and normalizes first character", () => {
      // Chinese names
      expect(getNameInitial("张三")).toBe("张");
      expect(getNameInitial("王")).toBe("王");
      // English names (uppercase)
      expect(getNameInitial("john")).toBe("J");
      expect(getNameInitial("Jane")).toBe("J");
      // Edge cases
      expect(getNameInitial("")).toBe("?");
      expect(getNameInitial("A张三")).toBe("A");
    });
  });
});
