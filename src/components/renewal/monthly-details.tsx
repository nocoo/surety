"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { MonthlyRenewal, RenewalItem } from "@/lib/renewal-calendar-vm";
import { formatCurrency } from "@/lib/chart-config";

interface MonthlyDetailsProps {
  data: MonthlyRenewal[];
}

function RenewalRow({ item }: { item: RenewalItem }) {
  return (
    <div className="flex items-center justify-between py-2 px-4 hover:bg-muted/50">
      <div className="flex-1">
        <p className="text-sm font-medium">{item.productName}</p>
        <p className="text-xs text-muted-foreground">
          {item.insuredMemberName} · {item.categoryLabel}
          {item.isSavings && (
            <span className="ml-1 text-amber-500">(储蓄)</span>
          )}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{formatCurrency(item.premium)}</p>
        <p className="text-xs text-muted-foreground">{item.nextDueDate}</p>
      </div>
    </div>
  );
}

function MonthSection({ month }: { month: MonthlyRenewal }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium">{month.monthLabel}</span>
          <span className="text-xs text-muted-foreground">
            ({month.count} 次)
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {month.savingsPremium > 0 && (
            <span className="text-amber-500">
              储蓄 {formatCurrency(month.savingsPremium)}
            </span>
          )}
          {month.protectionPremium > 0 && (
            <span className="text-emerald-500">
              保障 {formatCurrency(month.protectionPremium)}
            </span>
          )}
          <span className="font-medium">
            {formatCurrency(month.totalPremium)}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="bg-muted/30">
          {month.items.map((item, idx) => (
            <RenewalRow
              key={`${item.id}-${item.nextDueDate}-${idx}`}
              item={item}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MonthlyDetails({ data }: MonthlyDetailsProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-muted-foreground text-sm text-center">
          未来一年内没有需要续保的保单
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {data.map((month) => (
        <MonthSection key={month.month} month={month} />
      ))}
    </div>
  );
}
