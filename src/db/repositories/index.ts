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
