
import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronDown, ChevronRight, Phone, ExternalLink, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCategoryConfig } from "@surety/api/lib/category-config";
import { formatCurrency } from "@surety/api/lib/format";
import type { PolicyCoverageCard } from "@surety/api/coverage-lookup";

interface PolicyCardProps {
  policy: PolicyCoverageCard;
}

export function PolicyCard({ policy }: PolicyCardProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const detailsId = `policy-card-details-${policy.id}`;

  return (
    <div className="rounded-card bg-secondary overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={detailsId}
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
              <p className="text-base font-medium truncate">{policy.productName}</p>
              {!policy.isActive && (
                <Badge variant="outline" className="shrink-0">
                  {policy.statusLabel}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {policy.insurerName}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="text-xl font-semibold tabular-nums">{policy.sumAssuredFormatted}</p>
          <p className="text-xs text-muted-foreground">保额</p>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div id={detailsId} className="border-t border-border bg-muted/20 px-4 py-3 space-y-3">
          {/* Insurer phone - prominent when available */}
          {policy.insurerPhone && (
            <div className="flex items-center justify-between p-3 bg-primary/5 rounded-widget">
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
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-widget text-muted-foreground text-sm">
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

          {/* View detail link */}
          <button
            onClick={() => navigate(`/policies/${policy.id}`)}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline pt-1"
          >
            <FileText className="h-3.5 w-3.5" />
            查看保单详情
          </button>
        </div>
      )}
    </div>
  );
}

interface CategorySectionProps {
  /** Category enum from the API (e.g. "Medical", "CriticalIllness"). */
  category: string;
  policies: PolicyCoverageCard[];
  totalSumAssured: number;
}

export function CategorySection({
  category,
  policies,
  totalSumAssured,
}: CategorySectionProps) {
  // Single source of truth for label + Badge variant per category. The
  // API also ships these alongside the row, but routing through
  // getCategoryConfig keeps every category surface in the app on the
  // same pinned color/label so a future palette change reaches them all.
  const config = getCategoryConfig(category);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={config.variant}>
            {config.label}
          </Badge>
          <span className="text-sm text-muted-foreground">
            ({policies.length})
          </span>
        </div>
        <span className="text-sm font-medium">
          总保额 {formatCurrency(totalSumAssured)}
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
