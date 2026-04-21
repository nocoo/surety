/**
 * MCP Tools: Shared Utilities
 *
 * Common utilities shared across all MCP tools.
 */

/** Strip keys with undefined values (for exactOptionalPropertyTypes compat) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stripUndefined(obj: Record<string, unknown>): any {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v;
  }
  return result;
}

/**
 * Tolerant JSON parse — returns the parsed object on success,
 * or the raw string on parse failure.
 */
export function tryParseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/**
 * Validate that a string is valid JSON.
 * Returns undefined if valid, or an error message string if invalid.
 */
export function validateJson(str: string): string | undefined {
  try {
    JSON.parse(str);
    return undefined;
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid JSON";
  }
}

/**
 * Parse a date string (YYYY-MM-DD) without UTC timezone shift.
 * Uses explicit date component extraction to avoid timezone issues.
 * Returns the Date at midnight local time, or null if invalid.
 */
export function parseLocalDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  // month is 0-indexed in Date constructor
  return new Date(Number(year), Number(month) - 1, Number(day));
}
