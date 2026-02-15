import { describe, expect, test } from "bun:test";
import {
  CATEGORY_CONFIG,
  getCategoryConfig,
  MEMBER_AVATAR_COLORS,
  getMemberColorIndex,
  getMemberAvatarColors,
  getNameInitial,
} from "@/lib/category-config";

describe("category-config", () => {
  describe("CATEGORY_CONFIG", () => {
    test("has all 6 policy categories", () => {
      const categories = Object.keys(CATEGORY_CONFIG);
      expect(categories).toContain("Life");
      expect(categories).toContain("CriticalIllness");
      expect(categories).toContain("Medical");
      expect(categories).toContain("Accident");
      expect(categories).toContain("Annuity");
      expect(categories).toContain("Property");
      expect(categories).toHaveLength(6);
    });

    test("each category has required properties", () => {
      for (const [, config] of Object.entries(CATEGORY_CONFIG)) {
        expect(config.label).toBeDefined();
        expect(config.variant).toBeDefined();
        expect(config.bgColor).toBeDefined();
        expect(config.textColor).toBeDefined();
      }
    });

    test("labels are in Chinese", () => {
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
      expect(getCategoryConfig("Property").bgColor).toBe("bg-teal-500");
    });

    test("returns default config for unknown category", () => {
      const config = getCategoryConfig("UnknownCategory");
      expect(config.label).toBe("UnknownCategory");
      expect(config.variant).toBe("secondary");
      expect(config.bgColor).toBe("bg-slate-500");
      expect(config.textColor).toBe("text-slate-500");
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
    test("returns consistent index for same name", () => {
      const name = "张三";
      const index1 = getMemberColorIndex(name);
      const index2 = getMemberColorIndex(name);
      expect(index1).toBe(index2);
    });

    test("returns index within valid range", () => {
      const testNames = ["张三", "李四", "王五", "赵六", "John", "Jane", "A", "测试用户名很长"];
      for (const name of testNames) {
        const index = getMemberColorIndex(name);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(MEMBER_AVATAR_COLORS.length);
      }
    });

    test("different names can have different indices", () => {
      const indices = new Set<number>();
      const names = ["张三", "李四", "王五", "赵六", "孙七", "周八", "吴九", "郑十"];
      for (const name of names) {
        indices.add(getMemberColorIndex(name));
      }
      // At least some variation expected
      expect(indices.size).toBeGreaterThan(1);
    });

    test("handles empty string", () => {
      const index = getMemberColorIndex("");
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(MEMBER_AVATAR_COLORS.length);
    });

    test("handles single character", () => {
      const index = getMemberColorIndex("A");
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(MEMBER_AVATAR_COLORS.length);
    });
  });

  describe("getMemberAvatarColors", () => {
    test("returns valid color object", () => {
      const colors = getMemberAvatarColors("张三");
      expect(colors.bg).toBeDefined();
      expect(colors.text).toBeDefined();
      expect(colors.bg).toMatch(/^bg-/);
      expect(colors.text).toMatch(/^text-/);
    });

    test("returns consistent colors for same name", () => {
      const colors1 = getMemberAvatarColors("李娜");
      const colors2 = getMemberAvatarColors("李娜");
      expect(colors1.bg).toBe(colors2.bg);
      expect(colors1.text).toBe(colors2.text);
    });

    test("colors come from MEMBER_AVATAR_COLORS", () => {
      const testNames = ["张三", "李四", "王五"];
      for (const name of testNames) {
        const colors = getMemberAvatarColors(name);
        const found = MEMBER_AVATAR_COLORS.some(
          (c) => c.bg === colors.bg && c.text === colors.text
        );
        expect(found).toBe(true);
      }
    });
  });

  describe("getNameInitial", () => {
    test("returns first character for Chinese names", () => {
      expect(getNameInitial("张三")).toBe("张");
      expect(getNameInitial("李四")).toBe("李");
      expect(getNameInitial("王")).toBe("王");
    });

    test("returns uppercase first character for English names", () => {
      expect(getNameInitial("john")).toBe("J");
      expect(getNameInitial("Jane")).toBe("J");
      expect(getNameInitial("MIKE")).toBe("M");
    });

    test("handles single character", () => {
      expect(getNameInitial("A")).toBe("A");
      expect(getNameInitial("z")).toBe("Z");
      expect(getNameInitial("张")).toBe("张");
    });

    test("returns ? for empty string", () => {
      expect(getNameInitial("")).toBe("?");
    });

    test("handles mixed names", () => {
      expect(getNameInitial("A张三")).toBe("A");
      expect(getNameInitial("张A三")).toBe("张");
    });
  });
});
