"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Trash2, Info, Check, ArrowUpDown, ArrowUp, ArrowDown, Receipt, List, LayoutGrid, Users } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getAvatarColor, getBadgeColor } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PolicySheet } from "./policy-sheet";
import { PolicyDetailDialog } from "./policy-detail-dialog";
import { PaymentsDialog } from "./payments-dialog";

type PolicyStatus = "Active" | "Lapsed" | "Surrendered" | "Claimed";

interface Policy {
  id: number;
  policyNumber: string;
  productName: string;
  insurerName: string;
  insuredName: string;
  insuredAssetId: number | null;
  insuredAssetName: string | null;
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

function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);
  const diffTime = targetDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function formatDaysUntil(days: number | null): { text: string; variant: "default" | "warning" | "destructive" } {
  if (days === null) return { text: "-", variant: "default" };
  if (days < 0) return { text: `已过期 ${Math.abs(days)} 天`, variant: "destructive" };
  if (days === 0) return { text: "今天", variant: "warning" };
  if (days <= 30) return { text: `${days} 天`, variant: "warning" };
  return { text: `${days} 天`, variant: "default" };
}

type SortField = "category" | "productName" | "insurerName" | "insuredName" | "sumAssured" | "premium" | "effectiveDate" | "nextDueDate";
type SortDirection = "asc" | "desc";
type ViewMode = "list" | "byCategory" | "byInsured";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPolicyId, setDetailPolicyId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<Policy | null>(null);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [paymentsPolicyId, setPaymentsPolicyId] = useState<number | null>(null);
  const [paymentsProductName, setPaymentsProductName] = useState<string>("");

  // Filter state
  const [filterInsured, setFilterInsured] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterAsset, setFilterAsset] = useState<string>("all");

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Sort state
  const [sortField, setSortField] = useState<SortField>("insuredName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

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

  // Get unique insured names and categories for filter options
  const insuredNames = useMemo(() => {
    const names = new Set(policies.map((p) => p.insuredName));
    return Array.from(names).sort();
  }, [policies]);

  const categories = useMemo(() => {
    const cats = new Set(policies.map((p) => p.category));
    return Array.from(cats);
  }, [policies]);

  // Get unique asset names for filter options (only assets that have policies)
  const assetNames = useMemo(() => {
    const names = new Set(
      policies
        .filter((p) => p.insuredAssetName)
        .map((p) => p.insuredAssetName as string)
    );
    return Array.from(names).sort();
  }, [policies]);

  // Filter and sort policies
  const filteredPolicies = useMemo(() => {
    let result = [...policies];

    // Apply filters
    if (filterInsured !== "all") {
      result = result.filter((p) => p.insuredName === filterInsured);
    }
    if (filterCategory !== "all") {
      result = result.filter((p) => p.category === filterCategory);
    }
    if (filterAsset !== "all") {
      result = result.filter((p) => p.insuredAssetName === filterAsset);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "category":
          comparison = a.category.localeCompare(b.category, "zh-CN");
          break;
        case "productName":
          comparison = a.productName.localeCompare(b.productName, "zh-CN");
          break;
        case "insurerName":
          comparison = a.insurerName.localeCompare(b.insurerName, "zh-CN");
          break;
        case "insuredName":
          comparison = a.insuredName.localeCompare(b.insuredName, "zh-CN");
          break;
        case "sumAssured":
          comparison = a.sumAssured - b.sumAssured;
          break;
        case "premium":
          comparison = a.premium - b.premium;
          break;
        case "effectiveDate":
          comparison = a.effectiveDate.localeCompare(b.effectiveDate);
          break;
        case "nextDueDate":
          comparison = (a.nextDueDate ?? "").localeCompare(b.nextDueDate ?? "");
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [policies, filterInsured, filterCategory, filterAsset, sortField, sortDirection]);

  // Group policies by category
  const policiesByCategory = useMemo(() => {
    const groups = new Map<string, Policy[]>();
    for (const policy of filteredPolicies) {
      const existing = groups.get(policy.category) ?? [];
      existing.push(policy);
      groups.set(policy.category, existing);
    }
    // Sort by category name
    return Array.from(groups.entries()).sort((a, b) => 
      (categoryLabels[a[0]] ?? a[0]).localeCompare(categoryLabels[b[0]] ?? b[0], "zh-CN")
    );
  }, [filteredPolicies]);

  // Group policies by insured name
  const policiesByInsured = useMemo(() => {
    const groups = new Map<string, Policy[]>();
    for (const policy of filteredPolicies) {
      const existing = groups.get(policy.insuredName) ?? [];
      existing.push(policy);
      groups.set(policy.insuredName, existing);
    }
    // Sort by name
    return Array.from(groups.entries()).sort((a, b) => 
      a[0].localeCompare(b[0], "zh-CN")
    );
  }, [filteredPolicies]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  };

  const handleAdd = () => {
    setEditingPolicy(null);
    setSheetOpen(true);
  };

  const handleEdit = (policy: Policy) => {
    setEditingPolicy(policy);
    setSheetOpen(true);
  };

  const handleDeleteClick = (policy: Policy) => {
    setPolicyToDelete(policy);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!policyToDelete) return;

    try {
      const response = await fetch(`/api/policies/${policyToDelete.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error deleting policy:", error);
    }
    setDeleteDialogOpen(false);
    setPolicyToDelete(null);
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

  const handleViewPayments = (policy: Policy) => {
    setPaymentsPolicyId(policy.id);
    setPaymentsProductName(policy.productName);
    setPaymentsOpen(true);
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
              共 {filteredPolicies.length} 份保单
              {(filterInsured !== "all" || filterCategory !== "all") && 
                ` (已筛选，共 ${policies.length} 份)`
              }
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            添加保单
          </Button>
        </div>

        {/* Filter Area */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">被保人:</span>
              <Select value={filterInsured} onValueChange={setFilterInsured}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {insuredNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">类型:</span>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {categoryLabels[cat] ?? cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {assetNames.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">资产:</span>
                <Select value={filterAsset} onValueChange={setFilterAsset}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {assetNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(filterInsured !== "all" || filterCategory !== "all" || filterAsset !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterInsured("all");
                  setFilterCategory("all");
                  setFilterAsset("all");
                }}
              >
                清除筛选
              </Button>
            )}
          </div>
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)}>
            <ToggleGroupItem value="list" aria-label="列表视图">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="byCategory" aria-label="按类型分组">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="byInsured" aria-label="按被保人分组">
              <Users className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* List View */}
        {viewMode === "list" && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">状态</TableHead>
                  <TableHead className="w-[90px]">
                    <button
                      onClick={() => handleSort("category")}
                      className="inline-flex items-center hover:text-foreground transition-colors"
                    >
                      类型
                      {renderSortIcon("category")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("productName")}
                      className="inline-flex items-center hover:text-foreground transition-colors"
                    >
                      产品名称
                      {renderSortIcon("productName")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("insurerName")}
                      className="inline-flex items-center hover:text-foreground transition-colors"
                    >
                      保险公司
                      {renderSortIcon("insurerName")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("insuredName")}
                      className="inline-flex items-center hover:text-foreground transition-colors"
                    >
                      被保人
                      {renderSortIcon("insuredName")}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      onClick={() => handleSort("sumAssured")}
                      className="inline-flex items-center justify-end w-full hover:text-foreground transition-colors"
                    >
                      保额
                      {renderSortIcon("sumAssured")}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      onClick={() => handleSort("premium")}
                      className="inline-flex items-center justify-end w-full hover:text-foreground transition-colors"
                    >
                      年保费
                      {renderSortIcon("premium")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("effectiveDate")}
                      className="inline-flex items-center hover:text-foreground transition-colors font-mono"
                    >
                      生效日期
                      {renderSortIcon("effectiveDate")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("nextDueDate")}
                      className="inline-flex items-center hover:text-foreground transition-colors"
                    >
                      下次缴费
                      {renderSortIcon("nextDueDate")}
                    </button>
                  </TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPolicies.map((policy) => {
                  const status = statusConfig[policy.status];
                  const categoryLabel = categoryLabels[policy.category] ?? policy.category;
                  const badgeColor = getBadgeColor(categoryLabel);
                  return (
                    <TableRow key={policy.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium border",
                          badgeColor.bg,
                          badgeColor.text,
                          badgeColor.border
                        )}>
                          {categoryLabel}
                        </span>
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
                        {(() => {
                          const days = getDaysUntil(policy.nextDueDate);
                          const { text, variant } = formatDaysUntil(days);
                          return (
                            <div className="flex flex-col">
                              <span className="font-mono text-sm">{policy.nextDueDate ?? "-"}</span>
                              {policy.nextDueDate && (
                                <span className={cn(
                                  "text-xs",
                                  variant === "warning" && "text-warning",
                                  variant === "destructive" && "text-destructive",
                                  variant === "default" && "text-muted-foreground"
                                )}>
                                  {text}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleViewPayments(policy)}
                                >
                                  <Receipt className="h-4 w-4" />
                                  <span className="sr-only">缴费记录</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">缴费记录</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEdit(policy)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">编辑</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">编辑</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteClick(policy)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">删除</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">删除</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Grouped Views */}
        {(viewMode === "byCategory" || viewMode === "byInsured") && (
          <div className="space-y-6">
            {(viewMode === "byCategory" ? policiesByCategory : policiesByInsured).map(([groupKey, groupPolicies]) => {
              const groupLabel = viewMode === "byCategory" 
                ? (categoryLabels[groupKey] ?? groupKey)
                : groupKey;
              const totalPremium = groupPolicies.reduce((sum, p) => sum + p.premium, 0);
              const totalSumAssured = groupPolicies.reduce((sum, p) => sum + p.sumAssured, 0);
              
              return (
                <div key={groupKey} className="rounded-lg border">
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b">
                    <div className="flex items-center gap-3">
                      {viewMode === "byInsured" && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={cn("text-sm text-white", getAvatarColor(groupKey))}>
                            {groupKey[0]}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div>
                        <h3 className="font-medium">{groupLabel}</h3>
                        <p className="text-xs text-muted-foreground">
                          {groupPolicies.length} 份保单
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <div className="text-muted-foreground">总保额</div>
                        <div className="font-medium">{formatCurrency(totalSumAssured)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-muted-foreground">年保费</div>
                        <div className="font-medium">{formatCurrency(totalPremium)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y">
                    {groupPolicies.map((policy) => {
                      const status = statusConfig[policy.status];
                      const categoryLabel = categoryLabels[policy.category] ?? policy.category;
                      const badgeColor = getBadgeColor(categoryLabel);
                      return (
                        <div key={policy.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                          <div className="flex items-center gap-4">
                            <Badge variant={status.variant}>{status.label}</Badge>
                            {viewMode === "byInsured" && (
                              <span className={cn(
                                "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium border",
                                badgeColor.bg,
                                badgeColor.text,
                                badgeColor.border
                              )}>
                                {categoryLabel}
                              </span>
                            )}
                            {viewMode === "byCategory" && (
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className={cn("text-xs text-white", getAvatarColor(policy.insuredName ?? ""))}>
                                    {policy.insuredName?.[0] ?? "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-muted-foreground">{policy.insuredName}</span>
                              </div>
                            )}
                            <div>
                              <button
                                onClick={() => handleViewDetail(policy)}
                                className="font-medium hover:text-primary hover:underline transition-colors text-left"
                              >
                                {policy.productName}
                              </button>
                              <div className="text-xs text-muted-foreground">{policy.insurerName}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="font-medium">{formatCurrency(policy.sumAssured)}</div>
                              <div className="text-xs text-muted-foreground">{formatCurrency(policy.premium)}/年</div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEdit(policy)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteClick(policy)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

      <PaymentsDialog
        policyId={paymentsPolicyId}
        productName={paymentsProductName}
        open={paymentsOpen}
        onOpenChange={setPaymentsOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除保单「{policyToDelete?.productName}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
