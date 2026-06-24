import { describe, it, expect } from "vitest";
import {
  buildEmergencyContacts,
  buildCoverageClipboardText,
} from "@/app/coverage-lookup/emergency";
import type { CategoryGroup, PolicyCoverageCard } from "@surety/api/coverage-lookup";

function makePolicy(over: Partial<PolicyCoverageCard>): PolicyCoverageCard {
  return {
    id: 1,
    productName: "p",
    insurerName: "中国人寿",
    insurerPhone: "95519",
    category: "Life",
    categoryLabel: "定期寿",
    categoryVariant: "default",
    subCategory: null,
    sumAssured: 1_000_000,
    sumAssuredFormatted: "100万",
    premium: 5000,
    premiumFormatted: "¥5,000",
    effectiveDate: "2024-01-01",
    expiryDate: null,
    status: "Active",
    isActive: true,
    statusLabel: "生效中",
    ...over,
  };
}

function group(label: string, policies: PolicyCoverageCard[]): CategoryGroup {
  return {
    category: label as CategoryGroup["category"],
    categoryLabel: label,
    categoryVariant: "default",
    policies,
    totalSumAssured: policies.reduce((s, p) => s + p.sumAssured, 0),
    count: policies.length,
  };
}

describe("buildEmergencyContacts", () => {
  it("returns an empty list when no groups have policies", () => {
    expect(buildEmergencyContacts([])).toEqual([]);
  });

  it("dedupes by (insurer, phone) across all policies", () => {
    const g = group("定期寿", [
      makePolicy({ id: 1, insurerName: "中国人寿", insurerPhone: "95519" }),
      makePolicy({ id: 2, insurerName: "中国人寿", insurerPhone: "95519" }),
      makePolicy({ id: 3, insurerName: "平安", insurerPhone: "95511" }),
    ]);
    const result = buildEmergencyContacts([g]);
    expect(result).toHaveLength(2);
    // zh-CN pinyin: 平 (p) < 中 (zh)
    expect(result.map((c) => c.insurerName)).toEqual(["平安", "中国人寿"]);
  });

  it("skips inactive policies entirely", () => {
    const g = group("定期寿", [
      makePolicy({ id: 1, isActive: false }),
    ]);
    expect(buildEmergencyContacts([g])).toEqual([]);
  });

  it("skips missing/blank phones", () => {
    const g = group("定期寿", [
      makePolicy({ id: 1, insurerName: "A", insurerPhone: null }),
      makePolicy({ id: 2, insurerName: "B", insurerPhone: "   " }),
      makePolicy({ id: 3, insurerName: "C", insurerPhone: "95511" }),
    ]);
    const result = buildEmergencyContacts([g]);
    expect(result).toEqual([{ insurerName: "C", phone: "95511" }]);
  });

  it("sorts by insurer name (zh-CN)", () => {
    const g = group("定期寿", [
      makePolicy({ id: 1, insurerName: "平安", insurerPhone: "95511" }),
      makePolicy({ id: 2, insurerName: "中国人寿", insurerPhone: "95519" }),
      makePolicy({ id: 3, insurerName: "太平洋", insurerPhone: "95500" }),
    ]);
    const names = buildEmergencyContacts([g]).map((c) => c.insurerName);
    // zh-CN collation: 平 < 太 < 中
    expect(names).toEqual(["平安", "太平洋", "中国人寿"]);
  });
});

describe("buildCoverageClipboardText", () => {
  it("notes the subject and an empty marker when nothing active", () => {
    expect(buildCoverageClipboardText("张伟", [])).toContain("张伟");
    expect(buildCoverageClipboardText("张伟", [])).toContain("暂无生效保单");
  });

  it("groups by category and emits a grand total", () => {
    const groups: CategoryGroup[] = [
      group("定期寿", [
        makePolicy({ id: 1, productName: "终身寿", sumAssured: 1_000_000 }),
      ]),
      group("医疗险", [
        makePolicy({ id: 2, productName: "百万医疗", sumAssured: 5_000_000 }),
      ]),
    ];
    const text = buildCoverageClipboardText("张伟", groups);
    expect(text).toContain("【张伟 · 保障速查】");
    expect(text).toContain("▎定期寿");
    expect(text).toContain("终身寿");
    expect(text).toContain("百万医疗");
    expect(text).toContain("合计保额：¥6,000,000");
  });

  it("skips inactive policies", () => {
    const groups: CategoryGroup[] = [
      group("定期寿", [
        makePolicy({ id: 1, productName: "active", isActive: true }),
        makePolicy({ id: 2, productName: "lapsed", isActive: false }),
      ]),
    ];
    const text = buildCoverageClipboardText("张伟", groups);
    expect(text).toContain("active");
    expect(text).not.toContain("lapsed");
  });
});
