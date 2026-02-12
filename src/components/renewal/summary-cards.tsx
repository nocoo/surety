"use client";

import { Calendar, Wallet, PiggyBank, Shield } from "lucide-react";
import type { RenewalSummary } from "@/lib/renewal-calendar-vm";
import { formatCurrency } from "@/lib/chart-config";

interface SummaryCardsProps {
  summary: RenewalSummary;
}

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  variant?: "default" | "savings" | "protection";
}

function StatCard({ label, value, subValue, icon: Icon, variant = "default" }: StatCardProps) {
  const iconColors = {
    default: "text-primary",
    savings: "text-amber-500",
    protection: "text-emerald-500",
  };

  return (
    <div className="rounded-card bg-secondary p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${iconColors[variant]}`} strokeWidth={1.5} />
      </div>
      <div className="mt-2">
        <span className="text-2xl font-bold font-display">{value}</span>
        {subValue && (
          <span className="ml-2 text-sm text-muted-foreground">{subValue}</span>
        )}
      </div>
    </div>
  );
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="未来一年续保总额"
        value={formatCurrency(summary.totalPremium)}
        subValue={`${summary.renewalCount} 次缴费`}
        icon={Wallet}
      />
      <StatCard
        label="涉及保单"
        value={`${summary.totalCount} 份`}
        icon={Calendar}
      />
      <StatCard
        label="储蓄险保费"
        value={formatCurrency(summary.savingsPremium)}
        icon={PiggyBank}
        variant="savings"
      />
      <StatCard
        label="保障险保费"
        value={formatCurrency(summary.protectionPremium)}
        icon={Shield}
        variant="protection"
      />
    </div>
  );
}
