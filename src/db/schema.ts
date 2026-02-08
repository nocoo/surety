import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ============================================================================
// 1. members - 家庭成员
// ============================================================================
export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  relation: text("relation", {
    enum: ["Self", "Spouse", "Child", "Parent"],
  }).notNull(),
  gender: text("gender", { enum: ["M", "F"] }),
  birthDate: text("birth_date"),
  idCard: text("id_card"),
  phone: text("phone"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;

// ============================================================================
// 2. insurers - 保险公司
// ============================================================================
export const insurers = sqliteTable("insurers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  phone: text("phone"),
  website: text("website"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Insurer = typeof insurers.$inferSelect;
export type NewInsurer = typeof insurers.$inferInsert;

// ============================================================================
// 3. assets - 财产（仅财产险标的）
// ============================================================================
export const assets = sqliteTable("assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["RealEstate", "Vehicle"] }).notNull(),
  name: text("name").notNull(),
  identifier: text("identifier").notNull(),
  ownerId: integer("owner_id").references(() => members.id),
  details: text("details"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;

// ============================================================================
// 4. policies - 保单
// ============================================================================
export const policies = sqliteTable("policies", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  // 角色关联
  applicantId: integer("applicant_id")
    .notNull()
    .references(() => members.id),
  insuredType: text("insured_type", { enum: ["Member", "Asset"] }).notNull(),
  insuredMemberId: integer("insured_member_id").references(() => members.id),
  insuredAssetId: integer("insured_asset_id").references(() => assets.id),

  // 产品信息
  category: text("category", {
    enum: [
      "Life",
      "CriticalIllness",
      "Medical",
      "Accident",
      "Annuity",
      "Property",
    ],
  }).notNull(),
  subCategory: text("sub_category"), // 子类别: 综合意外险、百万医疗险等
  insurerId: integer("insurer_id").references(() => insurers.id),
  insurerName: text("insurer_name").notNull(), // 冗余字段，便于查询展示
  productName: text("product_name").notNull(),
  policyNumber: text("policy_number").notNull().unique(),
  channel: text("channel"), // 渠道: 关哥说险、支付宝等

  // 保障信息
  sumAssured: real("sum_assured").notNull(),

  // 缴费信息
  premium: real("premium").notNull(),
  paymentFrequency: text("payment_frequency", {
    enum: ["Single", "Monthly", "Yearly"],
  }).notNull(),
  paymentYears: integer("payment_years"),
  totalPayments: integer("total_payments"),
  renewalType: text("renewal_type", { enum: ["Manual", "Auto", "Yearly"] }),
  paymentAccount: text("payment_account"),
  nextDueDate: text("next_due_date"),

  // 时间维度
  effectiveDate: text("effective_date").notNull(),
  expiryDate: text("expiry_date"),
  hesitationEndDate: text("hesitation_end_date"),
  waitingDays: integer("waiting_days"),

  // 状态
  status: text("status", {
    enum: ["Active", "Lapsed", "Surrendered", "Claimed"],
  })
    .notNull()
    .default("Active"),
  deathBenefit: text("death_benefit"),
  archived: integer("archived", { mode: "boolean" }).default(false),

  // 附加
  policyFilePath: text("policy_file_path"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Policy = typeof policies.$inferSelect;
export type NewPolicy = typeof policies.$inferInsert;

// ============================================================================
// 5. beneficiaries - 受益人
// ============================================================================
export const beneficiaries = sqliteTable("beneficiaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  policyId: integer("policy_id")
    .notNull()
    .references(() => policies.id),
  memberId: integer("member_id").references(() => members.id),
  externalName: text("external_name"),
  externalIdCard: text("external_id_card"),
  sharePercent: real("share_percent").notNull(),
  rankOrder: integer("rank_order").notNull(),
});

export type Beneficiary = typeof beneficiaries.$inferSelect;
export type NewBeneficiary = typeof beneficiaries.$inferInsert;

// ============================================================================
// 6. payments - 缴费记录
// ============================================================================
export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  policyId: integer("policy_id")
    .notNull()
    .references(() => policies.id),
  periodNumber: integer("period_number").notNull(),
  dueDate: text("due_date").notNull(),
  amount: real("amount").notNull(),
  status: text("status", { enum: ["Pending", "Paid", "Overdue"] })
    .notNull()
    .default("Pending"),
  paidDate: text("paid_date"),
  paidAmount: real("paid_amount"),
});

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

// ============================================================================
// 7. cashValues - 现金价值
// ============================================================================
export const cashValues = sqliteTable("cash_values", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  policyId: integer("policy_id")
    .notNull()
    .references(() => policies.id),
  policyYear: integer("policy_year").notNull(),
  value: real("value").notNull(),
});

export type CashValue = typeof cashValues.$inferSelect;
export type NewCashValue = typeof cashValues.$inferInsert;

// ============================================================================
// 8. policyExtensions - 险种特有字段
// ============================================================================
export const policyExtensions = sqliteTable("policy_extensions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  policyId: integer("policy_id")
    .notNull()
    .unique()
    .references(() => policies.id),
  data: text("data").notNull(),
});

export type PolicyExtension = typeof policyExtensions.$inferSelect;
export type NewPolicyExtension = typeof policyExtensions.$inferInsert;

// ============================================================================
// 9. settings - 全局设置
// ============================================================================
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
