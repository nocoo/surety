"use client";

import { Clock, AlertTriangle, CheckCircle } from "lucide-react";
import type { RenewalItem } from "@/lib/renewal-calendar-vm";
import { formatCurrency } from "@/lib/chart-config";

interface UpcomingListProps {
  items: RenewalItem[];
}

function getDaysColor(days: number): string {
  if (days < 0) return "text-red-500";
  if (days <= 7) return "text-red-500";
  if (days <= 14) return "text-orange-500";
  if (days <= 30) return "text-amber-500";
  return "text-muted-foreground";
}

function getDaysIcon(days: number) {
  if (days < 0) return <AlertTriangle className="h-4 w-4 text-red-500" />;
  if (days <= 7) return <AlertTriangle className="h-4 w-4 text-red-500" />;
  if (days <= 14) return <Clock className="h-4 w-4 text-orange-500" />;
  return <CheckCircle className="h-4 w-4 text-emerald-500" />;
}

function formatDays(days: number): string {
  if (days < 0) return `已过期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天";
  if (days === 1) return "明天";
  return `${days} 天后`;
}

export function UpcomingList({ items }: UpcomingListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          近期续保 (30天内)
        </h3>
        <p className="text-muted-foreground text-sm">
          未来 30 天内没有需要续保的保单
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        近期续保 (30天内)
      </h3>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div
            key={`${item.id}-${item.nextDueDate}-${idx}`}
            className="flex items-center justify-between py-2 border-b border-border last:border-0"
          >
            <div className="flex items-center gap-3">
              {getDaysIcon(item.daysUntilDue)}
              <div>
                <p className="font-medium text-sm">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.insuredMemberName} · {item.categoryLabel}
                  {item.isSavings && (
                    <span className="ml-1 text-amber-500">(储蓄)</span>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-medium text-sm">
                {formatCurrency(item.premium)}
              </p>
              <p className={`text-xs ${getDaysColor(item.daysUntilDue)}`}>
                {formatDays(item.daysUntilDue)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
