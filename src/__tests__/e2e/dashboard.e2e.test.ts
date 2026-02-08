import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface DashboardStats {
  policyCount: number;
  memberCount: number;
  totalPremium: number;
  totalSumAssured: number;
}

interface ChartData {
  premiumByCategory: Array<{
    category: string;
    label: string;
    count: number;
    premium: number;
    sumAssured: number;
  }>;
  premiumByMember: Array<{
    name: string;
    premium: number;
    count: number;
  }>;
  policyByInsurer: Array<{
    name: string;
    count: number;
    premium: number;
  }>;
  policyByChannel: Array<{
    name: string;
    count: number;
    premium: number;
  }>;
  coverageByCategory: Array<{
    label: string;
    sumAssured: number;
  }>;
  policyByYear: Array<{
    year: string;
    count: number;
    premium: number;
  }>;
}

interface DashboardResponse {
  stats: DashboardStats;
  charts: ChartData;
}

describe("Dashboard API E2E", () => {
  beforeAll(async () => {
    await setupE2E();
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  });

  describe("GET /api/dashboard", () => {
    test("returns dashboard data with correct structure", async () => {
      const { status, data } = await apiRequest<DashboardResponse>(
        "/api/dashboard"
      );

      expect(status).toBe(200);
      expect(data.stats).toBeDefined();
      expect(typeof data.stats.policyCount).toBe("number");
      expect(typeof data.stats.memberCount).toBe("number");
      expect(typeof data.stats.totalPremium).toBe("number");
      expect(typeof data.stats.totalSumAssured).toBe("number");
      expect(data.charts).toBeDefined();
    });

    test("stats values are non-negative", async () => {
      const { data } = await apiRequest<DashboardResponse>("/api/dashboard");

      expect(data.stats.policyCount).toBeGreaterThanOrEqual(0);
      expect(data.stats.memberCount).toBeGreaterThanOrEqual(0);
      expect(data.stats.totalPremium).toBeGreaterThanOrEqual(0);
      expect(data.stats.totalSumAssured).toBeGreaterThanOrEqual(0);
    });

    test("charts has correct structure", async () => {
      const { data } = await apiRequest<DashboardResponse>("/api/dashboard");

      expect(Array.isArray(data.charts.premiumByCategory)).toBe(true);
      expect(Array.isArray(data.charts.premiumByMember)).toBe(true);
      expect(Array.isArray(data.charts.policyByInsurer)).toBe(true);
      expect(Array.isArray(data.charts.policyByChannel)).toBe(true);
      expect(Array.isArray(data.charts.coverageByCategory)).toBe(true);
      expect(Array.isArray(data.charts.policyByYear)).toBe(true);
    });

    test("premiumByCategory has correct item structure", async () => {
      const { data } = await apiRequest<DashboardResponse>("/api/dashboard");

      if (data.charts.premiumByCategory.length > 0) {
        const item = data.charts.premiumByCategory[0]!;
        expect(typeof item.category).toBe("string");
        expect(typeof item.label).toBe("string");
        expect(typeof item.count).toBe("number");
        expect(typeof item.premium).toBe("number");
        expect(typeof item.sumAssured).toBe("number");
      }
    });

    test("premiumByMember has correct item structure", async () => {
      const { data } = await apiRequest<DashboardResponse>("/api/dashboard");

      if (data.charts.premiumByMember.length > 0) {
        const item = data.charts.premiumByMember[0]!;
        expect(typeof item.name).toBe("string");
        expect(typeof item.premium).toBe("number");
        expect(typeof item.count).toBe("number");
      }
    });

    test("policyByInsurer limited to 8 items", async () => {
      const { data } = await apiRequest<DashboardResponse>("/api/dashboard");

      expect(data.charts.policyByInsurer.length).toBeLessThanOrEqual(8);
    });
  });
});
