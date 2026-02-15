/**
 * Example database seed script
 * 
 * Creates realistic, anonymized demo data for the Surety application.
 * This data is designed to showcase real-world insurance scenarios:
 * - Adults: Full coverage (life, critical illness, medical, accident)
 * - Children: Limited coverage (medical, accident)
 * - Elderly: Primarily public welfare insurance (due to health restrictions)
 * - Pets: Pet medical insurance
 */

import type { NewMember, NewAsset, NewPolicy, NewBeneficiary, NewInsurer, NewCoverageItem } from "./schema";
import {
  membersRepo,
  assetsRepo,
  policiesRepo,
  beneficiariesRepo,
  paymentsRepo,
  cashValuesRepo,
  policyExtensionsRepo,
  coverageItemsRepo,
  settingsRepo,
  insurersRepo,
} from "./repositories";

// ============================================================================
// Insurance Companies (保险公司)
// ============================================================================

export const exampleInsurers: NewInsurer[] = [
  { name: "华贵人寿", phone: "400-900-0000", website: "https://www.hglife.com.cn" },
  { name: "信泰人寿", phone: "400-000-9999", website: "https://www.citic-prudential.com.cn" },
  { name: "众安保险", phone: "400-999-9595", website: "https://www.zhongan.com" },
  { name: "太平洋财险", phone: "95500", website: "https://www.cpic.com.cn" },
  { name: "平安财险", phone: "95511", website: "https://www.pingan.com" },
  { name: "上海医保局", phone: "12333", website: "https://ybj.sh.gov.cn" },
  { name: "人保财险", phone: "95518", website: "https://www.epicc.com.cn" },
  { name: "中国人寿", phone: "95519", website: "https://www.chinalife.com.cn" },
];

// ============================================================================
// Anonymized Family Members (示例家庭)
// ============================================================================

export const exampleMembers: NewMember[] = [
  // Core family
  { 
    name: "王明远", 
    relation: "Self", 
    gender: "M", 
    birthDate: "1984-06-15", 
    idCard: "310***********0011", 
    phone: "138****0001",
    idType: "身份证",
    hasSocialInsurance: true,
  },
  { 
    name: "陈思雨", 
    relation: "Spouse", 
    gender: "F", 
    birthDate: "1986-09-22", 
    idCard: "310***********0022", 
    phone: "138****0002",
    idType: "身份证",
    hasSocialInsurance: true,
  },
  { 
    name: "王小宇", 
    relation: "Child", 
    gender: "M", 
    birthDate: "2016-03-08", 
    idCard: "310***********0033",
    idType: "户口本",
    hasSocialInsurance: true,
  },
  { 
    name: "王小雪", 
    relation: "Child", 
    gender: "F", 
    birthDate: "2022-11-15", 
    idCard: "310***********0044",
    idType: "户口本",
    hasSocialInsurance: true,
  },
  // Paternal grandparents (王明远's parents)
  { 
    name: "王建国", 
    relation: "Parent", 
    gender: "M", 
    birthDate: "1955-04-01", 
    idCard: "310***********0055", 
    phone: "139****0003",
    idType: "身份证",
    hasSocialInsurance: true,
  },
  { 
    name: "李秀兰", 
    relation: "Parent", 
    gender: "F", 
    birthDate: "1957-08-12", 
    idCard: "310***********0066", 
    phone: "139****0004",
    idType: "身份证",
    hasSocialInsurance: true,
  },
  // Maternal grandparents (陈思雨's parents)
  { 
    name: "陈国华", 
    relation: "Parent", 
    gender: "M", 
    birthDate: "1958-12-28", 
    idCard: "320***********0077", 
    phone: "137****0005",
    idType: "身份证",
    hasSocialInsurance: true,
  },
  { 
    name: "张美玲", 
    relation: "Parent", 
    gender: "F", 
    birthDate: "1960-02-03", 
    idCard: "320***********0088", 
    phone: "137****0006",
    idType: "身份证",
    hasSocialInsurance: true,
  },
  // Pet
  { 
    name: "豆豆", 
    relation: "Pet", 
    gender: "M", 
    birthDate: "2021-05-01" 
  },
];

