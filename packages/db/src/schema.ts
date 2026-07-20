import { index, integer, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// ============================================================================
// 1. members - 家庭成员
// ============================================================================
export const members = sqliteTable("members", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	relation: text("relation", {
		enum: ["Self", "Spouse", "Child", "Parent", "Pet"],
	}).notNull(),
	gender: text("gender", { enum: ["M", "F"] }),
	birthDate: text("birth_date"),
	idCard: text("id_card"),
	idType: text("id_type"), // 证件类型: 身份证/户口本/护照
	idExpiry: text("id_expiry"), // 证件有效期, e.g. "2021-10-05|2041-10-05"
	phone: text("phone"),
	hasSocialInsurance: integer("has_social_insurance", { mode: "boolean" }), // 是否有社保/医保
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
export const policies = sqliteTable(
	"policies",
	{
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
			enum: ["Life", "WholeLife", "CriticalIllness", "Medical", "Accident", "Annuity", "Property"],
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
		guaranteedRenewalYears: integer("guaranteed_renewal_years"), // 保证续保期间（年）

		// 状态
		status: text("status", {
			enum: ["Active", "Lapsed", "Surrendered", "Claimed"],
		})
			.notNull()
			.default("Active"),
		terminatedAt: text("terminated_at"),
		terminationReason: text("termination_reason"),
		plannedSurrenderAt: text("planned_surrender_at"),
		plannedSurrenderNote: text("planned_surrender_note"),
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
	},
	(table) => ({
		// Performance indexes on foreign keys
		insurerIdx: index("idx_policies_insurer_id").on(table.insurerId),
		insuredMemberIdx: index("idx_policies_insured_member_id").on(table.insuredMemberId),
		insuredAssetIdx: index("idx_policies_insured_asset_id").on(table.insuredAssetId),
	}),
);

export type Policy = typeof policies.$inferSelect;
export type NewPolicy = typeof policies.$inferInsert;

// ============================================================================
// 5. beneficiaries - 受益人
// ============================================================================
export const beneficiaries = sqliteTable(
	"beneficiaries",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		policyId: integer("policy_id")
			.notNull()
			.references(() => policies.id),
		memberId: integer("member_id").references(() => members.id),
		externalName: text("external_name"),
		externalIdCard: text("external_id_card"),
		sharePercent: real("share_percent").notNull(),
		rankOrder: integer("rank_order").notNull(),
	},
	(table) => ({
		// Performance index on foreign key
		policyIdx: index("idx_beneficiaries_policy_id").on(table.policyId),
	}),
);

export type Beneficiary = typeof beneficiaries.$inferSelect;
export type NewBeneficiary = typeof beneficiaries.$inferInsert;

// ============================================================================
// 6. payments - 缴费记录
// ============================================================================
export const payments = sqliteTable(
	"payments",
	{
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
	},
	(table) => ({
		// Ensure no duplicate period numbers per policy
		uniquePolicyPeriod: unique("unique_policy_period").on(table.policyId, table.periodNumber),
		// Performance index on foreign key
		policyIdx: index("idx_payments_policy_id").on(table.policyId),
	}),
);

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
// 8. coverageItems - 保障权益明细
// ============================================================================
export const coverageItems = sqliteTable(
	"coverage_items",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		policyId: integer("policy_id")
			.notNull()
			.references(() => policies.id),
		name: text("name").notNull(), // 保障项名称, e.g. "一般医疗保险金"
		periodLimit: real("period_limit"), // 保险期间内赔付限额（元）
		lifetimeLimit: real("lifetime_limit"), // 保证续保期间内赔付限额（元）
		deductible: real("deductible"), // 免赔额
		coveragePercent: real("coverage_percent"), // 赔付比例, e.g. 100
		isOptional: integer("is_optional", { mode: "boolean" }).default(false),
		notes: text("notes"),
		sortOrder: integer("sort_order").notNull().default(0),
	},
	(table) => ({
		// Performance index on foreign key
		policyIdx: index("idx_coverage_items_policy_id").on(table.policyId),
	}),
);

export type CoverageItem = typeof coverageItems.$inferSelect;
export type NewCoverageItem = typeof coverageItems.$inferInsert;

