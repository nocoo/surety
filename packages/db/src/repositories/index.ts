import type { DbInstance } from "../index";
import { createApiTokensRepo } from "./apiTokens";
import { createAssetsRepo } from "./assets";
import { createAttachmentsRepo } from "./attachments";
import { createBeneficiariesRepo } from "./beneficiaries";
import { createCashValuesRepo } from "./cashValues";
import { createCoverageItemsRepo } from "./coverageItems";
import { createDoctorsRepo } from "./doctors";
import { createHospitalsRepo } from "./hospitals";
import { createInsurersRepo } from "./insurers";
import { createMedicalVisitsRepo } from "./medicalVisits";
import { createMembersRepo } from "./members";
import { createPaymentsRepo } from "./payments";
import { createPoliciesRepo } from "./policies";
import { createSettingsRepo } from "./settings";

// ---------- Factory: create all repos from a db instance ----------

export function createAllRepos(db: DbInstance) {
	return {
		members: createMembersRepo(db),
		insurers: createInsurersRepo(db),
		assets: createAssetsRepo(db),
		policies: createPoliciesRepo(db),
		beneficiaries: createBeneficiariesRepo(db),
		payments: createPaymentsRepo(db),
		cashValues: createCashValuesRepo(db),
		coverageItems: createCoverageItemsRepo(db),
		settings: createSettingsRepo(db),
		attachments: createAttachmentsRepo(db),
		hospitals: createHospitalsRepo(db),
		doctors: createDoctorsRepo(db),
		medicalVisits: createMedicalVisitsRepo(db),
		apiTokens: createApiTokensRepo(db),
	};
}

export type AllRepos = ReturnType<typeof createAllRepos>;

// ---------- Backward-compatible global singletons ----------

export { type ApiTokensRepo, apiTokensRepo, createApiTokensRepo, hashToken } from "./apiTokens";
export { type AssetsRepo, assetsRepo, createAssetsRepo } from "./assets";
export { type AttachmentsRepo, attachmentsRepo, createAttachmentsRepo } from "./attachments";
export {
	type BeneficiariesRepo,
	beneficiariesRepo,
	createBeneficiariesRepo,
} from "./beneficiaries";
export { type CashValuesRepo, cashValuesRepo, createCashValuesRepo } from "./cashValues";
export {
	type CoverageItemsRepo,
	coverageItemsRepo,
	createCoverageItemsRepo,
} from "./coverageItems";
export { createDoctorsRepo, type DoctorsRepo, doctorsRepo } from "./doctors";
export { createHospitalsRepo, type HospitalsRepo, hospitalsRepo } from "./hospitals";
export { createInsurersRepo, type InsurersRepo, insurersRepo } from "./insurers";
export {
	createMedicalVisitsRepo,
	type MedicalVisitsRepo,
	medicalVisitsRepo,
} from "./medicalVisits";
export { createMembersRepo, type MembersRepo, membersRepo } from "./members";
export { createPaymentsRepo, type PaymentsRepo, paymentsRepo } from "./payments";
export { createPoliciesRepo, type PoliciesRepo, policiesRepo } from "./policies";
export { createSettingsRepo, type SettingsRepo, settingsRepo } from "./settings";
