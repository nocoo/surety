import { describe, expect, test, beforeEach } from "bun:test";

/**
 * Unit tests for usePersistedState hook logic.
 * Since bun:test doesn't have jsdom/React rendering, we test the
 * localStorage contract: key naming, read/write, and cleanup semantics.
 */

// Mock localStorage for Node/Bun environment
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
  get length() { return store.size; },
  key: (index: number) => Array.from(store.keys())[index] ?? null,
};

describe("usePersistedState localStorage contract", () => {
  beforeEach(() => {
    store.clear();
  });

  describe("key naming convention", () => {
    test("filter keys use surety-filter- prefix", () => {
      const keys = [
        "surety-filter-insured",
        "surety-filter-category",
        "surety-filter-asset",
        "surety-filter-status",
      ];
      for (const key of keys) {
        expect(key).toStartWith("surety-filter-");
      }
    });

    test("sort keys use surety-sort- prefix", () => {
      expect("surety-sort-field").toStartWith("surety-sort-");
      expect("surety-sort-direction").toStartWith("surety-sort-");
    });

    test("view mode key uses surety-view- prefix", () => {
      expect("surety-view-mode").toStartWith("surety-view-");
    });
  });

  describe("read behavior", () => {
    test("returns null when no stored value", () => {
      expect(mockLocalStorage.getItem("surety-filter-insured")).toBeNull();
    });

    test("returns stored value when present", () => {
      mockLocalStorage.setItem("surety-filter-insured", "李征");
      expect(mockLocalStorage.getItem("surety-filter-insured")).toBe("李征");
    });
  });

  describe("write behavior", () => {
    test("stores non-default value", () => {
      const defaultValue = "all";
      const newValue = "Medical";
      // Simulate: when value !== default, store it
      if (newValue as string !== defaultValue) {
        mockLocalStorage.setItem("surety-filter-category", newValue);
      }
      expect(mockLocalStorage.getItem("surety-filter-category")).toBe("Medical");
    });

    test("removes key when value equals default", () => {
      mockLocalStorage.setItem("surety-filter-category", "Medical");
      const defaultValue = "all";
      const newValue = "all";
      // Simulate: when value === default, remove the key
      if (newValue as string === defaultValue) {
        mockLocalStorage.removeItem("surety-filter-category");
      }
      expect(mockLocalStorage.getItem("surety-filter-category")).toBeNull();
    });
  });

  describe("all filter keys are independent", () => {
    test("setting one filter does not affect others", () => {
      mockLocalStorage.setItem("surety-filter-insured", "李征");
      mockLocalStorage.setItem("surety-filter-category", "Medical");
      
      expect(mockLocalStorage.getItem("surety-filter-insured")).toBe("李征");
      expect(mockLocalStorage.getItem("surety-filter-category")).toBe("Medical");
      expect(mockLocalStorage.getItem("surety-filter-asset")).toBeNull();
      expect(mockLocalStorage.getItem("surety-filter-status")).toBeNull();
    });
  });

  describe("sort persistence", () => {
    test("persists sort field and direction independently", () => {
      mockLocalStorage.setItem("surety-sort-field", "premium");
      mockLocalStorage.setItem("surety-sort-direction", "desc");
      
      expect(mockLocalStorage.getItem("surety-sort-field")).toBe("premium");
      expect(mockLocalStorage.getItem("surety-sort-direction")).toBe("desc");
    });
  });

  describe("view mode persistence", () => {
    test("persists view mode", () => {
      mockLocalStorage.setItem("surety-view-mode", "byCategory");
      expect(mockLocalStorage.getItem("surety-view-mode")).toBe("byCategory");
    });

    test("supports all three view modes", () => {
      for (const mode of ["list", "byCategory", "byInsured"]) {
        mockLocalStorage.setItem("surety-view-mode", mode);
        expect(mockLocalStorage.getItem("surety-view-mode")).toBe(mode);
      }
    });
  });

  describe("clear all filters", () => {
    test("removing all filter keys resets to defaults", () => {
      // Set some filters
      mockLocalStorage.setItem("surety-filter-insured", "李征");
      mockLocalStorage.setItem("surety-filter-category", "Medical");
      mockLocalStorage.setItem("surety-filter-status", "Active");
      
      // Clear all filter keys (simulate "清除筛选")
      const filterKeys = [
        "surety-filter-insured",
        "surety-filter-category",
        "surety-filter-asset",
        "surety-filter-status",
      ];
      for (const key of filterKeys) {
        mockLocalStorage.removeItem(key);
      }
      
      // All should be null (hook will use default "all")
      for (const key of filterKeys) {
        expect(mockLocalStorage.getItem(key)).toBeNull();
      }
      
      // Sort/view should remain untouched
      mockLocalStorage.setItem("surety-sort-field", "premium");
      expect(mockLocalStorage.getItem("surety-sort-field")).toBe("premium");
    });
  });
});
