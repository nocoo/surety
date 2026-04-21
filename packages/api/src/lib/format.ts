/**
 * Format currency for display.
 *
 * - Values >= 10,000 show as "X万" (compact Chinese style)
 * - Smaller values show as "¥X" with no decimals
 */
export function formatCurrency(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}万`;
  }
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format currency with full precision (2 decimal places).
 * Used in payment records where exact amounts matter.
 */
export function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
