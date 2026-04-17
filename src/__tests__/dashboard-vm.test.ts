import { describe, expect, test, afterEach, mock } from "bun:test";
import {
  createStatCards,
  fetchDashboardData,
  type DashboardStats,
} from "@/lib/dashboard-vm";

describe("dashboard-vm", () => {
  describe("createStatCards", () => {
    const mockStats: DashboardStats = {
      policyCount: 28,
      memberCount: 5,
      totalPremium: 175234,
      totalSumAssured: 50650000,
    };

    test("creates 4 cards with correct values and order", () => {
      const cards = createStatCards(mockStats);
      expect(cards).toHaveLength(4);
      expect(cards.map(c => c.label)).toEqual(["保单总数", "家庭成员", "年保费", "总保额"]);
      expect(cards.map(c => c.value)).toEqual(["28", "5", "¥17.5万", "¥5065万"]);
      expect(cards.map(c => c.iconName)).toEqual(["FileText", "Users", "TrendingUp", "Shield"]);
    });

    test("handles zero values", () => {
      const cards = createStatCards({ policyCount: 0, memberCount: 0, totalPremium: 0, totalSumAssured: 0 });
      expect(cards.map(c => c.value)).toEqual(["0", "0", "¥0", "¥0"]);
    });
  });

  describe("fetchDashboardData", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    test("fetches and returns dashboard data", async () => {
      const mockData = { policyCount: 10, memberCount: 3 };
      const mockFn = mock(() => Promise.resolve(new Response(JSON.stringify(mockData), { status: 200 })));
      globalThis.fetch = Object.assign(mockFn, { preconnect: originalFetch.preconnect });

      const result = await fetchDashboardData();
      expect(result).toMatchObject(mockData);
      expect(mockFn).toHaveBeenCalledWith("/api/dashboard");
    });

    test("throws on non-ok response", async () => {
      const mockFn = mock(() => Promise.resolve(new Response("Error", { status: 500 })));
      globalThis.fetch = Object.assign(mockFn, { preconnect: originalFetch.preconnect });

      expect(fetchDashboardData()).rejects.toThrow("Failed to fetch dashboard data: 500");
    });
  });
});