// ============================================================================
// 9. attachments - 保单附件 (PDF files stored in R2)
// ============================================================================
export const attachments = sqliteTable(
	"attachments",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		policyId: integer("policy_id")
			.notNull()
			.references(() => policies.id),
		filename: text("filename").notNull(), // original filename: "某某保单.pdf"
		r2Key: text("r2_key").notNull().unique(), // R2 object key: "policies/42/uuid.pdf"
		contentType: text("content_type").notNull(), // MIME type: "application/pdf"
		size: integer("size").notNull(), // file size in bytes
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => ({
		// Performance index on foreign key
		policyIdx: index("idx_attachments_policy_id").on(table.policyId),
	}),
);

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;

// ============================================================================
// 10. settings - 全局设置
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

// ============================================================================
// 11. hospitals - 医院
// ============================================================================
export const hospitals = sqliteTable("hospitals", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	level: text("level", {
		enum: ["三甲", "三乙", "二甲", "二乙", "一级", "社区", "诊所", "未评级"],
	}),
	isPublic: integer("is_public", { mode: "boolean" }).default(true),
	address: text("address"),
	phone: text("phone"),
	notes: text("notes"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export type Hospital = typeof hospitals.$inferSelect;
export type NewHospital = typeof hospitals.$inferInsert;

// ============================================================================
// 12. doctors - 医生
// ============================================================================
export const doctors = sqliteTable("doctors", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	hospitalId: integer("hospital_id")
		.notNull()
		.references(() => hospitals.id),
	department: text("department").notNull(),
	title: text("title", {
		enum: ["主任医师", "副主任医师", "主治医师", "住院医师", "其他"],
	}),
	specialty: text("specialty"),
	phone: text("phone"),
	notes: text("notes"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export type Doctor = typeof doctors.$inferSelect;
export type NewDoctor = typeof doctors.$inferInsert;

// ============================================================================
// 13. medicalVisits - 就诊记录
// ============================================================================
export const medicalVisits = sqliteTable(
	"medical_visits",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		memberId: integer("member_id")
			.notNull()
			.references(() => members.id),
		hospitalId: integer("hospital_id")
			.notNull()
			.references(() => hospitals.id),
		doctorId: integer("doctor_id").references(() => doctors.id),
		visitDate: text("visit_date").notNull(),
		visitTimeStart: text("visit_time_start"),
		visitTimeEnd: text("visit_time_end"),
		visitType: text("visit_type", {
			enum: ["儿保", "门诊", "急诊", "体检", "复查", "预约"],
		}).notNull(),
		visitReason: text("visit_reason").notNull(),
		department: text("department"),
		symptoms: text("symptoms"), // JSON array: ["便血", "喂养"]
		diagnosis: text("diagnosis"),
		treatment: text("treatment"),
		totalCost: real("total_cost"),
		insurancePaid: real("insurance_paid"),
		selfPaid: real("self_paid"),
		notes: text("notes"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => ({
		// Performance indexes on foreign keys
		memberIdx: index("idx_medical_visits_member_id").on(table.memberId),
		hospitalIdx: index("idx_medical_visits_hospital_id").on(table.hospitalId),
		doctorIdx: index("idx_medical_visits_doctor_id").on(table.doctorId),
	}),
);

export type MedicalVisit = typeof medicalVisits.$inferSelect;
export type NewMedicalVisit = typeof medicalVisits.$inferInsert;

// ============================================================================
// 14. apiTokens - CLI / 程序化访问的 API tokens
// ============================================================================
export const apiTokens = sqliteTable(
	"api_tokens",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		token: text("token").notNull().unique(), // SHA-256 hash of raw token
		tokenPrefix: text("token_prefix").notNull(), // first 8 chars of raw token, for display
		email: text("email").notNull(),
		name: text("name").default("CLI"), // human-readable description
		createdAt: text("created_at").notNull(),
		lastUsedAt: text("last_used_at"),
		expiresAt: text("expires_at"), // null = no expiry
	},
	(table) => ({
		emailIdx: index("idx_api_tokens_email").on(table.email),
	}),
);

export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
