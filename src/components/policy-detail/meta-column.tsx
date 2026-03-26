"use client";

import { useState } from "react";
import { Copy, Check, Shield, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { AttachmentSection } from "@/components/attachments/attachment-section";
import { cn, getAvatarColor } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import {
  statusConfig,
  categoryLabels,
  paymentFrequencyLabels,
  renewalTypeLabels,
} from "@/lib/constants/policy";
import type { PolicyDetail, Beneficiary } from "@/lib/types/policy";

interface MetaColumnProps {
  policy: PolicyDetail;
  beneficiaries: Beneficiary[];
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function PersonRow({
  name,
  label,
  icon,
}: {
  name: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {icon ?? (
          <Avatar size="sm">
            <AvatarFallback className={cn(getAvatarColor(name), "text-white")}>
              {name[0]}
            </AvatarFallback>
          </Avatar>
        )}
        <span className="font-medium">{name}</span>
      </div>
    </div>
  );
}

export function MetaColumn({ policy, beneficiaries }: MetaColumnProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(policy.policyNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const status = statusConfig[policy.status];
  const frequencyLabel =
    paymentFrequencyLabels[policy.paymentFrequency] ?? policy.paymentFrequency;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-primary shrink-0" />
          <h2 className="text-lg font-semibold leading-tight">
            {policy.productName}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          <span className="text-sm text-muted-foreground">
            {policy.policyNumber}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="复制保单号"
          >
            {copied ? (
              <Check className="size-3.5 text-success" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      <Separator />

      {/* 基本信息 */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          基本信息
        </h3>
        <div className="space-y-2">
          <InfoRow label="保险公司" value={policy.insurerName} />
          <InfoRow
            label="险种"
            value={categoryLabels[policy.category] ?? policy.category}
          />
          <InfoRow label="子类" value={policy.subCategory} />
          <InfoRow label="渠道" value={policy.channel} />
        </div>
      </div>

      <Separator />

      {/* 保障信息 */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          保障信息
        </h3>
        <div className="space-y-2">
          <InfoRow label="保额" value={formatCurrency(policy.sumAssured)} />
          <InfoRow label="身故保额" value={policy.deathBenefit} />
          <InfoRow
            label="保费"
            value={`${formatCurrency(policy.premium)}/${frequencyLabel}`}
          />
        </div>
      </div>

      <Separator />

      {/* 缴费详情 */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          缴费详情
        </h3>
        <div className="space-y-2">
          {policy.paymentYears != null && (
            <InfoRow label="缴费年限" value={`${policy.paymentYears} 年`} />
          )}
          {policy.totalPayments != null && (
            <InfoRow label="总期数" value={`${policy.totalPayments} 期`} />
          )}
          {policy.renewalType && (
            <InfoRow
              label="续保方式"
              value={renewalTypeLabels[policy.renewalType] ?? policy.renewalType}
            />
          )}
          <InfoRow label="扣款账户" value={policy.paymentAccount} />
        </div>
      </div>

      <Separator />

      {/* 人员信息 */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          人员信息
        </h3>
        <div className="space-y-2">
          <PersonRow name={policy.insuredName} label="被保人" />
          {policy.applicantName && (
            <PersonRow name={policy.applicantName} label="投保人" />
          )}
          {policy.insuredAssetName && (
            <PersonRow
              name={policy.insuredAssetName}
              label="保障标的"
              icon={
                <div className="flex size-6 items-center justify-center rounded-full bg-muted">
                  <Building2 className="size-3.5 text-muted-foreground" />
                </div>
              }
            />
          )}
        </div>
      </div>

      {/* 受益人 */}
      {beneficiaries.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              受益人
            </h3>
            <div className="space-y-2">
              {beneficiaries.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarFallback
                        className={cn(getAvatarColor(b.name), "text-white")}
                      >
                        {b.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{b.name}</span>
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {b.rankOrder}序
                    </Badge>
                  </div>
                  <span className="text-muted-foreground">
                    {b.sharePercent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 备注 */}
      {policy.notes && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              备注
            </h3>
            <p className="text-sm whitespace-pre-wrap">{policy.notes}</p>
          </div>
        </>
      )}

      <Separator />

      {/* 附件 */}
      <AttachmentSection policyId={policy.id} />
    </div>
  );
}
