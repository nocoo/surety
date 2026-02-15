"use client";

import { useState, useCallback } from "react";
import { Copy, Check, ExternalLink, Building2, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getAvatarColor } from "@/lib/utils";

type PolicyStatus = "Active" | "Lapsed" | "Surrendered" | "Claimed" | "Expired";

interface PolicyDetail {
  id: number;
  policyNumber: string;
  productName: string;
  insurerName: string;
  insuredName: string;
  insuredAssetName: string | null;
  applicantName?: string;
  category: string;
  subCategory: string | null;
  channel: string | null;
  status: PolicyStatus;
  premium: number;
  sumAssured: number;
  paymentFrequency: string;
  paymentYears: number | null;
  totalPayments: number | null;
  renewalType: string | null;
  paymentAccount: string | null;
  nextDueDate: string | null;
  effectiveDate: string;
  expiryDate: string | null;
  hesitationEndDate: string | null;
  waitingDays: number | null;
  guaranteedRenewalYears: number | null;
  deathBenefit: string | null;
  policyFilePath: string | null;
  notes: string | null;
}

interface CoverageItem {
  id: number;
  policyId: number;
  name: string;
  periodLimit: number | null;
  lifetimeLimit: number | null;
  deductible: number | null;
  coveragePercent: number | null;
  isOptional: boolean | number;
  notes: string | null;
  sortOrder: number;
}

interface Beneficiary {
  id: number;
  name: string;
  sharePercent: number;
  rankOrder: number;
}

interface Payment {
  id: number;
  periodNumber: number;
  dueDate: string;
  amount: number;
  status: string;
  paidDate: string | null;
}

