import { describe, expect, test, afterEach, mock } from "bun:test";
import {
  createStatCards,
  formatStatCurrency,
  fetchDashboardData,
  type DashboardStats,
  type StatCardData,
} from "@/lib/dashboard-vm";

describe("dashboard-vm", () => {
  describe("formatStatCurrency", () => {
    test("formats small numbers with yen symbol", () => {
      expect(formatStatCurrency(100)).toBe("¥100");
      expect(formatStatCurrency(1000)).toBe("¥1,000");
      expect(formatStatCurrency(9999)).toBe("¥9,999");
    });

    test("formats numbers >= 10000 in 万 units", () => {
      expect(formatStatCurrency(10000)).toBe("¥1万");
      expect(formatStatCurrency(15000)).toBe("¥1.5万");
      expect(formatStatCurrency(100000)).toBe("¥10万");
    });

    test("removes decimal when divisible by 10000", () => {
      expect(formatStatCurrency(20000)).toBe("¥2万");
      expect(formatStatCurrency(50000)).toBe("¥5万");
    });

    test("handles zero", () => {
      expect(formatStatCurrency(0)).toBe("¥0");
    });
  });

  describe("createStatCards", () => {
    const mockStats: DashboardStats = {
      policyCount: 28,
      memberCount: 5,
      totalPremium: 175234,
      totalSumAssured: 50650000,
    };

    test("returns array of 4 stat cards", () => {
      const cards = createStatCards(mockStats);
      expect(cards).toHaveLength(4);
    });

    test("creates policy count card", () => {
      const cards = createStatCards(mockStats);
      const policyCard = cards.find((c) => c.label === "保单总数");
      expect(policyCard).toBeDefined();
      expect(policyCard?.value).toBe("28");
      expect(policyCard?.iconName).toBe("FileText");
    });

    test("creates member count card", () => {
      const cards = createStatCards(mockStats);
      const memberCard = cards.find((c) => c.label === "家庭成员");
      expect(memberCard).toBeDefined();
      expect(memberCard?.value).toBe("5");
      expect(memberCard?.iconName).toBe("Users");
    });

    test("creates premium card with formatted currency", () => {
      const cards = createStatCards(mockStats);
      const premiumCard = cards.find((c) => c.label === "年保费");
      expect(premiumCard).toBeDefined();
      expect(premiumCard?.value).toBe("¥17.5万");
      expect(premiumCard?.iconName).toBe("TrendingUp");
    });

    test("creates sum assured card with formatted currency", () => {
      const cards = createStatCards(mockStats);
      const sumAssuredCard = cards.find((c) => c.label === "总保额");
      expect(sumAssuredCard).toBeDefined();
      expect(sumAssuredCard?.value).toBe("¥5065万");
      expect(sumAssuredCard?.iconName).toBe("Shield");
    });

    test("all cards have required properties", () => {
      const cards = createStatCards(mockStats);
      for (const card of cards) {
        expect(card.label).toBeDefined();
        expect(card.value).toBeDefined();
        expect(card.iconName).toBeDefined();
      }
    });

    test("handles zero values", () => {
      const zeroStats: DashboardStats = {
        policyCount: 0,
        memberCount: 0,
        totalPremium: 0,
        totalSumAssured: 0,
      };
      const cards = createStatCards(zeroStats);
      expect(cards[0]?.value).toBe("0");
      expect(cards[1]?.value).toBe("0");
      expect(cards[2]?.value).toBe("¥0");
      expect(cards[3]?.value).toBe("¥0");
    });

    test("cards are in correct order", () => {
      const cards = createStatCards(mockStats);
      expect(cards[0]?.label).toBe("保单总数");
      expect(cards[1]?.label).toBe("家庭成员");
      expect(cards[2]?.label).toBe("年保费");
      expect(cards[3]?.label).toBe("总保额");
    });

    test("icon names are valid", () => {
      const validIcons: StatCardData["iconName"][] = ["FileText", "Users", "TrendingUp", "Shield"];
      const cards = createStatCards(mockStats);
      for (const card of cards) {
        expect(validIcons).toContain(card.iconName);
      }
    });
  });

  describe("fetchDashboardData", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    test("fetches and returns dashboard data", async () => {
      const mockData = { policyCount: 10, memberCount: 3 };
      const mockFn = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockData), { status: 200 }))
      );
      globalThis.fetch = Object.assign(mockFn, { preconnect: originalFetch.preconnect });

      const result = await fetchDashboardData();
      expect(result).toMatchObject(mockData);
      expect(mockFn).toHaveBeenCalledWith("/api/dashboard");
    });

    test("throws on non-ok response", async () => {
      const mockFn = mock(() =>
        Promise.resolve(new Response("Error", { status: 500 }))
      );
      globalThis.fetch = Object.assign(mockFn, { preconnect: originalFetch.preconnect });

      expect(fetchDashboardData()).rejects.toThrow("Failed to fetch dashboard data: 500");
    });
  });
});