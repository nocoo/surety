import type { DbInstance } from "../index";
import { createMembersRepo } from "./members";
import { createInsurersRepo } from "./insurers";
import { createAssetsRepo } from "./assets";
import { createPoliciesRepo } from "./policies";
import { createBeneficiariesRepo } from "./beneficiaries";
import { createPaymentsRepo } from "./payments";
import { createCashValuesRepo } from "./cashValues";
import { createCoverageItemsRepo } from "./coverageItems";
import { createSettingsRepo } from "./settings";
import { createAttachmentsRepo } from "./attachments";
import { createHospitalsRepo } from "./hospitals";
import { createDoctorsRepo } from "./doctors";
import { createMedicalVisitsRepo } from "./medicalVisits";

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
  };
}

export type AllRepos = ReturnType<typeof createAllRepos>;

// ---------- Backward-compatible global singletons ----------

export { membersRepo, createMembersRepo, type MembersRepo } from "./members";
export { insurersRepo, createInsurersRepo, type InsurersRepo } from "./insurers";
export { assetsRepo, createAssetsRepo, type AssetsRepo } from "./assets";
export { policiesRepo, createPoliciesRepo, type PoliciesRepo } from "./policies";
export { beneficiariesRepo, createBeneficiariesRepo, type BeneficiariesRepo } from "./beneficiaries";
export { paymentsRepo, createPaymentsRepo, type PaymentsRepo } from "./payments";
export { cashValuesRepo, createCashValuesRepo, type CashValuesRepo } from "./cashValues";
export { coverageItemsRepo, createCoverageItemsRepo, type CoverageItemsRepo } from "./coverageItems";
export { settingsRepo, createSettingsRepo, type SettingsRepo } from "./settings";
export { attachmentsRepo, createAttachmentsRepo, type AttachmentsRepo } from "./attachments";
export { hospitalsRepo, createHospitalsRepo, type HospitalsRepo } from "./hospitals";
export { doctorsRepo, createDoctorsRepo, type DoctorsRepo } from "./doctors";
export { medicalVisitsRepo, createMedicalVisitsRepo, type MedicalVisitsRepo } from "./medicalVisits";
