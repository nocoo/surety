import type { NewMember, NewAsset, NewPolicy, NewBeneficiary } from "./schema";
import type { AllRepos } from "./repositories";
import {
  membersRepo,
  assetsRepo,
  policiesRepo,
  beneficiariesRepo,
  paymentsRepo,
  cashValuesRepo,
  settingsRepo,
  insurersRepo,
} from "./repositories";

// ============================================================================
// Seed Data Definitions
// ============================================================================

export const familyMembers: NewMember[] = [
  { name: "张伟", relation: "Self", gender: "M", birthDate: "1986-03-15", idCard: "110101198603150011", phone: "13800138001" },
  { name: "李娜", relation: "Spouse", gender: "F", birthDate: "1988-07-22", idCard: "110101198807220022", phone: "13800138002" },
  { name: "张小明", relation: "Child", gender: "M", birthDate: "2018-11-08", idCard: "110101201811080033" },
  { name: "李建国", relation: "Parent", gender: "M", birthDate: "1958-05-01", idCard: "110101195805010044", phone: "13800138004" },
  { name: "王秀英", relation: "Parent", gender: "F", birthDate: "1960-09-12", idCard: "110101196009120055", phone: "13800138005" },
  { name: "张国强", relation: "Parent", gender: "M", birthDate: "1956-02-28", idCard: "110101195602280066", phone: "13800138006" },
  { name: "刘桂芳", relation: "Parent", gender: "F", birthDate: "1958-12-03", idCard: "110101195812030077", phone: "13800138007" },
];

export const familyAssets: (Omit<NewAsset, "ownerId"> & { ownerName: string })[] = [
  {
    type: "RealEstate",
    name: "朝阳区住宅",
    identifier: "京(2020)朝阳区不动产权第0012345号",
    ownerName: "张伟",
    details: JSON.stringify({ address: "北京市朝阳区建国路88号院1号楼1单元101", area: 120, purchaseYear: 2020, value: 8000000 }),
  },
  {
    type: "Vehicle",
    name: "特斯拉 Model Y",
    identifier: "京A88888",
    ownerName: "张伟",
    details: JSON.stringify({ brand: "Tesla", model: "Model Y Long Range", year: 2023, vin: "5YJ3E1EA8PF123456", value: 350000 }),
  },
  {
    type: "Vehicle",
    name: "大众帕萨特",
    identifier: "京B66666",
    ownerName: "李娜",
    details: JSON.stringify({ brand: "Volkswagen", model: "Passat", year: 2021, vin: "LSVNL4AA6CN123456", value: 180000 }),
  },
];

interface PolicySeed {
  policy: Omit<NewPolicy, "applicantId" | "insuredMemberId" | "insuredAssetId">;
  applicantName: string;
  insuredName?: string;
  insuredAssetIdentifier?: string;
  beneficiaries?: { memberName?: string; externalName?: string; sharePercent: number; rankOrder: number }[];
  cashValueYears?: number[];
}

