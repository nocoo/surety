import { describe, expect, it, afterEach, mock } from "bun:test";
import {
  daysBetween,
  getMonthLabel,
  isSavingsPolicy,
  calculateRenewalDates,
  addMonths,
  formatYearMonth,
  calculateRenewalItems,
  groupByMonth,
  calculateSummary,
  buildRenewalCalendarData,
  formatCurrency,
  generateConsecutiveMonths,
  getUniquePolicyNames,
  fetchRenewalCalendarData,
  type PolicyForRenewal,
} from "@/lib/renewal-calendar-vm";

describe("renewal-calendar-vm", () => {
  describe("daysBetween", () => {
    it("calculates days between two dates correctly", () => {
      const from = new Date("2026-01-01");
      const to = new Date("2026-01-10");
      expect(daysBetween(from, to)).toBe(9);
    });

    it("returns 0 for same day", () => {
      const date = new Date("2026-01-01");
      expect(daysBetween(date, date)).toBe(0);
    });

    it("returns negative for past dates", () => {
      const from = new Date("2026-01-10");
      const to = new Date("2026-01-01");
      expect(daysBetween(from, to)).toBe(-9);
    });
  });

  describe("getMonthLabel", () => {
    it("formats month label in Chinese", () => {
      expect(getMonthLabel("2026-03")).toBe("2026年3月");
      expect(getMonthLabel("2026-12")).toBe("2026年12月");
    });
  });

  describe("isSavingsPolicy", () => {
    it("identifies annuity as savings", () => {
      expect(isSavingsPolicy("Annuity")).toBe(true);
      expect(isSavingsPolicy("Annuity", null)).toBe(true);
    });

    it("identifies regular life insurance as protection", () => {
      expect(isSavingsPolicy("Life")).toBe(false);
      expect(isSavingsPolicy("Life", "定期寿险")).toBe(false);
      expect(isSavingsPolicy("Life", null)).toBe(false);
    });

    it("identifies 增额终身寿 as savings", () => {
      expect(isSavingsPolicy("Life", "增额终身寿")).toBe(true);
      expect(isSavingsPolicy("Life", "增额寿")).toBe(true);
    });

    it("identifies protection categories", () => {
      expect(isSavingsPolicy("Medical")).toBe(false);
      expect(isSavingsPolicy("Accident")).toBe(false);
      expect(isSavingsPolicy("CriticalIllness")).toBe(false);
      expect(isSavingsPolicy("Property")).toBe(false);
    });
  });

  describe("addMonths", () => {
    it("adds months correctly", () => {
      const date = new Date("2026-01-15");
      const result = addMonths(date, 3);
      expect(result.getMonth()).toBe(3); // April (0-indexed)
      expect(result.getDate()).toBe(15);
    });

    it("handles month overflow", () => {
      const date = new Date("2026-01-31");
      const result = addMonths(date, 1);
      // Feb doesn't have 31 days, should go to last day
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(28);
    });

    it("handles year rollover", () => {
      const date = new Date("2026-11-15");
      const result = addMonths(date, 3);
      expect(result.getFullYear()).toBe(2027);
      expect(result.getMonth()).toBe(1); // February
    });
  });

  describe("formatYearMonth", () => {
    it("formats date to YYYY-MM", () => {
      expect(formatYearMonth(new Date("2026-03-15"))).toBe("2026-03");
      expect(formatYearMonth(new Date("2026-12-01"))).toBe("2026-12");
    });
  });

  describe("calculateRenewalDates", () => {
    it("returns empty for single payment", () => {
      const result = calculateRenewalDates(
        "2026-03-15",
        "Single",
        new Date("2026-01-01"),
        new Date("2026-12-31")
      );
      expect(result).toHaveLength(0);
    });

    it("calculates yearly renewals", () => {
      const result = calculateRenewalDates(
        "2026-03-15",
        "Yearly",
        new Date("2026-01-01"),
        new Date("2027-06-30")
      );
      expect(result).toHaveLength(2);
      expect(result[0]?.toISOString().startsWith("2026-03-15")).toBe(true);
      expect(result[1]?.toISOString().startsWith("2027-03-15")).toBe(true);
    });

    it("calculates monthly renewals", () => {
      const result = calculateRenewalDates(
        "2026-01-15",
        "Monthly",
        new Date("2026-01-01"),
        new Date("2026-03-31")
      );
      expect(result).toHaveLength(3);
    });

    it("excludes dates before start", () => {
      const result = calculateRenewalDates(
        "2025-06-15", // Past date
        "Yearly",
        new Date("2026-01-01"),
        new Date("2026-12-31")
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.toISOString().startsWith("2026-06-15")).toBe(true);
    });
  });

  describe("calculateRenewalItems", () => {
    const samplePolicies: PolicyForRenewal[] = [
      {
        id: 1,
        productName: "医疗险A",
        category: "Medical",
        premium: 1000,
        paymentFrequency: "Yearly",
        nextDueDate: "2026-03-15",
        insuredMemberName: "张三",
      },
      {
        id: 2,
        productName: "年金险B",
        category: "Annuity",
        premium: 5000,
        paymentFrequency: "Yearly",
        nextDueDate: "2026-06-01",
        insuredMemberName: "李四",
      },
      {
        id: 3,
        productName: "单次缴费",
        category: "Accident",
        premium: 200,
        paymentFrequency: "Single",
        nextDueDate: null,
      },
    ];

    it("calculates renewal items within time range", () => {
      const items = calculateRenewalItems(
        samplePolicies,
        new Date("2026-01-01"),
        12
      );
      
      // Should include yearly renewals, exclude single
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items.some(i => i.productName === "单次缴费")).toBe(false);
    });

    it("marks savings categories correctly", () => {
      const items = calculateRenewalItems(
        samplePolicies,
        new Date("2026-01-01"),
        12
      );
      
      const annuityItem = items.find(i => i.category === "Annuity");
      const medicalItem = items.find(i => i.category === "Medical");
      
      expect(annuityItem?.isSavings).toBe(true);
      expect(medicalItem?.isSavings).toBe(false);
    });

    it("sorts by due date", () => {
      const items = calculateRenewalItems(
        samplePolicies,
        new Date("2026-01-01"),
        12
      );
      
      for (let i = 1; i < items.length; i++) {
        const prev = items[i - 1]?.daysUntilDue ?? 0;
        const curr = items[i]?.daysUntilDue ?? 0;
        expect(prev).toBeLessThanOrEqual(curr);
      }
    });
  });

  describe("groupByMonth", () => {
    it("groups items by month with all 12 consecutive months", () => {
      const items = [
        {
          id: 1,
          productName: "A",
          category: "Medical",
          categoryLabel: "医疗险",
          premium: 1000,
          nextDueDate: "2026-03-15",
          daysUntilDue: 73,
          insuredMemberName: "张三",
          isSavings: false,
        },
        {
          id: 2,
          productName: "B",
          category: "Annuity",
          categoryLabel: "年金险",
          premium: 5000,
          nextDueDate: "2026-03-20",
          daysUntilDue: 78,
          insuredMemberName: "李四",
          isSavings: true,
        },
        {
          id: 3,
          productName: "C",
          category: "Accident",
          categoryLabel: "意外险",
          premium: 200,
          nextDueDate: "2026-04-01",
          daysUntilDue: 90,
          insuredMemberName: "张三",
          isSavings: false,
        },
      ];

      const referenceDate = new Date("2026-01-01");
      const grouped = groupByMonth(items, referenceDate, 12);
      
      // Should have all 12 months
      expect(grouped).toHaveLength(12);
      expect(grouped[0]?.month).toBe("2026-01");
      expect(grouped[0]?.count).toBe(0); // January has no items
      
      // March should have 2 items
      const march = grouped.find(m => m.month === "2026-03");
      expect(march?.count).toBe(2);
      expect(march?.totalPremium).toBe(6000);
      expect(march?.savingsPremium).toBe(5000);
      expect(march?.protectionPremium).toBe(1000);
      
      // April should have 1 item
      const april = grouped.find(m => m.month === "2026-04");
      expect(april?.count).toBe(1);
    });
  });

  describe("generateConsecutiveMonths", () => {
    it("generates 12 consecutive months", () => {
      const months = generateConsecutiveMonths(new Date("2026-01-15"), 12);
      expect(months).toHaveLength(12);
      expect(months[0]).toBe("2026-01");
      expect(months[11]).toBe("2026-12");
    });

    it("handles year rollover", () => {
      const months = generateConsecutiveMonths(new Date("2026-10-01"), 6);
      expect(months).toHaveLength(6);
      expect(months[0]).toBe("2026-10");
      expect(months[3]).toBe("2027-01");
    });
  });

  describe("getUniquePolicyNames", () => {
    it("extracts unique policy names", () => {
      const items = [
        { id: 1, productName: "A", category: "Medical", categoryLabel: "医疗险", premium: 1000, nextDueDate: "2026-03-15", daysUntilDue: 73, insuredMemberName: "张三", isSavings: false },
        { id: 1, productName: "A", category: "Medical", categoryLabel: "医疗险", premium: 1000, nextDueDate: "2027-03-15", daysUntilDue: 438, insuredMemberName: "张三", isSavings: false },
        { id: 2, productName: "B", category: "Annuity", categoryLabel: "年金险", premium: 5000, nextDueDate: "2026-06-01", daysUntilDue: 151, insuredMemberName: "李四", isSavings: true },
      ];

      const names = getUniquePolicyNames(items);
      expect(names).toHaveLength(2);
      expect(names).toContain("A");
      expect(names).toContain("B");
    });
  });

  describe("calculateSummary", () => {
    it("calculates summary correctly", () => {
      const items = [
        {
          id: 1,
          productName: "A",
          category: "Medical",
          categoryLabel: "医疗险",
          premium: 1000,
          nextDueDate: "2026-03-15",
          daysUntilDue: 73,
          insuredMemberName: "张三",
          isSavings: false,
        },
        {
          id: 1, // Same policy, different renewal date
          productName: "A",
          category: "Medical",
          categoryLabel: "医疗险",
          premium: 1000,
          nextDueDate: "2027-03-15",
          daysUntilDue: 438,
          insuredMemberName: "张三",
          isSavings: false,
        },
        {
          id: 2,
          productName: "B",
          category: "Annuity",
          categoryLabel: "年金险",
          premium: 5000,
          nextDueDate: "2026-06-01",
          daysUntilDue: 151,
          insuredMemberName: "李四",
          isSavings: true,
        },
      ];

      const summary = calculateSummary(items);
      
      expect(summary.totalPremium).toBe(7000);
      expect(summary.savingsPremium).toBe(5000);
      expect(summary.protectionPremium).toBe(2000);
      expect(summary.totalCount).toBe(2); // 2 unique policies
      expect(summary.renewalCount).toBe(3); // 3 renewal events
    });
  });

  describe("buildRenewalCalendarData", () => {
    it("builds complete calendar data", () => {
      const policies: PolicyForRenewal[] = [
        {
          id: 1,
          productName: "医疗险",
          category: "Medical",
          premium: 1000,
          paymentFrequency: "Yearly",
          nextDueDate: "2026-03-15",
          insuredMemberName: "张三",
        },
      ];

      const data = buildRenewalCalendarData(
        policies,
        new Date("2026-01-01"),
        12
      );

      expect(data.summary).toBeDefined();
      expect(data.monthlyData).toBeDefined();
      expect(data.policyNames).toBeDefined();
      expect(Array.isArray(data.monthlyData)).toBe(true);
      expect(data.monthlyData).toHaveLength(12); // All 12 months present
    });

    it("includes all unique policy names", () => {
      const policies: PolicyForRenewal[] = [
        {
          id: 1,
          productName: "医疗险A",
          category: "Medical",
          premium: 1000,
          paymentFrequency: "Yearly",
          nextDueDate: "2026-01-15",
          insuredMemberName: "张三",
        },
        {
          id: 2,
          productName: "意外险B",
          category: "Accident",
          premium: 500,
          paymentFrequency: "Yearly",
          nextDueDate: "2026-06-01",
          insuredMemberName: "李四",
        },
      ];

      const data = buildRenewalCalendarData(
        policies,
        new Date("2026-01-01"),
        12
      );

      expect(data.policyNames).toHaveLength(2);
      expect(data.policyNames).toContain("医疗险A");
      expect(data.policyNames).toContain("意外险B");
    });

    it("generates consecutive months even without renewals", () => {
      const policies: PolicyForRenewal[] = [];

      const data = buildRenewalCalendarData(
        policies,
        new Date("2026-01-01"),
        12
      );

      expect(data.monthlyData).toHaveLength(12);
      expect(data.monthlyData[0]?.month).toBe("2026-01");
      expect(data.monthlyData[11]?.month).toBe("2026-12");
      expect(data.summary.totalPremium).toBe(0);
    });
  });

  describe("formatCurrency", () => {
    it("formats small amounts", () => {
      expect(formatCurrency(500)).toBe("¥500");
      expect(formatCurrency(9999)).toBe("¥9,999");
    });

    it("formats large amounts in 万", () => {
      expect(formatCurrency(10000)).toBe("¥1万");
      expect(formatCurrency(15000)).toBe("¥1.5万");
      expect(formatCurrency(100000)).toBe("¥10万");
    });
  });

  describe("fetchRenewalCalendarData", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("fetches and returns renewal calendar data", async () => {
      const mockData = { months: [], summary: {} };
      const mockFn = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockData), { status: 200 }))
      );
      globalThis.fetch = Object.assign(mockFn, { preconnect: originalFetch.preconnect });

      const result = await fetchRenewalCalendarData();
      expect(result).toMatchObject(mockData);
      expect(mockFn).toHaveBeenCalledWith("/api/renewal-calendar");
    });

    it("throws on non-ok response", async () => {
      const mockFn = mock(() =>
        Promise.resolve(new Response("Error", { status: 503 }))
      );
      globalThis.fetch = Object.assign(mockFn, { preconnect: originalFetch.preconnect });

      expect(fetchRenewalCalendarData()).rejects.toThrow("Failed to fetch renewal calendar: 503");
    });
  });
});