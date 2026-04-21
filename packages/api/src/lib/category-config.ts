/**
 * Insurance category configuration
 * Provides unified labels, badge variants, and colors for policy categories
 */

import type { PolicyCategory } from "@surety/db/types";

export interface CategoryConfig {
  label: string;
  /** Badge variant from shadcn/ui */
  variant: "default" | "secondary" | "success" | "warning" | "info" | "purple" | "teal" | "destructive";
  /** Semantic accent classes for icon and lightweight surfaces */
  accentClass: string;
  accentSoftClass: string;
}

/**
 * Category configuration map
 * Each category has a distinct color for visual differentiation
 */
export const CATEGORY_CONFIG: Record<PolicyCategory, CategoryConfig> = {
  Life: {
    label: "寿险",
    variant: "info",
    accentClass: "text-info",
    accentSoftClass: "bg-info/10 text-info",
  },
  CriticalIllness: {
    label: "重疾险",
    variant: "destructive",
    accentClass: "text-destructive",
    accentSoftClass: "bg-destructive/10 text-destructive",
  },
  Medical: {
    label: "医疗险",
    variant: "success",
    accentClass: "text-success",
    accentSoftClass: "bg-success/10 text-success",
  },
  Accident: {
    label: "意外险",
    variant: "warning",
    accentClass: "text-warning",
    accentSoftClass: "bg-warning/15 text-warning",
  },
  Annuity: {
    label: "年金险",
    variant: "purple",
    accentClass: "text-purple",
    accentSoftClass: "bg-purple/10 text-purple",
  },
  Property: {
    label: "财产险",
    variant: "teal",
    accentClass: "text-teal",
    accentSoftClass: "bg-teal/10 text-teal",
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
      variant: "secondary" as const,
      accentClass: "text-muted-foreground",
      accentSoftClass: "bg-muted text-muted-foreground",
    }
  );
}

/**
 * Member avatar color palette
 * A set of distinct colors for member avatars
 */
export const MEMBER_AVATAR_COLORS = [
  { bg: "bg-info", text: "text-info-foreground" },
  { bg: "bg-success", text: "text-success-foreground" },
  { bg: "bg-warning", text: "text-warning-foreground" },
  { bg: "bg-purple", text: "text-purple-foreground" },
  { bg: "bg-badge-red", text: "text-badge-red-foreground" },
  { bg: "bg-teal", text: "text-teal-foreground" },
  { bg: "bg-primary", text: "text-primary-foreground" },
  { bg: "bg-muted-foreground", text: "text-background" },
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
