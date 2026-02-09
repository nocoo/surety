"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Phone, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PolicyCoverageCard } from "@/lib/coverage-lookup-vm";

interface PolicyCardProps {
  policy: PolicyCoverageCard;
}

export function PolicyCard({ policy }: PolicyCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate">{policy.productName}</p>
              {!policy.isActive && (
                <Badge variant="secondary" className="shrink-0">
                  {policy.statusLabel}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {policy.insurerName}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="text-lg font-semibold">{policy.sumAssuredFormatted}</p>
          <p className="text-xs text-muted-foreground">保额</p>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-3">
          {/* Insurer phone - prominent when available */}
          {policy.insurerPhone && (
            <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">客服电话</span>
              </div>
              <a
                href={`tel:${policy.insurerPhone}`}
                className="flex items-center gap-1 text-primary font-semibold hover:underline"
              >
                {policy.insurerPhone}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {!policy.insurerPhone && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-muted-foreground text-sm">
              <Phone className="h-4 w-4" />
              <span>暂无客服电话</span>
            </div>
          )}

          {/* Policy details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">年保费</p>
              <p className="font-medium">{policy.premiumFormatted}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">状态</p>
              <p className="font-medium">{policy.statusLabel}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">生效日期</p>
              <p className="font-medium">{policy.effectiveDate}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">到期日期</p>
              <p className="font-medium">{policy.expiryDate ?? "终身"}</p>
            </div>
          </div>

          {/* Sub-category if exists */}
          {policy.subCategory && (
            <div className="text-xs text-muted-foreground">
              类型: {policy.subCategory}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CategorySectionProps {
  categoryLabel: string;
  categoryVariant: string;
  policies: PolicyCoverageCard[];
  totalSumAssured: number;
}

export function CategorySection({
  categoryLabel,
  categoryVariant,
  policies,
  totalSumAssured,
}: CategorySectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={categoryVariant as "default"}>
            {categoryLabel}
          </Badge>
          <span className="text-sm text-muted-foreground">
            ({policies.length})
          </span>
        </div>
        <span className="text-sm font-medium">
          总保额 {formatSumAssuredLarge(totalSumAssured)}
        </span>
      </div>
      <div className="space-y-2">
        {policies.map((policy) => (
          <PolicyCard key={policy.id} policy={policy} />
        ))}
      </div>
    </div>
  );
}

function formatSumAssuredLarge(value: number): string {
  if (value >= 10000) {
    const wan = value / 10000;
    return wan % 1 === 0 ? `${wan}万` : `${wan.toFixed(1)}万`;
  }
  return value.toLocaleString();
}
