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
  "bg-rose-500",      // 0
  "bg-pink-500",      // 1
  "bg-fuchsia-500",   // 2
  "bg-purple-500",    // 3
  "bg-violet-500",    // 4
  "bg-indigo-500",    // 5
  "bg-blue-500",      // 6
  "bg-sky-500",       // 7
  "bg-cyan-500",      // 8
  "bg-teal-500",      // 9
  "bg-emerald-500",   // 10
  "bg-green-500",     // 11
  "bg-lime-600",      // 12
  "bg-amber-500",     // 13
  "bg-orange-500",    // 14
  "bg-red-500",       // 15
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
 * Badge color palette for categories/tags.
 * Each color is a pair of [background, text] tailwind classes.
 */
const BADGE_COLORS = [
  { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200" },
  { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-200" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700", border: "border-fuchsia-200" },
  { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
  { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200" },
  { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200" },
  { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  { bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-200" },
  { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-200" },
  { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-200" },
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
  { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
  { bg: "bg-lime-100", text: "text-lime-700", border: "border-lime-200" },
  { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
  { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
] as const;

/**
 * Get consistent badge colors based on a string (e.g., category name).
 * Works with Chinese characters. Same input always returns the same color.
 */
export function getBadgeColor(label: string): { bg: string; text: string; border: string } {
  const hash = hashString(label);
  const index = hash % BADGE_COLORS.length;
  return BADGE_COLORS[index] ?? BADGE_COLORS[0];
}