interface PolicyDetailDialogProps {
  policyId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryLabels: Record<string, string> = {
  Life: "寿险",
  CriticalIllness: "重疾险",
  Medical: "医疗险",
  Accident: "意外险",
  Annuity: "年金险",
  Property: "财产险",
};

const statusConfig: Record<PolicyStatus, { label: string; variant: "success" | "secondary" | "warning" | "purple" | "destructive" }> = {
  Active: { label: "生效中", variant: "success" },
  Expired: { label: "已过期", variant: "destructive" },
  Lapsed: { label: "已失效", variant: "secondary" },
  Surrendered: { label: "已退保", variant: "warning" },
  Claimed: { label: "已理赔", variant: "purple" },
};

const paymentFrequencyLabels: Record<string, string> = {
  Single: "趸交",
  Monthly: "月缴",
  Yearly: "年缴",
};

const renewalTypeLabels: Record<string, string> = {
  Manual: "手动续保",
  Auto: "自动续保",
  Yearly: "一年期",
};

function formatCurrency(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}万`;
  }
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm text-right", mono && "font-mono")}>{value || "-"}</span>
    </div>
  );
}

export function PolicyDetailDialog({ policyId, open, onOpenChange }: PolicyDetailDialogProps) {
  const [policy, setPolicy] = useState<PolicyDetail | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [coverageItems, setCoverageItems] = useState<CoverageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadedPolicyId, setLoadedPolicyId] = useState<number | null>(null);

  const fetchPolicyData = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const [policyData, beneficiariesData, paymentsData, coverageItemsData] = await Promise.all([
        fetch(`/api/policies/${id}`).then(res => res.json()),
        fetch(`/api/policies/${id}/beneficiaries`).then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`/api/policies/${id}/payments`).then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`/api/policies/${id}/coverage-items`).then(res => res.ok ? res.json() : []).catch(() => []),
      ]);
      setPolicy(policyData);
      setBeneficiaries(beneficiariesData);
      setPayments(paymentsData);
      setCoverageItems(coverageItemsData);
      setLoadedPolicyId(id);
    } catch {
      // Failed to load
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when needed
  if (open && policyId && policyId !== loadedPolicyId && !loading) {
    fetchPolicyData(policyId);
  }

  // Reset when closed
  if (!open && loadedPolicyId !== null) {
    setPolicy(null);
    setBeneficiaries([]);
    setPayments([]);
    setCoverageItems([]);
    setLoadedPolicyId(null);
  }

  const handleCopyPolicyNumber = async () => {
    if (!policy?.policyNumber) return;
    try {
      await navigator.clipboard.writeText(policy.policyNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  if (!open) return null;

  const status = policy ? statusConfig[policy.status] : null;
  const categoryLabel = policy ? (categoryLabels[policy.category] ?? policy.category) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {loading ? (
              <span className="text-muted-foreground">加载中...</span>
            ) : policy ? (
              <>
                <span>{policy.productName}</span>
                {status && <Badge variant={status.variant}>{status.label}</Badge>}
              </>
            ) : (
              <span className="text-muted-foreground">保单详情</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">加载中...</div>
          </div>
        )}

        {!loading && policy && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="text-sm font-medium mb-3">基本信息</h3>
              <div className="rounded-card bg-secondary p-4 space-y-1">
                <InfoRow
                  label="保单号"
                  value={
                    <button
                      onClick={handleCopyPolicyNumber}
                      className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      <span className="font-mono">{policy.policyNumber}</span>
                      {copied ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  }
                />
                <Separator />
                <InfoRow label="保险公司" value={policy.insurerName} />
                <Separator />
                <InfoRow label="险种类型" value={categoryLabel} />
                {policy.subCategory && (
                  <>
                    <Separator />
                    <InfoRow label="子类型" value={policy.subCategory} />
                  </>
                )}
                {policy.channel && (
                  <>
                    <Separator />
                    <InfoRow label="购买渠道" value={policy.channel} />
                  </>
                )}
              </div>
            </div>

            {/* Insured Info */}
            <div>
              <h3 className="text-sm font-medium mb-3">人员信息</h3>
              <div className="rounded-card bg-secondary p-4 space-y-1">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">被保人</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className={cn("text-xs text-white", getAvatarColor(policy.insuredName ?? ""))}>
                        {policy.insuredName?.[0] ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{policy.insuredName}</span>
                  </div>
                </div>
                {policy.applicantName && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">投保人</span>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className={cn("text-xs text-white", getAvatarColor(policy.applicantName))}>
                            {policy.applicantName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{policy.applicantName}</span>
                      </div>
                    </div>
                  </>
                )}
                {policy.insuredAssetName && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">关联资产</span>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{policy.insuredAssetName}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Coverage Info */}
            <div>
              <h3 className="text-sm font-medium mb-3">保障信息</h3>
              <div className="rounded-card bg-secondary p-4 space-y-1">
                <InfoRow label="保额" value={formatCurrency(policy.sumAssured)} />
                {policy.deathBenefit && (
                  <>
                    <Separator />
                    <InfoRow label="身故保障" value={policy.deathBenefit} />
                  </>
                )}
              </div>
            </div>

            {/* Coverage Items */}
            {coverageItems.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  保障明细
                </h3>
                <div className="rounded-card bg-secondary p-4">
                  <div className="space-y-3">
                    {coverageItems.map((item, idx) => (
                      <div key={item.id}>
                        {idx > 0 && <Separator className="mb-3" />}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {item.name}
                              {(item.isOptional === true || item.isOptional === 1) && (
                                <Badge variant="outline" className="ml-2 text-xs">可选</Badge>
                              )}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            {item.periodLimit !== null && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">年度限额</span>
                                <span>{formatCurrency(item.periodLimit)}</span>
                              </div>
                            )}
                            {item.lifetimeLimit !== null && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">终身限额</span>
                                <span>{formatCurrency(item.lifetimeLimit)}</span>
                              </div>
                            )}
                            {item.deductible !== null && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">免赔额</span>
                                <span>{formatCurrency(item.deductible)}</span>
                              </div>
                            )}
                            {item.coveragePercent !== null && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">赔付比例</span>
                                <span>{item.coveragePercent}%</span>
                              </div>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Payment Info */}
            <div>
              <h3 className="text-sm font-medium mb-3">缴费信息</h3>
              <div className="rounded-card bg-secondary p-4 space-y-1">
                <InfoRow label="保费" value={formatCurrency(policy.premium)} />
                <Separator />
                <InfoRow label="缴费方式" value={paymentFrequencyLabels[policy.paymentFrequency] ?? policy.paymentFrequency} />
                {policy.paymentYears && (
                  <>
                    <Separator />
                    <InfoRow label="缴费年限" value={`${policy.paymentYears} 年`} />
                  </>
                )}
                {policy.totalPayments && (
                  <>
                    <Separator />
                    <InfoRow label="总期数" value={`${policy.totalPayments} 期`} />
                  </>
                )}
                {policy.renewalType && (
                  <>
                    <Separator />
                    <InfoRow label="续保方式" value={renewalTypeLabels[policy.renewalType] ?? policy.renewalType} />
                  </>
                )}
                {policy.paymentAccount && (
                  <>
                    <Separator />
                    <InfoRow label="扣款账户" value={policy.paymentAccount} />
                  </>
                )}
                {policy.nextDueDate && (
                  <>
                    <Separator />
                    <InfoRow label="下次缴费日" value={policy.nextDueDate} mono />
                  </>
                )}
              </div>
            </div>

            {/* Date Info */}
            <div>
              <h3 className="text-sm font-medium mb-3">时间信息</h3>
              <div className="rounded-card bg-secondary p-4 space-y-1">
                <InfoRow label="生效日期" value={policy.effectiveDate} mono />
                {policy.expiryDate && (
                  <>
                    <Separator />
                    <InfoRow label="到期日期" value={policy.expiryDate} mono />
                  </>
                )}
                {policy.hesitationEndDate && (
                  <>
                    <Separator />
                    <InfoRow label="犹豫期结束" value={policy.hesitationEndDate} mono />
                  </>
                )}
                {policy.waitingDays && (
                  <>
                    <Separator />
                    <InfoRow label="等待期" value={`${policy.waitingDays} 天`} />
                  </>
                )}
                {policy.guaranteedRenewalYears && (
                  <>
                    <Separator />
                    <InfoRow label="保证续保" value={`${policy.guaranteedRenewalYears} 年`} />
                  </>
                )}
              </div>
            </div>

            {/* Beneficiaries */}
            {beneficiaries.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3">受益人</h3>
                <div className="rounded-card bg-secondary p-4">
                  <div className="space-y-2">
                    {beneficiaries.map((b) => (
                      <div key={b.id} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className={cn("text-xs text-white", getAvatarColor(b.name))}>
                              {b.name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{b.name}</span>
                          <Badge variant="outline" className="text-xs">
                            第{b.rankOrder}顺位
                          </Badge>
                        </div>
                        <span className="text-sm font-medium">{b.sharePercent}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Recent Payments */}
            {payments.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3">缴费记录</h3>
                <div className="rounded-card bg-secondary p-4">
                  <div className="space-y-2">
                    {payments.slice(0, 5).map((p) => (
                      <div key={p.id} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">第{p.periodNumber}期</span>
                          <span className="text-sm font-mono">{p.dueDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{formatCurrency(p.amount)}</span>
                          <Badge variant={p.status === "Paid" ? "success" : p.status === "Overdue" ? "destructive" : "secondary"}>
                            {p.status === "Paid" ? "已缴" : p.status === "Overdue" ? "逾期" : "待缴"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {policy.notes && (
              <div>
                <h3 className="text-sm font-medium mb-3">备注</h3>
                <div className="rounded-card bg-secondary p-4">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{policy.notes}</p>
                </div>
              </div>
            )}

            {/* Policy File */}
            {policy.policyFilePath && (
              <div>
                <h3 className="text-sm font-medium mb-3">保单文件</h3>
                <div className="rounded-card bg-secondary p-4">
                  <a
                    href={policy.policyFilePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    查看保单文件
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
