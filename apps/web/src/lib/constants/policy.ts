import type { PolicyStatus } from "@surety/db/types";

export const statusConfig: Record<
  PolicyStatus,
  { label: string; variant: "success" | "outline" | "warning" | "purple" | "destructive" }
> = {
  Active: { label: "生效中", variant: "success" },
  Expired: { label: "已过期", variant: "destructive" },
  Lapsed: { label: "已失效", variant: "outline" },
  Surrendered: { label: "已退保", variant: "warning" },
  Claimed: { label: "已理赔", variant: "purple" },
};

/**
 * Tailwind class for a thin left-border accent that represents the
 * policy's status as a visual stripe. Used by the dense list view in
 * place of an inline <Badge> so the row stays scannable.
 *
 * The badge label still shows in row tooltips and on the detail page;
 * the stripe is recognition, not the source of truth.
 */
export function statusStripeClass(status: PolicyStatus): string {
  switch (statusConfig[status].variant) {
    case "success": return "border-l-2 border-l-success";
    case "destructive": return "border-l-2 border-l-destructive";
    case "warning": return "border-l-2 border-l-warning";
    case "purple": return "border-l-2 border-l-purple";
    case "outline":
    default: return "border-l-2 border-l-muted-foreground/30";
  }
}

/**
 * Category enum-key → Chinese label map.
 *
 * Display surfaces (badges, chips, table cells, group headers) should
 * route through `getCategoryConfig(category).label` from
 * `@surety/api/lib/category-config`, which is the single source of
 * truth pairing the label with its Badge variant. This map exists
 * only as a static enumeration of the supported categories — used by
 * the policy-sheet form's category Select to render the option list.
 */
export const categoryLabels: Record<string, string> = {
  Life: "定期寿",
  WholeLife: "终身寿",
  CriticalIllness: "重疾险",
  Medical: "医疗险",
  Accident: "意外险",
  Annuity: "年金险",
  Property: "财产险",
};

export const paymentFrequencyLabels: Record<string, string> = {
  Single: "趸交",
  Monthly: "月缴",
  Yearly: "年缴",
};

export const renewalTypeLabels: Record<string, string> = {
  Manual: "手动续保",
  Auto: "自动续保",
  Yearly: "一年期",
};
