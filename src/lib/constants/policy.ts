import type { PolicyStatus } from "@/db/types";

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

export const categoryLabels: Record<string, string> = {
  Life: "寿险",
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
