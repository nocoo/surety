import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface DashboardStats {
  policyCount: number;
  memberCount: number;
  totalPremium: number;
}

interface UpcomingRenewal {
  id: number;
  productName: string;
  insuredName: string;
  dueDate: string;
}

interface DashboardResponse {
  stats: DashboardStats;
  upcomingRenewals: UpcomingRenewal[];
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
      expect(Array.isArray(data.upcomingRenewals)).toBe(true);
    });

    test("stats values are non-negative", async () => {
      const { data } = await apiRequest<DashboardResponse>("/api/dashboard");

      expect(data.stats.policyCount).toBeGreaterThanOrEqual(0);
      expect(data.stats.memberCount).toBeGreaterThanOrEqual(0);
      expect(data.stats.totalPremium).toBeGreaterThanOrEqual(0);
    });

    test("upcomingRenewals has correct item structure", async () => {
      const { data } = await apiRequest<DashboardResponse>("/api/dashboard");

      if (data.upcomingRenewals.length > 0) {
        const renewal = data.upcomingRenewals[0]!;
        expect(typeof renewal.id).toBe("number");
        expect(typeof renewal.productName).toBe("string");
        expect(typeof renewal.insuredName).toBe("string");
        expect(typeof renewal.dueDate).toBe("string");
      }
    });

    test("upcomingRenewals limited to 5 items", async () => {
      const { data } = await apiRequest<DashboardResponse>("/api/dashboard");

      expect(data.upcomingRenewals.length).toBeLessThanOrEqual(5);
    });
  });
});
