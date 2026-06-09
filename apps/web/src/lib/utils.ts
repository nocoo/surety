import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a stable hash from a string.
 * Uses a simple but effective algorithm that works well with Chinese characters.
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Avatar color palette — 16 token-backed slots, hand-tuned in
 * globals.css so every slot clears WCAG AA (≥ 4.5:1) against `text-white`
 * in BOTH light and dark mode. See `--avatar-1..16` in globals.css.
 *
 * Why a dedicated palette instead of reusing semantic/chart tokens:
 * - The semantic fill tokens (--success / --info / --teal / etc.) are
 *   tuned for solid backgrounds with white-on-color, but most of them
 *   only clear ~3.5:1 against white in light mode — fine for badges
 *   with bold text but unreadable for a single-character initial.
 * - The chart palette is tuned for fills next to other chart fills, on
 *   a card background. They're typically lighter than ~50% L, which
 *   pushes white-text contrast even lower (chart-1/6/7 ≈ 2:1).
 *
 * If a future chart needs to color series by entity name to match the
 * avatar, route through these same `bg-avatar-N` slots — they're token
 * names, so consumers can read them via Tailwind utilities or via
 * `hsl(var(--avatar-N))` for inline styles.
 */
const AVATAR_COLORS = [
  "bg-avatar-1",
  "bg-avatar-2",
  "bg-avatar-3",
  "bg-avatar-4",
  "bg-avatar-5",
  "bg-avatar-6",
  "bg-avatar-7",
  "bg-avatar-8",
  "bg-avatar-9",
  "bg-avatar-10",
  "bg-avatar-11",
  "bg-avatar-12",
  "bg-avatar-13",
  "bg-avatar-14",
  "bg-avatar-15",
  "bg-avatar-16",
] as const;

/**
 * Get a consistent avatar background color based on name.
 * Same name always returns the same color.
 */
export function getAvatarColor(name: string): string {
  const hash = hashString(name);
  const index = hash % AVATAR_COLORS.length;
  return AVATAR_COLORS[index] ?? AVATAR_COLORS[0];
}

/**
 * Common Chinese city prefixes for hospital names.
 * Used to skip generic location words and pick a more distinctive character.
 */
const CITY_PREFIXES = [
  "北京", "上海", "广州", "深圳", "天津", "重庆", "成都", "杭州",
  "南京", "武汉", "西安", "苏州", "长沙", "郑州", "青岛", "大连",
  "沈阳", "哈尔滨", "济南", "昆明", "福州", "合肥", "厦门", "贵阳",
  "石家庄", "南昌", "太原", "南宁", "兰州", "海口", "呼和浩特",
  "乌鲁木齐", "银川", "西宁", "拉萨",
] as const;

/**
 * Get the display initial for a hospital name.
 * Skips common city prefixes to show a more distinctive character.
 * E.g., "北京协和医院" → "协", "上海瑞金医院" → "瑞"
 */
export function getHospitalInitial(name: string): string {
  if (!name) return "?";
  for (const prefix of CITY_PREFIXES) {
    if (name.startsWith(prefix) && name.length > prefix.length) {
      return name[prefix.length] ?? name[0] ?? "?";
    }
  }
  return name[0] ?? "?";
}
