
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Trash2, Info, Check, List, LayoutGrid, LayoutList, Rows3, Rows4, Users, Plus, Paperclip, FileText, ImageIcon, AlertCircle, Shield } from "lucide-react";
import { AppShell } from "@/components/layout";
import { EmptyState } from "@/components/ui/empty-state";
import { TablePageSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, getAvatarColor } from "@/lib/utils";
import { getCategoryConfig } from "@surety/api/lib/category-config";
import { formatCurrency } from "@surety/api/lib/format";
import { getDaysFromToday, formatDaysFromToday } from "@surety/db/lib/date-utils";
import { statusConfig, categoryLabels } from "@/lib/constants/policy";
import type { PolicyStatus } from "@/lib/types/policy";
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
import {
  PolicyFilters,
  countActiveFilters,
  type PolicyFilterState,
} from "./policy-filters";
import { SortHeader } from "@/components/ui/sort-header";
import { AttachmentPreviewDialog } from "@/components/attachments/attachment-preview-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBytes, isImageContentType } from "@surety/api/lib/attachment-validation";
import type { Attachment } from "@surety/db/schema";


interface Policy {
  id: number;
  policyNumber: string;
  productName: string;
  insurerName: string;
  applicantName: string;
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
  notes: string | null;
  attachmentCount: number;
}

function getDaysUntil(dateStr: string | null): number | null {
  return getDaysFromToday(dateStr);
}

function formatDaysUntil(days: number | null): { text: string; variant: "default" | "warning" | "destructive" } {
  if (days === null) return { text: "-", variant: "default" };
  if (days < 0) return { text: `${Math.abs(days)}天前`, variant: "destructive" };
  if (days === 0) return { text: "今天", variant: "warning" };
  if (days <= 30) return { text: `${days}天后`, variant: "warning" };
  return { text: `${days}天后`, variant: "default" };
}

