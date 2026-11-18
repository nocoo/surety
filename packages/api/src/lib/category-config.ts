/**
 * Insurance category configuration
 * Provides unified labels, badge variants, and colors for policy categories
 */

import type { PolicyCategory } from "@surety/db/types";

export interface CategoryConfig {
	label: string;
	/** Badge variant from shadcn/ui */
	variant:
		| "default"
		| "secondary"
		| "success"
		| "warning"
		| "info"
		| "purple"
		| "teal"
		| "blue"
		| "destructive";
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
		label: "定期寿",
		variant: "info",
		accentClass: "text-basalt-info",
		accentSoftClass: "bg-basalt-info-tint text-basalt-info",
	},
	WholeLife: {
		label: "终身寿",
		variant: "blue",
		accentClass: "text-basalt-badge-purple",
		accentSoftClass: "bg-basalt-badge-purple/10 text-basalt-badge-purple",
	},
	CriticalIllness: {
		label: "重疾险",
		variant: "destructive",
		accentClass: "text-basalt-destructive",
		accentSoftClass: "bg-basalt-destructive/10 text-basalt-destructive",
	},
	Medical: {
		label: "医疗险",
		variant: "success",
		accentClass: "text-basalt-success",
		accentSoftClass: "bg-basalt-success/10 text-basalt-success",
	},
	Accident: {
		label: "意外险",
		variant: "warning",
		accentClass: "text-basalt-warning",
		accentSoftClass: "bg-basalt-warning-tint text-basalt-warning",
	},
	Annuity: {
		label: "年金险",
		variant: "purple",
		accentClass: "text-basalt-badge-purple",
		accentSoftClass: "bg-basalt-badge-purple/10 text-basalt-badge-purple",
	},
	Property: {
		label: "财产险",
		variant: "teal",
		accentClass: "text-basalt-badge-teal",
		accentSoftClass: "bg-basalt-badge-teal/10 text-basalt-badge-teal",
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
			accentClass: "text-basalt-muted-foreground",
			accentSoftClass: "bg-basalt-muted text-basalt-muted-foreground",
		}
	);
}

/**
 * Member avatar color palette
 * A set of distinct colors for member avatars
 */
export const MEMBER_AVATAR_COLORS = [
	{ bg: "bg-basalt-info", text: "text-basalt-info-foreground" },
	{ bg: "bg-basalt-badge-green", text: "text-basalt-badge-green-foreground" },
	{ bg: "bg-basalt-warning", text: "text-basalt-warning-foreground" },
	{ bg: "bg-basalt-badge-purple", text: "text-basalt-badge-purple-foreground" },
	{ bg: "bg-basalt-danger", text: "text-basalt-danger-foreground" },
	{ bg: "bg-basalt-badge-teal", text: "text-basalt-badge-teal-foreground" },
	{ bg: "bg-basalt-primary", text: "text-basalt-primary-foreground" },
	{ bg: "bg-basalt-muted-foreground", text: "text-basalt-background" },
] as const;

/**
 * Generate a stable color index based on member name
 * Uses simple hash to ensure same name always gets same color
 */
export function getMemberColorIndex(name: string): number {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		const char = name.charCodeAt(i);
		hash = (hash << 5) - hash + char;
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
