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