export const policySeedData: PolicySeed[] = [
  {
    policy: {
      category: "Life",
      subCategory: "定期寿险",
      insuredType: "Member",
      insurerName: "中国人寿",
      productName: "国寿福终身寿险",
      policyNumber: "P2024010001",
      sumAssured: 1000000,
      premium: 12000,
      paymentFrequency: "Yearly",
      paymentYears: 20,
      totalPayments: 20,
      effectiveDate: "2024-01-15",
      hesitationEndDate: "2024-01-30",
      waitingDays: 180,
      status: "Active",
    },
    applicantName: "张伟",
    insuredName: "张伟",
    beneficiaries: [
      { memberName: "李娜", sharePercent: 60, rankOrder: 1 },
      { memberName: "张小明", sharePercent: 40, rankOrder: 1 },
    ],
    cashValueYears: [1, 2, 3, 4, 5],
  },
  {
    policy: {
      category: "CriticalIllness",
      insuredType: "Member",
      insurerName: "平安保险",
      productName: "平安福重疾险",
      policyNumber: "P2024010002",
      sumAssured: 500000,
      premium: 8500,
      paymentFrequency: "Yearly",
      paymentYears: 20,
      totalPayments: 20,
      effectiveDate: "2024-02-01",
      hesitationEndDate: "2024-02-16",
      waitingDays: 90,
      status: "Active",
    },
    applicantName: "张伟",
    insuredName: "李娜",
    beneficiaries: [{ memberName: "张伟", sharePercent: 100, rankOrder: 1 }],
  },
  {
    policy: {
      category: "Medical",
      insuredType: "Member",
      insurerName: "众安保险",
      productName: "尊享e生百万医疗险",
      policyNumber: "P2024010003",
      sumAssured: 6000000,
      premium: 1200,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2024-01-01",
      expiryDate: "2024-12-31",
      waitingDays: 30,
      status: "Active",
    },
    applicantName: "张伟",
    insuredName: "张小明",
  },
  {
    policy: {
      category: "Accident",
      insuredType: "Member",
      insurerName: "太平洋保险",
      productName: "安行宝综合意外险",
      policyNumber: "P2024010004",
      sumAssured: 1000000,
      premium: 360,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2024-03-01",
      expiryDate: "2025-02-28",
      status: "Active",
    },
    applicantName: "张伟",
    insuredName: "张伟",
  },
  {
    policy: {
      category: "Annuity",
      insuredType: "Member",
      insurerName: "泰康人寿",
      productName: "泰康鑫享人生年金险",
      policyNumber: "P2024010005",
      sumAssured: 500000,
      premium: 50000,
      paymentFrequency: "Yearly",
      paymentYears: 10,
      totalPayments: 10,
      effectiveDate: "2024-01-01",
      status: "Active",
    },
    applicantName: "张伟",
    insuredName: "张伟",
    cashValueYears: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    policy: {
      category: "Property",
      insuredType: "Asset",
      insurerName: "人保财险",
      productName: "家庭财产综合险",
      policyNumber: "P2024010006",
      sumAssured: 2000000,
      premium: 800,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2024-01-01",
      expiryDate: "2024-12-31",
      status: "Active",
    },
    applicantName: "张伟",
    insuredAssetIdentifier: "京(2020)朝阳区不动产权第0012345号",
  },
  {
    policy: {
      category: "Property",
      insuredType: "Asset",
      insurerName: "太平洋财险",
      productName: "机动车综合商业险",
      policyNumber: "P2024010007",
      sumAssured: 350000,
      premium: 6500,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2024-06-01",
      expiryDate: "2025-05-31",
      status: "Active",
    },
    applicantName: "张伟",
    insuredAssetIdentifier: "京A88888",
  },
  {
    policy: {
      category: "Medical",
      insuredType: "Member",
      insurerName: "泰康在线",
      productName: "微医保长期医疗险",
      policyNumber: "P2024010008",
      sumAssured: 2000000,
      premium: 2800,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2024-01-01",
      expiryDate: "2024-12-31",
      waitingDays: 30,
      status: "Active",
    },
    applicantName: "李娜",
    insuredName: "王秀英",
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

interface PaymentRecord {
  policyId: number;
  periodNumber: number;
  dueDate: string;
  amount: number;
  status: "Pending" | "Paid";
}

function generatePayments(policyId: number, policy: PolicySeed["policy"]): PaymentRecord[] {
  const records: PaymentRecord[] = [];
  const startDate = new Date(policy.effectiveDate);
  const totalPayments = policy.totalPayments ?? 1;

  for (let i = 0; i < totalPayments; i++) {
    const dueDate = new Date(startDate);
    if (policy.paymentFrequency === "Monthly") {
      dueDate.setMonth(dueDate.getMonth() + i);
    } else if (policy.paymentFrequency === "Yearly") {
      dueDate.setFullYear(dueDate.getFullYear() + i);
    }

    const dueDateStr = dueDate.toISOString().split("T")[0];
    records.push({
      policyId,
      periodNumber: i + 1,
      dueDate: dueDateStr ?? "",
      amount: policy.premium,
      status: i === 0 ? "Paid" : "Pending",
    });
  }

  return records;
}

// ============================================================================
// Seed Function (reusable)
// ============================================================================

export interface SeedResult {
  members: number;
  assets: number;
  policies: number;
}

/**
 * Seeds the database with test data.
 * Assumes the database is already initialized and empty.
 *
 * @param repos - Optional repos instance. When omitted, uses global singletons
 *                (backward compat). Scripts should pass createAllRepos(db) to
 *                avoid the global db Proxy.
 */
export async function seedDatabase(repos?: AllRepos): Promise<SeedResult> {
  const r = repos ?? {
    members: membersRepo,
    assets: assetsRepo,
    policies: policiesRepo,
    beneficiaries: beneficiariesRepo,
    payments: paymentsRepo,
    cashValues: cashValuesRepo,
    settings: settingsRepo,
    insurers: insurersRepo,
  };

  // Seed members
  const memberMap = new Map<string, number>();
  for (const member of familyMembers) {
    const created = await r.members.create(member);
    memberMap.set(member.name, created.id);
  }

  // Seed assets
  const assetMap = new Map<string, number>();
  for (const asset of familyAssets) {
    const ownerId = memberMap.get(asset.ownerName);
    const created = await r.assets.create({
      type: asset.type,
      name: asset.name,
      identifier: asset.identifier,
      ownerId,
      details: asset.details,
    });
    assetMap.set(asset.identifier, created.id);
  }

  // Seed insurers (extract unique insurer names from policies)
  const uniqueInsurers = [...new Set(policySeedData.map((s) => s.policy.insurerName))];
  for (const name of uniqueInsurers) {
    await r.insurers.findOrCreate(name);
  }

  // Seed policies with related data
  for (const seed of policySeedData) {
    const applicantId = memberMap.get(seed.applicantName);
    if (applicantId === undefined) {
      throw new Error(`Applicant "${seed.applicantName}" not found in memberMap`);
    }
    const insuredMemberId = seed.insuredName ? memberMap.get(seed.insuredName) : undefined;
    const insuredAssetId = seed.insuredAssetIdentifier ? assetMap.get(seed.insuredAssetIdentifier) : undefined;

    const policy = await r.policies.create({
      ...seed.policy,
      applicantId,
      insuredMemberId,
      insuredAssetId,
    });

    // Beneficiaries
    if (seed.beneficiaries) {
      for (const b of seed.beneficiaries) {
        const bene: NewBeneficiary = {
          policyId: policy.id,
          memberId: b.memberName ? memberMap.get(b.memberName) : undefined,
          externalName: b.externalName,
          sharePercent: b.sharePercent,
          rankOrder: b.rankOrder,
        };
        await r.beneficiaries.create(bene);
      }
    }

    // Payments
    const paymentRecords = generatePayments(policy.id, seed.policy);
    if (paymentRecords.length > 0) {
      await r.payments.createMany(paymentRecords);
    }

    // Cash values
    if (seed.cashValueYears) {
      const cvRecords = seed.cashValueYears.map((year, idx) => ({
        policyId: policy.id,
        policyYear: year,
        value: Math.round(seed.policy.premium * (idx + 1) * 0.3),
      }));
      await r.cashValues.createMany(cvRecords);
    }
  }

  // Seed settings
  await r.settings.set("annualIncome", "600000");
  await r.settings.setNumber("emergencyFundMonths", 6);
  await r.settings.setJson("riskTolerance", { level: "moderate", description: "Balanced growth" });

  return {
    members: familyMembers.length,
    assets: familyAssets.length,
    policies: policySeedData.length,
  };
}