// ============================================================================
// Family Assets (资产配置)
// ============================================================================

export const exampleAssets: (Omit<NewAsset, "ownerId"> & { ownerName: string })[] = [
  // Real estate
  {
    type: "RealEstate",
    name: "浦东住宅",
    identifier: "沪(2018)浦东新区不动产权第0088888号",
    ownerName: "王明远",
    details: JSON.stringify({ 
      address: "上海市浦东新区世纪大道100号1栋501室", 
      area: 110, 
      purchaseYear: 2018, 
      value: 6500000 
    }),
  },
  // Vehicles
  {
    type: "Vehicle",
    name: "特斯拉 Model 3",
    identifier: "沪A12345",
    ownerName: "王明远",
    details: JSON.stringify({ 
      brand: "Tesla", 
      model: "Model 3 Performance", 
      year: 2023, 
      vin: "5YJ3E1***F123456", 
      value: 280000 
    }),
  },
  {
    type: "Vehicle",
    name: "丰田RAV4",
    identifier: "沪B67890",
    ownerName: "陈思雨",
    details: JSON.stringify({ 
      brand: "Toyota", 
      model: "RAV4 荣放", 
      year: 2022, 
      vin: "JTMRF***N123456", 
      value: 220000 
    }),
  },
];

// ============================================================================
// Insurance Policies (保险配置)
// ============================================================================

interface PolicySeed {
  policy: Omit<NewPolicy, "applicantId" | "insuredMemberId" | "insuredAssetId">;
  applicantName: string;
  insuredName?: string;
  insuredAssetIdentifier?: string;
  beneficiaries?: { memberName?: string; externalName?: string; sharePercent: number; rankOrder: number }[];
  extension?: Record<string, unknown>;
  cashValueYears?: number[];
  coverageItems?: Omit<NewCoverageItem, "policyId">[];
}

