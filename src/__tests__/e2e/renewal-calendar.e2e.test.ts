import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface RenewalSummary {
  totalPremium: number;
  savingsPremium: number;
  protectionPremium: number;
  totalCount: number;
  renewalCount: number;
}

interface RenewalItem {
  id: number;
  productName: string;
  category: string;
  categoryLabel: string;
  premium: number;
  nextDueDate: string;
  daysUntilDue: number;
  insuredMemberName: string;
  isSavings: boolean;
}

interface MonthlyRenewal {
  month: string;
  monthLabel: string;
  items: RenewalItem[];
  totalPremium: number;
  savingsPremium: number;
  protectionPremium: number;
  count: number;
}

interface RenewalCalendarResponse {
  summary: RenewalSummary;
  monthlyData: MonthlyRenewal[];
  upcomingRenewals: RenewalItem[];
}

describe("Renewal Calendar API E2E", () => {
  beforeAll(async () => {
    await setupE2E();
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  });

  describe("GET /api/renewal-calendar", () => {
    test("returns renewal calendar data with correct structure", async () => {
      const { status, data } = await apiRequest<RenewalCalendarResponse>(
        "/api/renewal-calendar"
      );

      expect(status).toBe(200);
      expect(data.summary).toBeDefined();
      expect(data.monthlyData).toBeDefined();
      expect(data.upcomingRenewals).toBeDefined();
    });

    test("summary has correct structure", async () => {
      const { data } = await apiRequest<RenewalCalendarResponse>(
        "/api/renewal-calendar"
      );

      expect(typeof data.summary.totalPremium).toBe("number");
      expect(typeof data.summary.savingsPremium).toBe("number");
      expect(typeof data.summary.protectionPremium).toBe("number");
      expect(typeof data.summary.totalCount).toBe("number");
      expect(typeof data.summary.renewalCount).toBe("number");
    });

    test("summary values are non-negative", async () => {
      const { data } = await apiRequest<RenewalCalendarResponse>(
        "/api/renewal-calendar"
      );

      expect(data.summary.totalPremium).toBeGreaterThanOrEqual(0);
      expect(data.summary.savingsPremium).toBeGreaterThanOrEqual(0);
      expect(data.summary.protectionPremium).toBeGreaterThanOrEqual(0);
      expect(data.summary.totalCount).toBeGreaterThanOrEqual(0);
      expect(data.summary.renewalCount).toBeGreaterThanOrEqual(0);
    });

    test("savings + protection equals total", async () => {
      const { data } = await apiRequest<RenewalCalendarResponse>(
        "/api/renewal-calendar"
      );

      const calculatedTotal =
        data.summary.savingsPremium + data.summary.protectionPremium;
      expect(calculatedTotal).toBe(data.summary.totalPremium);
    });

    test("monthlyData is array sorted by month", async () => {
      const { data } = await apiRequest<RenewalCalendarResponse>(
        "/api/renewal-calendar"
      );

      expect(Array.isArray(data.monthlyData)).toBe(true);

      // Verify sorted order
      for (let i = 1; i < data.monthlyData.length; i++) {
        const prev = data.monthlyData[i - 1]!.month;
        const curr = data.monthlyData[i]!.month;
        expect(prev.localeCompare(curr)).toBeLessThanOrEqual(0);
      }
    });

    test("monthlyData items have correct structure", async () => {
      const { data } = await apiRequest<RenewalCalendarResponse>(
        "/api/renewal-calendar"
      );

      if (data.monthlyData.length > 0) {
        const month = data.monthlyData[0]!;
        expect(typeof month.month).toBe("string");
        expect(typeof month.monthLabel).toBe("string");
        expect(Array.isArray(month.items)).toBe(true);
        expect(typeof month.totalPremium).toBe("number");
        expect(typeof month.savingsPremium).toBe("number");
        expect(typeof month.protectionPremium).toBe("number");
        expect(typeof month.count).toBe("number");

        // Month format should be YYYY-MM
        expect(month.month).toMatch(/^\d{4}-\d{2}$/);
      }
    });

    test("renewal items have correct structure", async () => {
      const { data } = await apiRequest<RenewalCalendarResponse>(
        "/api/renewal-calendar"
      );

      // Check upcomingRenewals or items in monthlyData
      const items =
        data.upcomingRenewals.length > 0
          ? data.upcomingRenewals
          : data.monthlyData.length > 0
            ? data.monthlyData[0]!.items
            : [];

      if (items.length > 0) {
        const item = items[0]!;
        expect(typeof item.id).toBe("number");
        expect(typeof item.productName).toBe("string");
        expect(typeof item.category).toBe("string");
        expect(typeof item.categoryLabel).toBe("string");
        expect(typeof item.premium).toBe("number");
        expect(typeof item.nextDueDate).toBe("string");
        expect(typeof item.daysUntilDue).toBe("number");
        expect(typeof item.insuredMemberName).toBe("string");
        expect(typeof item.isSavings).toBe("boolean");

        // Date format should be YYYY-MM-DD
        expect(item.nextDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    test("upcomingRenewals are within 30 days", async () => {
      const { data } = await apiRequest<RenewalCalendarResponse>(
        "/api/renewal-calendar"
      );

      for (const item of data.upcomingRenewals) {
        expect(item.daysUntilDue).toBeLessThanOrEqual(30);
      }
    });

    test("upcomingRenewals are sorted by daysUntilDue", async () => {
      const { data } = await apiRequest<RenewalCalendarResponse>(
        "/api/renewal-calendar"
      );

      for (let i = 1; i < data.upcomingRenewals.length; i++) {
        const prev = data.upcomingRenewals[i - 1]!.daysUntilDue;
        const curr = data.upcomingRenewals[i]!.daysUntilDue;
        expect(prev).toBeLessThanOrEqual(curr);
      }
    });

    test("isSavings flag is consistent with category", async () => {
      const { data } = await apiRequest<RenewalCalendarResponse>(
        "/api/renewal-calendar"
      );

      const savingsCategories = ["Annuity", "Life"];

      for (const month of data.monthlyData) {
        for (const item of month.items) {
          const shouldBeSavings = savingsCategories.includes(item.category);
          expect(item.isSavings).toBe(shouldBeSavings);
        }
      }
    });
  });
});
