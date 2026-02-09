import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface MemberCard {
  id: number;
  name: string;
  relation: string;
  relationLabel: string;
  gender: string | null;
  activePolicyCount: number;
  totalSumAssured: number;
}

interface AssetCard {
  id: number;
  name: string;
  type: string;
  typeLabel: string;
  identifier: string;
  activePolicyCount: number;
  totalSumAssured: number;
}

interface PolicyCard {
  id: number;
  productName: string;
  category: string;
  categoryLabel: string;
  categoryVariant: string;
  subCategory: string | null;
  sumAssured: number;
  sumAssuredFormatted: string;
  premium: number;
  premiumFormatted: string;
  insurerName: string;
  insurerPhone: string | null;
  effectiveDate: string;
  expiryDate: string | null;
  status: string;
  statusLabel: string;
  isActive: boolean;
}

interface CategoryGroup {
  category: string;
  categoryLabel: string;
  categoryVariant: string;
  policies: PolicyCard[];
  totalSumAssured: number;
  count: number;
}

interface CoverageLookupData {
  members: MemberCard[];
  assets: AssetCard[];
  selectionType: "member" | "asset";
  selectedMember: MemberCard | null;
  selectedAsset: AssetCard | null;
  categoryGroups: CategoryGroup[];
}

describe("Coverage Lookup API E2E", () => {
  beforeAll(async () => {
    await setupE2E();
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  });

  describe("GET /api/coverage-lookup (member mode)", () => {
    test("returns coverage data with default member type", async () => {
      const { status, data } = await apiRequest<CoverageLookupData>(
        "/api/coverage-lookup"
      );

      expect(status).toBe(200);
      expect(data.members).toBeDefined();
      expect(Array.isArray(data.members)).toBe(true);
      expect(data.selectionType).toBe("member");
    });

    test("returns correct structure for member type", async () => {
      const { status, data } = await apiRequest<CoverageLookupData>(
        "/api/coverage-lookup?type=member"
      );

      expect(status).toBe(200);
      expect(data.members).toBeDefined();
      expect(data.assets).toBeDefined();
      expect(data.categoryGroups).toBeDefined();
      expect(Array.isArray(data.categoryGroups)).toBe(true);
    });

    test("members have correct structure", async () => {
      const { data } = await apiRequest<CoverageLookupData>(
        "/api/coverage-lookup?type=member"
      );

      if (data.members.length > 0) {
        const member = data.members[0]!;
        expect(typeof member.id).toBe("number");
        expect(typeof member.name).toBe("string");
        expect(typeof member.relation).toBe("string");
        expect(typeof member.relationLabel).toBe("string");
        expect(typeof member.activePolicyCount).toBe("number");
        expect(typeof member.totalSumAssured).toBe("number");
      }
    });

    test("can select specific member by id", async () => {
      // First get all members
      const { data: initial } = await apiRequest<CoverageLookupData>(
        "/api/coverage-lookup?type=member"
      );

      if (initial.members.length > 0) {
        const memberId = initial.members[0]!.id;
        const { status, data } = await apiRequest<CoverageLookupData>(
          `/api/coverage-lookup?type=member&id=${memberId}`
        );

        expect(status).toBe(200);
        expect(data.selectedMember).toBeDefined();
        expect(data.selectedMember?.id).toBe(memberId);
      }
    });

    test("categoryGroups has correct structure", async () => {
      const { data } = await apiRequest<CoverageLookupData>(
        "/api/coverage-lookup?type=member"
      );

      expect(Array.isArray(data.categoryGroups)).toBe(true);
      if (data.categoryGroups.length > 0) {
        const group = data.categoryGroups[0]!;
        expect(typeof group.category).toBe("string");
        expect(typeof group.categoryLabel).toBe("string");
        expect(typeof group.categoryVariant).toBe("string");
        expect(Array.isArray(group.policies)).toBe(true);
        expect(typeof group.totalSumAssured).toBe("number");
        expect(typeof group.count).toBe("number");
      }
    });
  });

  describe("GET /api/coverage-lookup (asset mode)", () => {
    test("returns coverage data for asset type", async () => {
      const { status, data } = await apiRequest<CoverageLookupData>(
        "/api/coverage-lookup?type=asset"
      );

      expect(status).toBe(200);
      expect(data.assets).toBeDefined();
      expect(Array.isArray(data.assets)).toBe(true);
      expect(data.selectionType).toBe("asset");
    });

    test("assets have correct structure", async () => {
      const { data } = await apiRequest<CoverageLookupData>(
        "/api/coverage-lookup?type=asset"
      );

      if (data.assets.length > 0) {
        const asset = data.assets[0]!;
        expect(typeof asset.id).toBe("number");
        expect(typeof asset.name).toBe("string");
        expect(typeof asset.type).toBe("string");
        expect(typeof asset.typeLabel).toBe("string");
        expect(typeof asset.identifier).toBe("string");
        expect(typeof asset.activePolicyCount).toBe("number");
        expect(typeof asset.totalSumAssured).toBe("number");
      }
    });

    test("can select specific asset by id", async () => {
      // First get all assets
      const { data: initial } = await apiRequest<CoverageLookupData>(
        "/api/coverage-lookup?type=asset"
      );

      if (initial.assets.length > 0) {
        const assetId = initial.assets[0]!.id;
        const { status, data } = await apiRequest<CoverageLookupData>(
          `/api/coverage-lookup?type=asset&id=${assetId}`
        );

        expect(status).toBe(200);
        expect(data.selectedAsset).toBeDefined();
        expect(data.selectedAsset?.id).toBe(assetId);
      }
    });
  });

  describe("Policy data structure", () => {
    test("policies in category groups have correct structure", async () => {
      const { data } = await apiRequest<CoverageLookupData>(
        "/api/coverage-lookup?type=member"
      );

      if (data.categoryGroups.length > 0 && data.categoryGroups[0]!.policies.length > 0) {
        const policy = data.categoryGroups[0]!.policies[0]!;
        expect(typeof policy.id).toBe("number");
        expect(typeof policy.productName).toBe("string");
        expect(typeof policy.category).toBe("string");
        expect(typeof policy.categoryLabel).toBe("string");
        expect(typeof policy.sumAssured).toBe("number");
        expect(typeof policy.sumAssuredFormatted).toBe("string");
        expect(typeof policy.premium).toBe("number");
        expect(typeof policy.premiumFormatted).toBe("string");
        expect(typeof policy.insurerName).toBe("string");
        expect(typeof policy.effectiveDate).toBe("string");
        expect(typeof policy.status).toBe("string");
        expect(typeof policy.statusLabel).toBe("string");
        expect(typeof policy.isActive).toBe("boolean");
      }
    });
  });
});