export const examplePolicies: PolicySeed[] = [
  // ============ 王明远 (户主, 38岁) - 核心劳动力，配置最全面 ============
  {
    policy: {
      category: "Life",
      subCategory: "定期寿险",
      insuredType: "Member",
      insurerName: "华贵人寿",
      productName: "大麦定期寿险2024",
      policyNumber: "DEMO-2026-001",
      channel: "互联网",
      sumAssured: 2000000, // 200万保额，覆盖房贷
      premium: 2860,
      paymentFrequency: "Yearly",
      paymentYears: 30,
      totalPayments: 30,
      effectiveDate: "2026-01-10",
      expiryDate: "2056-01-09",
      hesitationEndDate: "2026-01-25",
      waitingDays: 90,
      status: "Active",
    },
    applicantName: "王明远",
    insuredName: "王明远",
    beneficiaries: [
      { memberName: "陈思雨", sharePercent: 50, rankOrder: 1 },
      { memberName: "王小宇", sharePercent: 25, rankOrder: 1 },
      { memberName: "王小雪", sharePercent: 25, rankOrder: 1 },
    ],
    extension: { maxAge: 60, coverType: "Death" },
    cashValueYears: [1, 2, 3, 4, 5],
  },
  {
    policy: {
      category: "CriticalIllness",
      insuredType: "Member",
      insurerName: "信泰人寿",
      productName: "达尔文7号重疾险",
      policyNumber: "DEMO-2026-002",
      channel: "保险经纪",
      sumAssured: 500000,
      premium: 6800,
      paymentFrequency: "Yearly",
      paymentYears: 30,
      totalPayments: 30,
      effectiveDate: "2026-02-01",
      hesitationEndDate: "2026-02-16",
      waitingDays: 180,
      status: "Active",
    },
    applicantName: "王明远",
    insuredName: "王明远",
    beneficiaries: [{ memberName: "陈思雨", sharePercent: 100, rankOrder: 1 }],
    extension: { 
      criticalIllnesses: 110, 
      lightIllnesses: 50, 
      lightIllnessBenefit: 150000,
      cancerSecondPay: true 
    },
    cashValueYears: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    policy: {
      category: "Medical",
      insuredType: "Member",
      insurerName: "众安保险",
      productName: "尊享e生2024",
      policyNumber: "DEMO-2026-003",
      channel: "支付宝",
      sumAssured: 4000000,
      premium: 850,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2026-03-01",
      expiryDate: "2027-02-28",
      waitingDays: 30,
      status: "Active",
    },
    applicantName: "王明远",
    insuredName: "王明远",
    extension: { deductible: 10000, hospitalDailyBenefit: 0, outpatientCovered: false },
    coverageItems: [
      { name: "一般医疗保险金", periodLimit: 3000000, deductible: 10000, coveragePercent: 100, sortOrder: 1 },
      { name: "重疾医疗保险金", periodLimit: 4000000, deductible: 0, coveragePercent: 100, sortOrder: 2 },
      { name: "质子重离子医疗", periodLimit: 4000000, deductible: 0, coveragePercent: 100, sortOrder: 3 },
      { name: "院外特定药品", periodLimit: 4000000, deductible: 0, coveragePercent: 100, sortOrder: 4 },
      { name: "重疾住院津贴", periodLimit: 18000, deductible: 0, coveragePercent: 100, notes: "100元/天，限180天", sortOrder: 5, isOptional: true },
    ],
  },
  {
    policy: {
      category: "Accident",
      insuredType: "Member",
      insurerName: "太平洋财险",
      productName: "小蜜蜂2号综合意外险",
      policyNumber: "DEMO-2026-004",
      channel: "互联网",
      sumAssured: 1000000,
      premium: 298,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2026-01-01",
      expiryDate: "2026-12-31",
      status: "Active",
    },
    applicantName: "王明远",
    insuredName: "王明远",
    extension: { 
      accidentDeath: 1000000, 
      accidentDisability: 1000000, 
      accidentMedical: 50000,
      transportBonus: 500000
    },
  },

  // ============ 陈思雨 (配偶, 36岁) - 同样作为核心劳动力 ============
  {
    policy: {
      category: "Life",
      subCategory: "定期寿险",
      insuredType: "Member",
      insurerName: "华贵人寿",
      productName: "大麦定期寿险2024",
      policyNumber: "DEMO-2026-005",
      channel: "互联网",
      sumAssured: 1500000,
      premium: 1650,
      paymentFrequency: "Yearly",
      paymentYears: 30,
      totalPayments: 30,
      effectiveDate: "2026-01-10",
      expiryDate: "2056-01-09",
      hesitationEndDate: "2026-01-25",
      waitingDays: 90,
      status: "Active",
    },
    applicantName: "陈思雨",
    insuredName: "陈思雨",
    beneficiaries: [
      { memberName: "王明远", sharePercent: 50, rankOrder: 1 },
      { memberName: "王小宇", sharePercent: 25, rankOrder: 1 },
      { memberName: "王小雪", sharePercent: 25, rankOrder: 1 },
    ],
    extension: { maxAge: 60, coverType: "Death" },
  },
  {
    policy: {
      category: "CriticalIllness",
      insuredType: "Member",
      insurerName: "信泰人寿",
      productName: "达尔文7号重疾险",
      policyNumber: "DEMO-2026-006",
      channel: "保险经纪",
      sumAssured: 400000,
      premium: 5200,
      paymentFrequency: "Yearly",
      paymentYears: 30,
      totalPayments: 30,
      effectiveDate: "2026-02-01",
      hesitationEndDate: "2026-02-16",
      waitingDays: 180,
      status: "Active",
    },
    applicantName: "陈思雨",
    insuredName: "陈思雨",
    beneficiaries: [{ memberName: "王明远", sharePercent: 100, rankOrder: 1 }],
    extension: { 
      criticalIllnesses: 110, 
      lightIllnesses: 50, 
      lightIllnessBenefit: 120000 
    },
  },
  {
    policy: {
      category: "Medical",
      insuredType: "Member",
      insurerName: "众安保险",
      productName: "尊享e生2024",
      policyNumber: "DEMO-2026-007",
      channel: "支付宝",
      sumAssured: 4000000,
      premium: 650,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2026-03-01",
      expiryDate: "2027-02-28",
      waitingDays: 30,
      status: "Active",
    },
    applicantName: "陈思雨",
    insuredName: "陈思雨",
    extension: { deductible: 10000, maternityBenefit: true },
    coverageItems: [
      { name: "一般医疗保险金", periodLimit: 3000000, deductible: 10000, coveragePercent: 100, sortOrder: 1 },
      { name: "重疾医疗保险金", periodLimit: 4000000, deductible: 0, coveragePercent: 100, sortOrder: 2 },
      { name: "质子重离子医疗", periodLimit: 4000000, deductible: 0, coveragePercent: 100, sortOrder: 3 },
      { name: "院外特定药品", periodLimit: 4000000, deductible: 0, coveragePercent: 100, sortOrder: 4 },
    ],
  },

  // ============ 王小宇 (长子, 8岁) - 儿童配置：意外+医疗 ============
  {
    policy: {
      category: "Accident",
      insuredType: "Member",
      insurerName: "平安财险",
      productName: "小顽童少儿意外险",
      policyNumber: "DEMO-2026-008",
      channel: "互联网",
      sumAssured: 200000,
      premium: 68,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2026-09-01",
      expiryDate: "2027-08-31",
      status: "Active",
    },
    applicantName: "王明远",
    insuredName: "王小宇",
    extension: { 
      accidentDeath: 200000, 
      accidentMedical: 20000,
      vaccinationReaction: 5000
    },
  },
  {
    policy: {
      category: "Medical",
      insuredType: "Member",
      insurerName: "众安保险",
      productName: "尊享e生2024(少儿版)",
      policyNumber: "DEMO-2026-009",
      channel: "支付宝",
      sumAssured: 4000000,
      premium: 580,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2026-03-01",
      expiryDate: "2027-02-28",
      waitingDays: 30,
      status: "Active",
    },
    applicantName: "王明远",
    insuredName: "王小宇",
    extension: { deductible: 0, childSpecialDisease: true },
    coverageItems: [
      { name: "一般医疗保险金", periodLimit: 3000000, deductible: 0, coveragePercent: 100, notes: "少儿版0免赔", sortOrder: 1 },
      { name: "重疾医疗保险金", periodLimit: 4000000, deductible: 0, coveragePercent: 100, sortOrder: 2 },
      { name: "少儿特定疾病", periodLimit: 4000000, deductible: 0, coveragePercent: 100, sortOrder: 3 },
      { name: "质子重离子医疗", periodLimit: 4000000, deductible: 0, coveragePercent: 100, sortOrder: 4 },
    ],
  },

  // ============ 王小雪 (幼女, 2岁) - 新生儿：仅医疗险 ============
  // 问题体现：2岁幼童保险配置不足，缺少意外险
  {
    policy: {
      category: "Medical",
      insuredType: "Member",
      insurerName: "众安保险",
      productName: "尊享e生2024(少儿版)",
      policyNumber: "DEMO-2026-010",
      channel: "支付宝",
      sumAssured: 4000000,
      premium: 620,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2026-03-01",
      expiryDate: "2027-02-28",
      waitingDays: 30,
      status: "Active",
    },
    applicantName: "陈思雨",
    insuredName: "王小雪",
    extension: { deductible: 0, newbornJaundice: true },
    coverageItems: [
      { name: "一般医疗保险金", periodLimit: 3000000, deductible: 0, coveragePercent: 100, notes: "少儿版0免赔", sortOrder: 1 },
      { name: "重疾医疗保险金", periodLimit: 4000000, deductible: 0, coveragePercent: 100, sortOrder: 2 },
      { name: "少儿特定疾病", periodLimit: 4000000, deductible: 0, coveragePercent: 100, sortOrder: 3 },
      { name: "质子重离子医疗", periodLimit: 4000000, deductible: 0, coveragePercent: 100, sortOrder: 4 },
    ],
  },

  // ============ 老人 (4位) - 健康险难买，以普惠险/意外险为主 ============
  // 问题体现：老人缺乏重疾和定寿保障

  // 王建国 (爷爷, 69岁) - 有高血压，只能买普惠险
  {
    policy: {
      category: "Medical",
      subCategory: "普惠险",
      insuredType: "Member",
      insurerName: "上海医保局",
      productName: "沪惠保2024",
      policyNumber: "DEMO-2026-011",
      channel: "官方渠道",
      sumAssured: 3100000,
      premium: 129,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2026-07-01",
      expiryDate: "2027-06-30",
      status: "Active",
    },
    applicantName: "王明远",
    insuredName: "王建国",
    extension: { 
      deductible: 20000, 
      preExistingConditions: ["高血压", "糖尿病前期"],
      publicWelfare: true
    },
  },
  {
    policy: {
      category: "Accident",
      insuredType: "Member",
      insurerName: "太平洋财险",
      productName: "护身福老年意外险",
      policyNumber: "DEMO-2026-012",
      channel: "保险代理",
      sumAssured: 100000,
      premium: 180,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2026-01-01",
      expiryDate: "2026-12-31",
      status: "Active",
    },
    applicantName: "王明远",
    insuredName: "王建国",
    extension: { 
      accidentDeath: 100000, 
      accidentMedical: 10000,
      fractureBonus: 5000
    },
  },

  // 李秀兰 (奶奶, 67岁) - 普惠险+意外险
  {
    policy: {
      category: "Medical",
      subCategory: "普惠险",
      insuredType: "Member",
      insurerName: "上海医保局",
      productName: "沪惠保2024",
      policyNumber: "DEMO-2026-013",
      channel: "官方渠道",
      sumAssured: 3100000,
      premium: 129,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2026-07-01",
      expiryDate: "2027-06-30",
      status: "Active",
    },
    applicantName: "王明远",
    insuredName: "李秀兰",
    extension: { deductible: 20000, publicWelfare: true },
  },

  // 陈国华 (外公, 66岁) - 只有普惠险
  // 问题体现：缺少意外险
  {
    policy: {
      category: "Medical",
      subCategory: "普惠险",
      insuredType: "Member",
      insurerName: "上海医保局",
      productName: "沪惠保2024",
      policyNumber: "DEMO-2026-014",
      channel: "官方渠道",
      sumAssured: 3100000,
      premium: 129,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2026-07-01",
      expiryDate: "2027-06-30",
      status: "Active",
    },
    applicantName: "陈思雨",
    insuredName: "陈国华",
    extension: { deductible: 20000, publicWelfare: true },
  },

  // 张美玲 (外婆, 64岁) - 普惠险+意外险
  {
    policy: {
      category: "Medical",
      subCategory: "普惠险",
      insuredType: "Member",
      insurerName: "上海医保局",
      productName: "沪惠保2024",
      policyNumber: "DEMO-2026-015",
      channel: "官方渠道",
      sumAssured: 3100000,
      premium: 129,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2026-07-01",
      expiryDate: "2027-06-30",
      status: "Active",
    },
    applicantName: "陈思雨",
    insuredName: "张美玲",
    extension: { deductible: 20000, publicWelfare: true },
  },
  {
    policy: {
      category: "Accident",
      insuredType: "Member",
      insurerName: "太平洋财险",
      productName: "护身福老年意外险",
      policyNumber: "DEMO-2026-016",
      channel: "保险代理",
      sumAssured: 100000,
      premium: 150,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2026-01-01",
      expiryDate: "2026-12-31",
      status: "Active",
    },
    applicantName: "陈思雨",
    insuredName: "张美玲",
    extension: { 
      accidentDeath: 100000, 
      accidentMedical: 10000 
    },
  },

  // ============ 资产险 ============
  // 房产险
  {
    policy: {
      category: "Property",
      insuredType: "Asset",
      insurerName: "人保财险",
      productName: "家财险尊享版",
      policyNumber: "DEMO-2026-017",
      channel: "保险代理",
      sumAssured: 1000000,
      premium: 350,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2026-01-01",
      expiryDate: "2026-12-31",
      status: "Active",
    },
    applicantName: "王明远",
    insuredAssetIdentifier: "沪(2018)浦东新区不动产权第0088888号",
    extension: { 
      fireInsurance: 1000000, 
      theftInsurance: 200000, 
      waterDamage: 100000,
      thirdPartyLiability: 500000
    },
  },
  // 车险 - 特斯拉
  {
    policy: {
      category: "Property",
      subCategory: "车险",
      insuredType: "Asset",
      insurerName: "太平洋财险",
      productName: "机动车综合商业保险",
      policyNumber: "DEMO-2026-018",
      channel: "4S店",
      sumAssured: 280000,
      premium: 4500,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2026-06-01",
      expiryDate: "2027-05-31",
      status: "Active",
    },
    applicantName: "王明远",
    insuredAssetIdentifier: "沪A12345",
    extension: { 
      vehicleDamage: 280000, 
      thirdPartyLiability: 2000000, 
      driverSeat: 100000, 
      passengerSeat: 100000,
      scratchRepair: 5000
    },
  },
  // 车险 - RAV4
  {
    policy: {
      category: "Property",
      subCategory: "车险",
      insuredType: "Asset",
      insurerName: "平安财险",
      productName: "机动车综合商业保险",
      policyNumber: "DEMO-2026-019",
      channel: "互联网",
      sumAssured: 220000,
      premium: 3800,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2026-08-01",
      expiryDate: "2027-07-31",
      status: "Active",
    },
    applicantName: "陈思雨",
    insuredAssetIdentifier: "沪B67890",
    extension: { 
      vehicleDamage: 220000, 
      thirdPartyLiability: 1500000, 
      driverSeat: 50000, 
      passengerSeat: 50000
    },
  },

  // ============ 宠物险 - 豆豆 (作为家庭成员) ============
  {
    policy: {
      category: "Medical",
      subCategory: "宠物险",
      insuredType: "Member",
      insurerName: "众安保险",
      productName: "宠物医疗险",
      policyNumber: "DEMO-2026-020",
      channel: "支付宝",
      sumAssured: 20000,
      premium: 599,
      paymentFrequency: "Yearly",
      paymentYears: 1,
      totalPayments: 1,
      effectiveDate: "2026-05-01",
      expiryDate: "2027-04-30",
      status: "Active",
    },
    applicantName: "王明远",
    insuredName: "豆豆",
    extension: { 
      medicalCoverage: 20000, 
      deductible: 200,
      thirdPartyLiability: 10000,
      petType: "Dog"
    },
  },

  // ============ 年金险 (财务规划) ============
  {
    policy: {
      category: "Annuity",
      insuredType: "Member",
      insurerName: "中国人寿",
      productName: "国寿鑫享至尊年金险",
      policyNumber: "DEMO-2026-021",
      channel: "银行",
      sumAssured: 1000000,
      premium: 100000,
      paymentFrequency: "Yearly",
      paymentYears: 5,
      totalPayments: 5,
      effectiveDate: "2025-01-01",
      status: "Active",
    },
    applicantName: "王明远",
    insuredName: "王明远",
    beneficiaries: [
      { memberName: "陈思雨", sharePercent: 60, rankOrder: 1 },
      { memberName: "王小宇", sharePercent: 20, rankOrder: 1 },
      { memberName: "王小雪", sharePercent: 20, rankOrder: 1 },
    ],
    extension: { 
      annuityStartAge: 60, 
      annuityType: "Lifetime", 
      guaranteedYears: 20,
      bonusType: "增额终身寿"
    },
    cashValueYears: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
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

/**
 * Calculate the next due date for a policy based on effective date and frequency.
 * For demo purposes, we set next due date to be within the next 12 months.
 */
function calculateNextDueDate(
  effectiveDate: string,
  paymentFrequency: "Single" | "Monthly" | "Yearly",
  referenceDate: Date = new Date()
): string | null {
  if (paymentFrequency === "Single") {
    return null;
  }

  const effective = new Date(effectiveDate);
  const intervalMonths = paymentFrequency === "Monthly" ? 1 : 12;
  
  // Find the next due date after reference date
  const nextDue = new Date(effective);
  while (nextDue <= referenceDate) {
    const newMonth = nextDue.getMonth() + intervalMonths;
    nextDue.setMonth(newMonth);
  }
  
  return nextDue.toISOString().split("T")[0] ?? null;
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
    // Mark first payment as paid
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
// Seed Function
// ============================================================================

export interface SeedResult {
  members: number;
  assets: number;
  policies: number;
}

/**
 * Seeds the database with example demo data.
 * Assumes the database is already initialized and empty.
 */
export function seedExampleDatabase(): SeedResult {
  // Seed insurers first
  const insurerMap = new Map<string, number>();
  for (const insurer of exampleInsurers) {
    const created = insurersRepo.create(insurer);
    insurerMap.set(insurer.name, created.id);
  }

  // Seed members
  const memberMap = new Map<string, number>();
  for (const member of exampleMembers) {
    const created = membersRepo.create(member);
    memberMap.set(member.name, created.id);
  }

  // Seed assets
  const assetMap = new Map<string, number>();
  for (const asset of exampleAssets) {
    const ownerId = memberMap.get(asset.ownerName);
    const created = assetsRepo.create({
      type: asset.type,
      name: asset.name,
      identifier: asset.identifier,
      ownerId,
      details: asset.details,
    });
    assetMap.set(asset.identifier, created.id);
  }

  // Seed policies with related data
  // Use a fixed reference date for consistent demo data (Feb 9, 2026)
  const referenceDate = new Date("2026-02-09");
  
  for (const seed of examplePolicies) {
    const applicantId = memberMap.get(seed.applicantName)!;
    const insuredMemberId = seed.insuredName ? memberMap.get(seed.insuredName) : undefined;
    const insuredAssetId = seed.insuredAssetIdentifier ? assetMap.get(seed.insuredAssetIdentifier) : undefined;
    const insurerId = insurerMap.get(seed.policy.insurerName);
    
    // Calculate next due date based on effective date and frequency
    const nextDueDate = calculateNextDueDate(
      seed.policy.effectiveDate,
      seed.policy.paymentFrequency,
      referenceDate
    );

    const policy = policiesRepo.create({
      ...seed.policy,
      applicantId,
      insuredMemberId,
      insuredAssetId,
      insurerId,
      nextDueDate,
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
        beneficiariesRepo.create(bene);
      }
    }

    // Payments
    const paymentRecords = generatePayments(policy.id, seed.policy);
    if (paymentRecords.length > 0) {
      paymentsRepo.createMany(paymentRecords);
    }

    // Cash values (for life insurance and annuity)
    if (seed.cashValueYears) {
      const cvRecords = seed.cashValueYears.map((year, idx) => ({
        policyId: policy.id,
        policyYear: year,
        value: Math.round(seed.policy.premium * (idx + 1) * 0.4),
      }));
      cashValuesRepo.createMany(cvRecords);
    }

    // Extensions
    if (seed.extension) {
      policyExtensionsRepo.upsertByPolicyId(policy.id, seed.extension);
    }

    // Coverage items
    if (seed.coverageItems && seed.coverageItems.length > 0) {
      const items = seed.coverageItems.map((item) => ({
        ...item,
        policyId: policy.id,
      }));
      coverageItemsRepo.createMany(items);
    }
  }

  // Seed settings
  settingsRepo.set("annualIncome", "480000");
  settingsRepo.setNumber("emergencyFundMonths", 6);
  settingsRepo.setJson("riskTolerance", { level: "moderate", description: "稳健型投资偏好" });
  settingsRepo.set("familyLocation", "上海市浦东新区");

  return {
    members: exampleMembers.length,
    assets: exampleAssets.length,
    policies: examplePolicies.length,
  };
}
