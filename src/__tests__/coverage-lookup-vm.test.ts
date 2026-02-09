import { describe, expect, test, afterEach, mock } from "bun:test";
import {
  formatSumAssured,
  formatPremium,
  buildMemberCards,
  buildAssetCards,
  buildPolicyCards,
  groupPoliciesByCategory,
  buildMemberCoverageData,
  buildAssetCoverageData,
  fetchCoverageLookupData,
  RELATION_LABELS,
  ASSET_TYPE_LABELS,
  STATUS_LABELS,
  CATEGORY_ORDER,
  type MemberForCoverage,
  type AssetForCoverage,
  type PolicyForCoverage,
} from "@/lib/coverage-lookup-vm";

describe("coverage-lookup-vm", () => {
  describe("formatSumAssured", () => {
    test("formats values >= 10000 as 万", () => {
      expect(formatSumAssured(100000)).toBe("10万");
      expect(formatSumAssured(500000)).toBe("50万");
      expect(formatSumAssured(1000000)).toBe("100万");
    });

    test("formats decimal 万 values with one decimal", () => {
      expect(formatSumAssured(150000)).toBe("15万");
      expect(formatSumAssured(155000)).toBe("15.5万");
    });

    test("formats values < 10000 with locale string", () => {
      expect(formatSumAssured(5000)).toBe("5,000");
      expect(formatSumAssured(1234)).toBe("1,234");
    });
  });

  describe("formatPremium", () => {
    test("formats with ¥ prefix and locale string", () => {
      expect(formatPremium(1000)).toBe("¥1,000");
      expect(formatPremium(12345)).toBe("¥12,345");
    });
  });

  describe("buildMemberCards", () => {
    const members: MemberForCoverage[] = [
      { id: 1, name: "张三", relation: "Self", gender: "M" },
      { id: 2, name: "李四", relation: "Spouse", gender: "F" },
    ];

    test("builds cards with policy counts and totals", () => {
      const policiesByMember = new Map<number, PolicyForCoverage[]>([
        [1, [
          createPolicy({ id: 1, sumAssured: 500000, status: "Active" }),
          createPolicy({ id: 2, sumAssured: 300000, status: "Active" }),
        ]],
        [2, [
          createPolicy({ id: 3, sumAssured: 200000, status: "Lapsed" }),
        ]],
      ]);

      const cards = buildMemberCards(members, policiesByMember);

      expect(cards).toHaveLength(2);
      expect(cards[0]).toEqual({
        id: 1,
        name: "张三",
        relation: "Self",
        relationLabel: "本人",
        gender: "M",
        activePolicyCount: 2,
        totalSumAssured: 800000,
      });
      expect(cards[1]).toEqual({
        id: 2,
        name: "李四",
        relation: "Spouse",
        relationLabel: "配偶",
        gender: "F",
        activePolicyCount: 0, // Lapsed policy not counted
        totalSumAssured: 0,
      });
    });

    test("handles members with no policies", () => {
      const policiesByMember = new Map<number, PolicyForCoverage[]>();

      const cards = buildMemberCards(members, policiesByMember);

      expect(cards[0]?.activePolicyCount).toBe(0);
      expect(cards[0]?.totalSumAssured).toBe(0);
    });
  });

  describe("buildPolicyCards", () => {
    test("builds cards with formatted values and labels", () => {
      const policies: PolicyForCoverage[] = [
        createPolicy({
          id: 1,
          productName: "意外险",
          category: "Accident",
          sumAssured: 1000000,
          premium: 299,
          insurerName: "平安保险",
          insurerPhone: "95511",
          status: "Active",
        }),
      ];

      const cards = buildPolicyCards(policies);

      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({
        id: 1,
        productName: "意外险",
        category: "Accident",
        categoryLabel: "意外险",
        sumAssuredFormatted: "100万",
        premiumFormatted: "¥299",
        insurerName: "平安保险",
        insurerPhone: "95511",
        statusLabel: "生效中",
        isActive: true,
      });
    });
  });

  describe("groupPoliciesByCategory", () => {
    test("groups policies by category in defined order", () => {
      const policies = buildPolicyCards([
        createPolicy({ id: 1, category: "Life", sumAssured: 500000 }),
        createPolicy({ id: 2, category: "Accident", sumAssured: 1000000 }),
        createPolicy({ id: 3, category: "Medical", sumAssured: 2000000 }),
        createPolicy({ id: 4, category: "Accident", sumAssured: 500000 }),
      ]);

      const groups = groupPoliciesByCategory(policies);

      // Should be ordered: Accident, Medical, Life (per CATEGORY_ORDER)
      expect(groups).toHaveLength(3);
      expect(groups[0]?.category).toBe("Accident");
      expect(groups[0]?.count).toBe(2);
      expect(groups[0]?.totalSumAssured).toBe(1500000);
      expect(groups[1]?.category).toBe("Medical");
      expect(groups[2]?.category).toBe("Life");
    });

    test("excludes categories with no policies", () => {
      const policies = buildPolicyCards([
        createPolicy({ id: 1, category: "Life", sumAssured: 500000 }),
      ]);

      const groups = groupPoliciesByCategory(policies);

      expect(groups).toHaveLength(1);
      expect(groups[0]?.category).toBe("Life");
    });
  });

  describe("buildMemberCoverageData", () => {
    const assets: AssetForCoverage[] = [];
    const policiesByAsset = new Map<number, PolicyForCoverage[]>();

    test("selects first member by default", () => {
      const members: MemberForCoverage[] = [
        { id: 1, name: "张三", relation: "Self", gender: "M" },
        { id: 2, name: "李四", relation: "Spouse", gender: "F" },
      ];
      const policiesByMember = new Map<number, PolicyForCoverage[]>([
        [1, [createPolicy({ id: 1, category: "Accident" })]],
        [2, [createPolicy({ id: 2, category: "Life" })]],
      ]);

      const data = buildMemberCoverageData(members, assets, policiesByMember, policiesByAsset);

      expect(data.selectedMember?.id).toBe(1);
      expect(data.categoryGroups).toHaveLength(1);
      expect(data.categoryGroups[0]?.category).toBe("Accident");
    });

    test("selects specified member", () => {
      const members: MemberForCoverage[] = [
        { id: 1, name: "张三", relation: "Self", gender: "M" },
        { id: 2, name: "李四", relation: "Spouse", gender: "F" },
      ];
      const policiesByMember = new Map<number, PolicyForCoverage[]>([
        [1, [createPolicy({ id: 1, category: "Accident" })]],
        [2, [createPolicy({ id: 2, category: "Life" })]],
      ]);

      const data = buildMemberCoverageData(members, assets, policiesByMember, policiesByAsset, 2);

      expect(data.selectedMember?.id).toBe(2);
      expect(data.categoryGroups).toHaveLength(1);
      expect(data.categoryGroups[0]?.category).toBe("Life");
    });
  });

  describe("buildAssetCards", () => {
    const assets: AssetForCoverage[] = [
      { id: 1, name: "我的汽车", type: "Vehicle", identifier: "沪A12345" },
      { id: 2, name: "我的房子", type: "RealEstate", identifier: "上海市浦东新区" },
    ];

    test("builds cards with policy counts and totals", () => {
      const policiesByAsset = new Map<number, PolicyForCoverage[]>([
        [1, [
          createPolicy({ id: 1, sumAssured: 500000, status: "Active", category: "Property" }),
        ]],
        [2, [
          createPolicy({ id: 2, sumAssured: 1000000, status: "Lapsed", category: "Property" }),
        ]],
      ]);

      const cards = buildAssetCards(assets, policiesByAsset);

      expect(cards).toHaveLength(2);
      expect(cards[0]).toEqual({
        id: 1,
        name: "我的汽车",
        type: "Vehicle",
        typeLabel: "车辆",
        identifier: "沪A12345",
        activePolicyCount: 1,
        totalSumAssured: 500000,
      });
      expect(cards[1]).toEqual({
        id: 2,
        name: "我的房子",
        type: "RealEstate",
        typeLabel: "房产",
        identifier: "上海市浦东新区",
        activePolicyCount: 0, // Lapsed policy not counted
        totalSumAssured: 0,
      });
    });
  });

  describe("buildAssetCoverageData", () => {
    const members: MemberForCoverage[] = [];
    const policiesByMember = new Map<number, PolicyForCoverage[]>();

    test("selects first asset by default", () => {
      const assets: AssetForCoverage[] = [
        { id: 1, name: "我的汽车", type: "Vehicle", identifier: "沪A12345" },
        { id: 2, name: "我的房子", type: "RealEstate", identifier: "上海市浦东新区" },
      ];
      const policiesByAsset = new Map<number, PolicyForCoverage[]>([
        [1, [createPolicy({ id: 1, category: "Property" })]],
        [2, [createPolicy({ id: 2, category: "Property" })]],
      ]);

      const data = buildAssetCoverageData(members, assets, policiesByMember, policiesByAsset);

      expect(data.selectedAsset?.id).toBe(1);
      expect(data.selectionType).toBe("asset");
    });

    test("selects specified asset", () => {
      const assets: AssetForCoverage[] = [
        { id: 1, name: "我的汽车", type: "Vehicle", identifier: "沪A12345" },
        { id: 2, name: "我的房子", type: "RealEstate", identifier: "上海市浦东新区" },
      ];
      const policiesByAsset = new Map<number, PolicyForCoverage[]>([
        [1, [createPolicy({ id: 1, category: "Property" })]],
        [2, [createPolicy({ id: 2, category: "Property" })]],
      ]);

      const data = buildAssetCoverageData(members, assets, policiesByMember, policiesByAsset, 2);

      expect(data.selectedAsset?.id).toBe(2);
    });
  });

  describe("constants", () => {
    test("RELATION_LABELS covers all relations", () => {
      expect(RELATION_LABELS.Self).toBe("本人");
      expect(RELATION_LABELS.Spouse).toBe("配偶");
      expect(RELATION_LABELS.Child).toBe("子女");
      expect(RELATION_LABELS.Parent).toBe("父母");
    });

    test("STATUS_LABELS covers all statuses", () => {
      expect(STATUS_LABELS.Active).toBe("生效中");
      expect(STATUS_LABELS.Lapsed).toBe("已失效");
      expect(STATUS_LABELS.Surrendered).toBe("已退保");
      expect(STATUS_LABELS.Claimed).toBe("已理赔");
    });

    test("ASSET_TYPE_LABELS covers all asset types", () => {
      expect(ASSET_TYPE_LABELS.RealEstate).toBe("房产");
      expect(ASSET_TYPE_LABELS.Vehicle).toBe("车辆");
    });

    test("CATEGORY_ORDER starts with Accident for emergency focus", () => {
      expect(CATEGORY_ORDER[0]).toBe("Accident");
    });
  });

  describe("fetchCoverageLookupData", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    test("fetches with default member type", async () => {
      const mockData = { selectionType: "member" };
      const mockFn = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockData), { status: 200 }))
      );
      globalThis.fetch = Object.assign(mockFn, { preconnect: originalFetch.preconnect });

      const result = await fetchCoverageLookupData();
      expect(result).toMatchObject(mockData);
      expect(mockFn).toHaveBeenCalledWith("/api/coverage-lookup?type=member");
    });

    test("fetches with asset type and id", async () => {
      const mockData = { selectionType: "asset" };
      const mockFn = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockData), { status: 200 }))
      );
      globalThis.fetch = Object.assign(mockFn, { preconnect: originalFetch.preconnect });

      const result = await fetchCoverageLookupData("asset", 5);
      expect(result).toMatchObject(mockData);
      expect(mockFn).toHaveBeenCalledWith("/api/coverage-lookup?type=asset&id=5");
    });

    test("throws on non-ok response", async () => {
      const mockFn = mock(() =>
        Promise.resolve(new Response("Not Found", { status: 404 }))
      );
      globalThis.fetch = Object.assign(mockFn, { preconnect: originalFetch.preconnect });

      expect(fetchCoverageLookupData()).rejects.toThrow("Failed to fetch coverage data: 404");
    });
  });
});

// Helper to create test policies
function createPolicy(
  overrides: Partial<PolicyForCoverage> = {}
): PolicyForCoverage {
  return {
    id: 1,
    productName: "测试保险",
    category: "Accident",
    subCategory: null,
    sumAssured: 500000,
    premium: 1000,
    insurerName: "测试保险公司",
    insurerPhone: null,
    effectiveDate: "2024-01-01",
    expiryDate: null,
    status: "Active",
    ...overrides,
  };
}
