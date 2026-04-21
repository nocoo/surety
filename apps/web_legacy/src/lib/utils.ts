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
 * Avatar color palette - carefully selected for good contrast with white text.
 * Uses HSL for consistent saturation and lightness.
 */
const AVATAR_COLORS = [
  "bg-badge-red",        // 0
  "bg-purple",           // 1
  "bg-purple/85",        // 2
  "bg-purple/70",        // 3
  "bg-info",             // 4
  "bg-info/85",          // 5
  "bg-primary",          // 6
  "bg-info/70",          // 7
  "bg-teal",             // 8
  "bg-teal/85",          // 9
  "bg-success",          // 10
  "bg-success/85",       // 11
  "bg-muted-foreground", // 12
  "bg-warning",          // 13
  "bg-primary/85",       // 14
  "bg-destructive",      // 15
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
