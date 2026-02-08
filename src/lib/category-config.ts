/**
 * Insurance category configuration
 * Provides unified labels, badge variants, and colors for policy categories
 */

import type { PolicyCategory } from "@/db/types";

export interface CategoryConfig {
  label: string;
  /** Badge variant from shadcn/ui */
  variant: "default" | "secondary" | "success" | "warning" | "info" | "purple" | "destructive";
  /** Tailwind background color for avatars and charts */
  bgColor: string;
  /** Tailwind text color */
  textColor: string;
}

/**
 * Category configuration map
 * Each category has a distinct color for visual differentiation
 */
export const CATEGORY_CONFIG: Record<PolicyCategory, CategoryConfig> = {
  Life: {
    label: "寿险",
    variant: "info",
    bgColor: "bg-blue-500",
    textColor: "text-blue-500",
  },
  CriticalIllness: {
    label: "重疾险",
    variant: "destructive",
    bgColor: "bg-red-500",
    textColor: "text-red-500",
  },
  Medical: {
    label: "医疗险",
    variant: "success",
    bgColor: "bg-emerald-500",
    textColor: "text-emerald-500",
  },
  Accident: {
    label: "意外险",
    variant: "warning",
    bgColor: "bg-amber-500",
    textColor: "text-amber-500",
  },
  Annuity: {
    label: "年金险",
    variant: "purple",
    bgColor: "bg-purple-500",
    textColor: "text-purple-500",
  },
  Property: {
    label: "财产险",
    variant: "secondary",
    bgColor: "bg-slate-500",
    textColor: "text-slate-500",
  },
};

/**
 * Get category configuration by category key
 * Returns default config if category not found
 */
export function getCategoryConfig(category: string): CategoryConfig {
  return (
    CATEGORY_CONFIG[category as PolicyCategory] ?? {
      label: category,
      variant: "secondary",
      bgColor: "bg-slate-500",
      textColor: "text-slate-500",
    }
  );
}

/**
 * Member avatar color palette
 * A set of distinct colors for member avatars
 */
export const MEMBER_AVATAR_COLORS = [
  { bg: "bg-blue-500", text: "text-white" },
  { bg: "bg-emerald-500", text: "text-white" },
  { bg: "bg-amber-500", text: "text-white" },
  { bg: "bg-purple-500", text: "text-white" },
  { bg: "bg-rose-500", text: "text-white" },
  { bg: "bg-cyan-500", text: "text-white" },
  { bg: "bg-orange-500", text: "text-white" },
  { bg: "bg-indigo-500", text: "text-white" },
] as const;

/**
 * Generate a stable color index based on member name
 * Uses simple hash to ensure same name always gets same color
 */
export function getMemberColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % MEMBER_AVATAR_COLORS.length;
}

/**
 * Get avatar colors for a member by name
 */
export function getMemberAvatarColors(name: string): { bg: string; text: string } {
  const index = getMemberColorIndex(name);
  return MEMBER_AVATAR_COLORS[index] ?? MEMBER_AVATAR_COLORS[0];
}

/**
 * Get first character of name for avatar fallback
 * Handles both Chinese and English names
 */
export function getNameInitial(name: string): string {
  if (!name) return "?";
  // Return first character (works for both Chinese and English)
  return name.charAt(0).toUpperCase();
}
