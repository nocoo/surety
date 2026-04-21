export { getDashboardData } from "./dashboard";
export {
  buildMemberCoverageData,
  buildAssetCoverageData,
  fetchCoverageLookupData,
  buildMemberCards,
  buildAssetCards,
  buildPolicyCards,
  groupPoliciesByCategory,
  type SelectionType,
  type CoverageLookupData,
} from "./coverage-lookup";
export {
  buildRenewalCalendarData,
  calculateRenewalDates,
  calculateRenewalItems,
  groupByMonth,
  calculateSummary,
  isSavingsPolicy,
  addMonths,
} from "./renewal-calendar";
export { checkHealth, type HealthResult, type HealthDeps } from "./health";

export { formatCurrency, formatCurrencyFull } from "./lib/format";
export { CATEGORY_CONFIG, getCategoryConfig, MEMBER_AVATAR_COLORS, getMemberAvatarColors, getNameInitial } from "./lib/category-config";
export {
  validateFile,
  validateMagicBytes,
  generateR2Key,
  extractExtension,
  formatBytes,
  isImageContentType,
  ALLOWED_CONTENT_TYPES,
  MAX_FILE_SIZE,
  MAX_ATTACHMENTS_PER_POLICY,
} from "./lib/attachment-validation";
export { APP_VERSION } from "./lib/version";