function PolicyMobileCard({
  policy,
  copied,
  onViewDetail,
  onCopyPolicyNumber,
  onDelete,
}: {
  policy: Policy;
  copied: boolean;
  onViewDetail: (policy: Policy) => void;
  onCopyPolicyNumber: (policy: Policy) => void;
  onDelete: (policy: Policy) => void;
}) {
  const status = statusConfig[policy.status];
  const categoryLabel = categoryLabels[policy.category] ?? policy.category;
  const categoryConfig = getCategoryConfig(policy.category);
  const dueState = formatDaysUntil(getDaysUntil(policy.nextDueDate));

  return (
    <div className="rounded-card bg-secondary p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge variant={categoryConfig.variant}>{categoryLabel}</Badge>
          </div>
          <button
            onClick={() => onViewDetail(policy)}
            className="text-left font-medium leading-6 hover:text-primary hover:underline"
          >
            {policy.productName}
          </button>
          <div className="text-sm text-muted-foreground">{policy.insurerName}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onCopyPolicyNumber(policy)}
          aria-label={copied ? "已复制保单号" : "复制保单号"}
        >
          {copied ? <Check className="h-4 w-4 text-success" /> : <Info className="h-4 w-4" />}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-muted-foreground">被保人</div>
          <div className="mt-1 flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className={cn("text-xs text-white", getAvatarColor(policy.insuredName ?? ""))}>
                {policy.insuredName?.[0] ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span>{policy.insuredName}</span>
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">投保人</div>
          <div className="mt-1">{policy.applicantName}</div>
        </div>
        <div>
          <div className="text-muted-foreground">保额</div>
          <div className="mt-1 font-medium">{policy.sumAssured > 0 ? formatCurrency(policy.sumAssured) : "-"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">年保费</div>
          <div className="mt-1">{policy.premium > 0 ? formatCurrency(policy.premium) : "-"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">下次缴费</div>
          <div className="mt-1 space-y-0.5">
            <div className="font-mono text-xs">{policy.nextDueDate ?? "-"}</div>
            {policy.nextDueDate && (
              <div
                className={cn(
                  "text-xs",
                  dueState.variant === "warning" && "text-warning-text",
                  dueState.variant === "destructive" && "text-destructive-text",
                  dueState.variant === "default" && "text-muted-foreground"
                )}
              >
                {dueState.text}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onViewDetail(policy)}>
          <Info className="mr-1.5 h-4 w-4" />
          详情
        </Button>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(policy)}>
          <Trash2 className="mr-1.5 h-4 w-4" />
          删除
        </Button>
      </div>
    </div>
  );
}

type SortField = "category" | "productName" | "insurerName" | "insuredName" | "applicantName" | "sumAssured" | "premium" | "effectiveDate" | "nextDueDate";
type SortDirection = "asc" | "desc";

/**
 * Visual density of the "list" view.
 * - cards: card-per-row (was the mobile layout) — most information,
 *   easiest to scan, takes more vertical space. Default on mobile.
 * - comfortable: the original ~13-column table — most information per
 *   row at the cost of horizontal density. Default on desktop.
 * - compact: same table but with reduced cell padding for users who
 *   want to see more rows on screen.
 */
type ListDensity = "cards" | "comfortable" | "compact";
type ViewMode = "list" | "byCategory" | "byInsured";

export default function PoliciesPage() {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<Policy | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [previewPolicyId, setPreviewPolicyId] = useState<number | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [pickerAttachments, setPickerAttachments] = useState<Attachment[]>([]);
  const [pickerPolicyId, setPickerPolicyId] = useState<number | null>(null);

  // Filter state (persisted to localStorage). Kept as 5 separate keys
  // for backward compatibility with existing users' localStorage; bundled
  // into a single PolicyFilterState object below for the PolicyFilters
  // component, which is the only place the app reads the filter shape.
  const [filterInsured, setFilterInsured] = usePersistedState<string>("surety-filter-insured", "all");
  const [filterApplicant, setFilterApplicant] = usePersistedState<string>("surety-filter-applicant", "all");
  const [filterCategory, setFilterCategory] = usePersistedState<string>("surety-filter-category", "all");
  const [filterAsset, setFilterAsset] = usePersistedState<string>("surety-filter-asset", "all");
  const [filterStatus, setFilterStatus] = usePersistedState<string>("surety-filter-status-v2", "all");

  const filters: PolicyFilterState = {
    applicant: filterApplicant,
    insured: filterInsured,
    category: filterCategory,
    asset: filterAsset,
    status: filterStatus,
  };

  const handleFiltersChange = (next: PolicyFilterState) => {
    setFilterApplicant(next.applicant);
    setFilterInsured(next.insured);
    setFilterCategory(next.category);
    setFilterAsset(next.asset);
    setFilterStatus(next.status);
  };

  // View mode state (persisted to localStorage)
  const [viewMode, setViewMode] = usePersistedState<ViewMode>("surety-view-mode", "list");
  const [listDensity, setListDensity] = usePersistedState<ListDensity>(
    "surety-list-density",
    "comfortable",
  );

  // Sort state (persisted to localStorage)
  const [sortField, setSortField] = usePersistedState<SortField>("surety-sort-field", "insuredName");
  const [sortDirection, setSortDirection] = usePersistedState<SortDirection>("surety-sort-direction", "asc");

  const fetchPolicies = () => {
    fetch("/api/policies")
      .then((res) => {
        if (!res.ok) throw new Error("FETCH_FAILED");
        return res.json();
      })
      .then((data: Policy[]) => {
        setPolicies(data);
        setError(null);
        setLoading(false);
      })
      .catch(() => {
        setError("加载保单列表失败，请刷新页面重试");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  // Get unique insured names and categories for filter options
  const insuredNames = useMemo(() => {
    const names = new Set(policies.map((p) => p.insuredName));
    return Array.from(names).sort();
  }, [policies]);

  const applicantNames = useMemo(() => {
    const names = new Set(policies.map((p) => p.applicantName));
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

  // Get unique statuses for filter options
  const statuses = useMemo(() => {
    const s = new Set(policies.map((p) => p.status));
    return Array.from(s);
  }, [policies]);

  // Filter and sort policies
  const filteredPolicies = useMemo(() => {
    let result = [...policies];

    // Apply filters
    if (filterInsured !== "all") {
      result = result.filter((p) => p.insuredName === filterInsured);
    }
    if (filterApplicant !== "all") {
      result = result.filter((p) => p.applicantName === filterApplicant);
    }
    if (filterCategory !== "all") {
      result = result.filter((p) => p.category === filterCategory);
    }
    if (filterAsset !== "all") {
      result = result.filter((p) => p.insuredAssetName === filterAsset);
    }
    if (filterStatus !== "all") {
      result = result.filter((p) => p.status === filterStatus);
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
        case "applicantName":
          comparison = a.applicantName.localeCompare(b.applicantName, "zh-CN");
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
  }, [policies, filterInsured, filterApplicant, filterCategory, filterAsset, filterStatus, sortField, sortDirection]);

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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field as SortField);
      setSortDirection("desc");
    }
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
        setActionError(null);
        setDeleteDialogOpen(false);
        setPolicyToDelete(null);
        fetchPolicies();
      } else {
        const data = await response.json().catch(() => null);
        setActionError(data?.error ?? "删除保单失败，请重试");
      }
    } catch {
      setActionError("网络异常，请检查连接后重试");
    }
  };

  const handleCopyPolicyNumber = async (policy: Policy) => {
    if (!policy.policyNumber) return;
    try {
      await navigator.clipboard.writeText(policy.policyNumber);
      setCopiedId(policy.id);
      setActionError(null);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      setActionError("复制保单号失败，请手动复制");
    }
  };

  const handleViewDetail = (policy: Policy) => {
    navigate(`/policies/${policy.id}`);
  };

  const handlePreviewAttachment = async (policy: Policy) => {
    try {
      const res = await fetch(`/api/policies/${policy.id}/attachments`);
      if (!res.ok) return;
      const attachments: Attachment[] = await res.json();
      if (attachments.length === 0) return;

      if (attachments.length === 1) {
        const first = attachments[0];
        if (first) {
          setPreviewPolicyId(policy.id);
          setPreviewAttachment(first);
        }
      } else {
        // Multiple attachments — show picker dialog
        setPickerPolicyId(policy.id);
        setPickerAttachments(attachments);
      }
    } catch {
      // Silently fail
    }
  };

  if (loading) {
    return (
      <AppShell breadcrumbs={[{ label: "保单" }]}>
        <TablePageSkeleton rows={10} />
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell breadcrumbs={[{ label: "保单" }]}>
        <div className="rounded-card bg-secondary p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
          <h3 className="mt-4 text-lg font-medium">加载失败</h3>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
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
              {countActiveFilters(filters) > 0 &&
                ` (已筛选，共 ${policies.length} 份)`
              }
            </p>
          </div>
          <Button onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            新增保单
          </Button>
        </div>

        {/* Filter Area */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PolicyFilters
            filters={filters}
            onChange={handleFiltersChange}
            options={{
              applicantNames,
              insuredNames,
              categories,
              assetNames,
              statuses,
            }}
          />
          <div className="flex items-center gap-2">
            {/*
             * Density toggle — only meaningful for the flat list view, and
             * only on sm+ widths. Below sm the layout is pinned to cards
             * regardless of listDensity (the table has no chance at narrow
             * widths), so showing the toggle there would let users select
             * "comfortable"/"compact" and see no change.
             */}
            {viewMode === "list" && (
              <ToggleGroup
                type="single"
                value={listDensity}
                onValueChange={(v) => v && setListDensity(v as ListDensity)}
                aria-label="列表密度"
                className="hidden sm:flex"
              >
                <ToggleGroupItem value="cards" aria-label="卡片视图">
                  <LayoutList className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="comfortable" aria-label="舒适表格">
                  <Rows3 className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="compact" aria-label="紧凑表格">
                  <Rows4 className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            )}
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as ViewMode)}
              aria-label="视图模式"
            >
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
        </div>

        {/* Empty State */}
        {policies.length === 0 && (
          <EmptyState
            icon={Shield}
            title="还没有保单"
            description="为家人守护从录入第一份保单开始 —— 健康险、寿险、车险、房屋险都可以在这里集中管理"
            action={
              <Button onClick={() => setSheetOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                新增第一份保单
              </Button>
            }
          />
        )}

        {/* List View */}
        {viewMode === "list" && policies.length > 0 && (
          <>
            {/*
             * Mobile (<sm) always uses cards — table has no chance at
             * narrow widths. Above sm, the user's chosen listDensity
             * decides whether the cards layout continues or a table
             * (comfortable / compact) takes over.
             */}
            {(listDensity === "cards") ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredPolicies.map((policy) => (
                  <PolicyMobileCard
                    key={policy.id}
                    policy={policy}
                    copied={copiedId === policy.id}
                    onViewDetail={handleViewDetail}
                    onCopyPolicyNumber={handleCopyPolicyNumber}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-3 sm:hidden">
                  {filteredPolicies.map((policy) => (
                    <PolicyMobileCard
                      key={policy.id}
                      policy={policy}
                      copied={copiedId === policy.id}
                      onViewDetail={handleViewDetail}
                      onCopyPolicyNumber={handleCopyPolicyNumber}
                      onDelete={handleDeleteClick}
                    />
                  ))}
                </div>

                <div
                  className={cn(
                    "hidden rounded-card bg-secondary sm:block",
                    listDensity === "compact" && "[&_td]:py-1 [&_th]:h-9"
                  )}
                >
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">状态</TableHead>
                  <SortHeader label="类型" sortKey="category" currentSort={sortField} currentDir={sortDirection} onSort={handleSort} className="w-[90px]" />
                  <SortHeader label="产品名称" sortKey="productName" currentSort={sortField} currentDir={sortDirection} onSort={handleSort} />
                  <SortHeader label="保险公司" sortKey="insurerName" currentSort={sortField} currentDir={sortDirection} onSort={handleSort} />
                  <SortHeader label="投保人" sortKey="applicantName" currentSort={sortField} currentDir={sortDirection} onSort={handleSort} />
                  <SortHeader label="被保人" sortKey="insuredName" currentSort={sortField} currentDir={sortDirection} onSort={handleSort} />
                  <SortHeader label="保额" sortKey="sumAssured" currentSort={sortField} currentDir={sortDirection} onSort={handleSort} className="text-right" />
                  <SortHeader label="年保费" sortKey="premium" currentSort={sortField} currentDir={sortDirection} onSort={handleSort} className="text-right" />
                  <SortHeader label="生效日期" sortKey="effectiveDate" currentSort={sortField} currentDir={sortDirection} onSort={handleSort} />
                  <SortHeader label="下次缴费" sortKey="nextDueDate" currentSort={sortField} currentDir={sortDirection} onSort={handleSort} />
                  <TableHead className="hidden xl:table-cell">备注</TableHead>
                  <TableHead className="w-[50px]">附件</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPolicies.map((policy) => {
                  const status = statusConfig[policy.status];
                  const categoryLabel = categoryLabels[policy.category] ?? policy.category;
                  const categoryConfig = getCategoryConfig(policy.category);
                  return (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={categoryConfig.variant}>
                          {categoryLabel}
                        </Badge>
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
                            <AvatarFallback className={cn("text-xs text-white", getAvatarColor(policy.applicantName ?? ""))}>
                              {policy.applicantName?.[0] ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{policy.applicantName}</span>
                        </div>
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
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-sm">{policy.effectiveDate}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDaysFromToday(getDaysFromToday(policy.effectiveDate)) ?? ""}
                          </span>
                        </div>
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
                                  variant === "warning" && "text-warning-text",
                                  variant === "destructive" && "text-destructive-text",
                                  variant === "default" && "text-muted-foreground"
                                )}>
                                  {text}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {policy.notes ? (
                          <span className="text-sm text-muted-foreground whitespace-normal">{policy.notes}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {policy.attachmentCount > 0 && (
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handlePreviewAttachment(policy)}
                                  className="inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                >
                                  <Paperclip className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{policy.attachmentCount} 个附件，点击预览</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
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
                                  onClick={() => handleViewDetail(policy)}
                                >
                                  <Info className="h-4 w-4" />
                                  <span className="sr-only">查看详情</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">查看详情</p>
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
              </>
            )}
          </>
        )}

        {/* Grouped Views */}
        {(viewMode === "byCategory" || viewMode === "byInsured") && policies.length > 0 && (
          <div className="space-y-6">
            {(viewMode === "byCategory" ? policiesByCategory : policiesByInsured).map(([groupKey, groupPolicies]) => {
              const groupLabel = viewMode === "byCategory" 
                ? (categoryLabels[groupKey] ?? groupKey)
                : groupKey;
              const totalPremium = groupPolicies.reduce((sum, p) => sum + p.premium, 0);
              const totalSumAssured = groupPolicies.reduce((sum, p) => sum + p.sumAssured, 0);
              
              return (
                <div key={groupKey} className="rounded-card bg-secondary">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
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
                  <div className="divide-y divide-border/50">
                    {groupPolicies.map((policy) => {
                      const status = statusConfig[policy.status];
                      const categoryLabel = categoryLabels[policy.category] ?? policy.category;
                      const categoryConfig = getCategoryConfig(policy.category);
                      return (
                        <div key={policy.id} className="flex items-center justify-between px-4 py-3 hover:bg-background/50 transition-colors">
                          <div className="flex items-center gap-4">
                            <Badge variant={status.variant}>{status.label}</Badge>
                            {viewMode === "byInsured" && (
                              <Badge variant={categoryConfig.variant}>
                                {categoryLabel}
                              </Badge>
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

        {actionError && (
          <div className="rounded-widget border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {actionError}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setActionError(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除保单「{policyToDelete?.productName}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{actionError}</span>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} variant="destructive">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PolicySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={fetchPolicies}
      />

      <AttachmentPreviewDialog
        attachment={previewAttachment}
        policyId={previewPolicyId ?? 0}
        open={previewAttachment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewAttachment(null);
            setPreviewPolicyId(null);
          }
        }}
      />

      {/* Attachment picker dialog — shown when policy has 2+ attachments */}
      <Dialog
        open={pickerAttachments.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setPickerAttachments([]);
            setPickerPolicyId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>选择附件预览</DialogTitle>
          </DialogHeader>
          <ul className="divide-y divide-border/50 max-h-[60vh] overflow-y-auto">
            {pickerAttachments.map((att) => (
              <li key={att.id}>
                <button
                  className="flex w-full items-center gap-3 px-2 py-3 hover:bg-background/50 rounded transition-colors text-left"
                  onClick={() => {
                    setPreviewPolicyId(pickerPolicyId);
                    setPreviewAttachment(att);
                    setPickerAttachments([]);
                    setPickerPolicyId(null);
                  }}
                >
                  {isImageContentType(att.contentType) ? (
                    <ImageIcon className="h-5 w-5 text-info shrink-0" />
                  ) : (
                    <FileText className="h-5 w-5 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{att.filename}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(att.size)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
