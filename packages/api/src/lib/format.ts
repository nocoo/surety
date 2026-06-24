/**
 * Single source of truth for currency formatting across the app.
 *
 * Unified rule: every amount renders as `¥` + locale grouping (`zh-CN`).
 * No "万" / "亿" compact forms — they shifted the decimal point relative
 * to nearby numbers and made columns hard to scan. Keeping one format
 * everywhere means `¥1,234`, `¥15,000`, `¥1,500,000` all align on the
 * thousands separators and the same digit positions.
 *
 * Defensive against `null` / `undefined` / `NaN` / `Infinity` so a stale
 * backend rollout (e.g. a stats endpoint missing a field) can't crash
 * the UI with `Cannot read properties of undefined`.
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "¥0";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Same format as `formatCurrency` but keeps two decimal places.
 * Used in payment records where every cent matters.
 */
export function formatCurrencyFull(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "¥0.00";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
