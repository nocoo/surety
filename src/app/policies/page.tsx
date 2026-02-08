"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Info, Check } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getAvatarColor } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PolicySheet } from "./policy-sheet";
import { PolicyDetailDialog } from "./policy-detail-dialog";

type PolicyStatus = "Active" | "Lapsed" | "Surrendered" | "Claimed";

interface Policy {
  id: number;
  policyNumber: string;
  productName: string;
  insurerName: string;
  insuredName: string;
  category: string;
  subCategory: string | null;
  status: PolicyStatus;
  premium: number;
  sumAssured: number;
  nextDueDate: string | null;
  effectiveDate: string;
  expiryDate: string | null;
  channel: string | null;
  archived: boolean | null;
}

const categoryLabels: Record<string, string> = {
  Life: "寿险",
  CriticalIllness: "重疾险",
  Medical: "医疗险",
  Accident: "意外险",
  Annuity: "年金险",
  Property: "财产险",
};

const categoryVariants: Record<string, "default" | "secondary" | "outline" | "info"> = {
  Life: "secondary",
  CriticalIllness: "default",
  Medical: "info",
  Accident: "outline",
  Annuity: "secondary",
  Property: "outline",
};

const statusConfig: Record<PolicyStatus, { label: string; variant: "success" | "secondary" | "warning" | "purple" }> = {
  Active: { label: "生效中", variant: "success" },
  Lapsed: { label: "已失效", variant: "secondary" },
  Surrendered: { label: "已退保", variant: "warning" },
  Claimed: { label: "已理赔", variant: "purple" },
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

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPolicyId, setDetailPolicyId] = useState<number | null>(null);

  const fetchPolicies = () => {
    fetch("/api/policies")
      .then((res) => res.json())
      .then((data: Policy[]) => {
        setPolicies(data.filter((p) => !p.archived));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleAdd = () => {
    setEditingPolicy(null);
    setSheetOpen(true);
  };

  const handleEdit = (policy: Policy) => {
    setEditingPolicy(policy);
    setSheetOpen(true);
  };

  const handleDelete = async (policy: Policy) => {
    if (!confirm(`确定要删除保单「${policy.productName}」吗？`)) return;

    try {
      const response = await fetch(`/api/policies/${policy.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error deleting policy:", error);
    }
  };

  const handleCopyPolicyNumber = async (policy: Policy) => {
    if (!policy.policyNumber) return;
    try {
      await navigator.clipboard.writeText(policy.policyNumber);
      setCopiedId(policy.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleViewDetail = (policy: Policy) => {
    setDetailPolicyId(policy.id);
    setDetailOpen(true);
  };

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: "保单" }]}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[{ label: "保单" }]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">全部保单</h1>
            <p className="text-sm text-muted-foreground">
              共 {policies.length} 份保单
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            添加保单
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">状态</TableHead>
                <TableHead className="w-[80px]">类型</TableHead>
                <TableHead>产品名称</TableHead>
                <TableHead>保险公司</TableHead>
                <TableHead>被保人</TableHead>
                <TableHead className="text-right">保额</TableHead>
                <TableHead className="text-right">年保费</TableHead>
                <TableHead className="font-mono">生效日期</TableHead>
                <TableHead className="w-[80px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => {
                const status = statusConfig[policy.status];
                const categoryLabel = categoryLabels[policy.category] ?? policy.category;
                const categoryVariant = categoryVariants[policy.category] ?? "outline";
                return (
                  <TableRow key={policy.id} className="hover:bg-muted/50">
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={categoryVariant}>{categoryLabel}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleViewDetail(policy)}
                          className="font-medium hover:text-primary hover:underline transition-colors text-left"
                        >
                          {policy.productName}
                        </button>
                        {policy.policyNumber && (
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleCopyPolicyNumber(policy)}
                                  className="inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                >
                                  {copiedId === policy.id ? (
                                    <Check className="h-3 w-3 text-success" />
                                  ) : (
                                    <Info className="h-3 w-3" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  {copiedId === policy.id ? "已复制!" : `保单号: ${policy.policyNumber}`}
                                </p>
                                {copiedId !== policy.id && (
                                  <p className="text-xs text-muted-foreground">点击复制</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {policy.insurerName}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className={cn("text-xs text-white", getAvatarColor(policy.insuredName ?? ""))}>
                            {policy.insuredName?.[0] ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{policy.insuredName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {policy.sumAssured > 0 ? formatCurrency(policy.sumAssured) : "-"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {policy.premium > 0 ? formatCurrency(policy.premium) : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {policy.effectiveDate}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(policy)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">编辑</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(policy)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">删除</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <PolicySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        policy={editingPolicy}
        onSuccess={fetchPolicies}
      />

      <PolicyDetailDialog
        policyId={detailPolicyId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </AppShell>
  );
}
