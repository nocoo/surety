/**
 * Returns the Chinese greeting word for an hour (24h).
 *   0..4   → 凌晨好
 *   5..10  → 早上好
 *   11..12 → 上午好
 *   13..17 → 下午好
 *   18..23 → 晚上好
 *
 * Exported so the dashboard can call `greetingForHour(new Date().getHours())`
 * at render time without us hard-coding "now" anywhere — and the test can
 * cover every bucket without faking the clock.
 */
export function greetingForHour(hour: number): string {
  if (hour < 0 || hour > 23 || !Number.isFinite(hour)) return "你好";
  if (hour < 5) return "凌晨好";
  if (hour < 11) return "早上好";
  if (hour < 13) return "上午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

/**
 * Family-tone subtitle: surface how many people are being protected and how
 * many policies are in play instead of a generic "家庭保障概览". Pure
 * function so the dashboard component can stay declarative.
 *
 *   (5, 12) → "已为家中 5 位成员守护 12 份保单"
 *   (1, 1)  → "已为家中 1 位成员守护 1 份保单"
 *   (0, _)  → "添加家庭成员开始守护他们"
 *   (n, 0)  → "已有 n 位家庭成员，添加保单开始守护"
 */
export function familySubtitle(memberCount: number, policyCount: number): string {
  if (memberCount <= 0) return "添加家庭成员开始守护他们";
  if (policyCount <= 0) return `已有 ${memberCount} 位家庭成员，添加保单开始守护`;
  return `已为家中 ${memberCount} 位成员守护 ${policyCount} 份保单`;
}
