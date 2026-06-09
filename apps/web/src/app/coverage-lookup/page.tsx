
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { Users, Building2, Phone, Copy, Check } from "lucide-react";
import { AppShell } from "@/components/layout";
import { CoverageLookupSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MemberSelector, AssetSelector, CategorySection } from "@/components/coverage-lookup";
import {
  fetchCoverageLookupData,
  groupPoliciesByCategory,
  type CoverageLookupData,
  type SelectionType,
  type CategoryGroup,
} from "@surety/api/coverage-lookup";
import { cn } from "@/lib/utils";
import { buildEmergencyContacts, buildCoverageClipboardText } from "./emergency";
import { readCoverageDeepLink } from "./deep-link";

const breadcrumbs = [{ label: "保障速查" }];

export default function CoverageLookupPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = useMemo(() => readCoverageDeepLink(searchParams), []);
  // ^ intentionally only on mount — see useEffect below for follow-up
  // navigations (e.g. user clicks a different palette item without
  // unmounting the page).

  const [data, setData] = useState<CoverageLookupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectionType, setSelectionType] = useState<SelectionType>(initial.type);
  const [selectedId, setSelectedId] = useState<number | null>(initial.id);
  const [showInactive, setShowInactive] = useState(false);

  // Filter category groups based on showInactive toggle
  const filteredGroups: CategoryGroup[] = useMemo(() => {
    if (!data) return [];
    if (showInactive) return data.categoryGroups;
    const activeOnly = data.categoryGroups
      .map((g) => g.policies.filter((p) => p.isActive))
      .flat();
    return groupPoliciesByCategory(activeOnly);
  }, [data, showInactive]);

  // Count inactive policies across all groups
  const inactiveCount = useMemo(() => {
    if (!data) return 0;
    return data.categoryGroups
      .flatMap((g) => g.policies)
      .filter((p) => !p.isActive).length;
  }, [data]);

  const loadData = useCallback(async (type: SelectionType, id?: number) => {
    try {
      setLoading(true);
      const result = await fetchCoverageLookupData(type, id);
      setData(result);
      // Set initial selected ID if not specified
      if (id === undefined) {
        if (type === "member" && result.selectedMember) {
          setSelectedId(result.selectedMember.id);
        } else if (type === "asset" && result.selectedAsset) {
          setSelectedId(result.selectedAsset.id);
        }
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount + whenever the URL deep-link changes (palette / link).
  // selectionType+selectedId are kept in sync with `searchParams` here so
  // the back/forward buttons restore the previous subject correctly.
  useEffect(() => {
    const next = readCoverageDeepLink(searchParams);
    setSelectionType(next.type);
    setSelectedId(next.id);
    if (next.id != null) {
      loadData(next.type, next.id);
    } else {
      loadData(next.type);
    }
  }, [loadData, searchParams]);

  /**
   * Single source of truth for "which subject is selected": the URL.
   * Both type-switch and member/asset-pick paths call this so the deep
   * link stays valid for sharing and back-button.
   */
  const writeDeepLink = useCallback(
    (type: SelectionType, id: number | null) => {
      const next = new URLSearchParams(searchParams);
      next.delete("member");
      next.delete("asset");
      if (id != null) next.set(type, String(id));
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleSwitchType = (type: SelectionType) => {
    if (type !== selectionType) {
      writeDeepLink(type, null);
    }
  };

  const handleSelectMember = (memberId: number) => {
    writeDeepLink("member", memberId);
  };

  const handleSelectAsset = (assetId: number) => {
    writeDeepLink("asset", assetId);
  };

  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const subjectLabel = useMemo(() => {
    if (!data) return "";
    if (selectionType === "member") {
      return data.selectedMember?.name ?? "家庭成员";
    }
    return data.selectedAsset?.name ?? "资产";
  }, [data, selectionType]);

  const emergencyContacts = useMemo(
    () => (data ? buildEmergencyContacts(data.categoryGroups) : []),
    [data],
  );

  const handleCopyAll = useCallback(async () => {
    if (!data) return;
    const text = buildCoverageClipboardText(subjectLabel, data.categoryGroups);
    try {
      await navigator.clipboard.writeText(text);
      setCopyError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("复制失败，请手动选择文本");
    }
  }, [data, subjectLabel]);

  if (loading && !data) {
    return (
      <AppShell breadcrumbs={breadcrumbs}>
        <CoverageLookupSkeleton />
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">{error ?? "加载失败"}</div>
        </div>
      </AppShell>
    );
  }

  const hasMembers = data.members.length > 0;
  const hasAssets = data.assets.length > 0;

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">保障速查</h1>
            <p className="text-sm text-muted-foreground">
              快速查看家庭成员和资产的保障信息，紧急情况下快速定位联系方式
            </p>
          </div>
          {data.categoryGroups.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAll}
              className="gap-1.5 self-start"
              disabled={!subjectLabel}
            >
              {copied ? <Check className="h-4 w-4 text-success-text" /> : <Copy className="h-4 w-4" />}
              {copied ? "已复制全部信息" : "复制全部信息"}
            </Button>
          )}
        </div>
        {copyError && (
          <p className="-mt-4 text-sm text-destructive-text" role="alert">
            {copyError}
          </p>
        )}

        {/* Type Switcher — larger segmented control: emergency UX should
            offer fingers-not-thumbs hit targets. */}
        <div
          role="tablist"
          aria-label="选择速查对象"
          className="inline-flex rounded-card bg-secondary p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectionType === "member"}
            onClick={() => handleSwitchType("member")}
            className={cn(
              "inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-base font-medium transition-colors",
              selectionType === "member"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="h-5 w-5" />
            家庭成员
            {hasMembers && (
              <span className="text-sm opacity-70">({data.members.length})</span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={selectionType === "asset"}
            onClick={() => handleSwitchType("asset")}
            className={cn(
              "inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-base font-medium transition-colors",
              selectionType === "asset"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Building2 className="h-5 w-5" />
            资产
            {hasAssets && (
              <span className="text-sm opacity-70">({data.assets.length})</span>
            )}
          </button>
        </div>

        {/* Selector based on type */}
        {selectionType === "member" ? (
          <MemberSelector
            members={data.members}
            selectedMemberId={selectedId}
            onSelectMember={handleSelectMember}
          />
        ) : (
          <AssetSelector
            assets={data.assets}
            selectedAssetId={selectedId}
            onSelectAsset={handleSelectAsset}
          />
        )}

        {/*
         * Emergency contact block — collected from every active policy's
         * insurerPhone for the current subject, deduped by (insurer, phone).
         * Big tap targets, tel: links so it works on phones. Rendered
         * before the category sections so a panicking user sees the phone
         * numbers without scrolling.
         */}
        {emergencyContacts.length > 0 && (
          <section
            aria-label="紧急联系电话"
            className="rounded-card border border-primary/30 bg-primary/5 p-4 sm:p-5"
          >
            <header className="mb-3 flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold">紧急联系电话</h2>
              <span className="text-xs text-muted-foreground">
                · 保险公司客服，可直接拨打
              </span>
            </header>
            <ul className="grid gap-2 sm:grid-cols-2">
              {emergencyContacts.map((c) => (
                <li key={`${c.insurerName}-${c.phone}`}>
                  <a
                    href={`tel:${c.phone}`}
                    className="flex items-center justify-between gap-3 rounded-widget bg-background px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <span className="text-sm font-medium truncate">
                      {c.insurerName}
                    </span>
                    <span className="font-mono text-lg font-semibold tabular-nums text-primary">
                      {c.phone}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Category Sections */}
        {data.categoryGroups.length > 0 ? (
          <div className="space-y-6">
            {/* Inactive filter toggle */}
            {inactiveCount > 0 && (
              <div className="flex items-center gap-2">
                <Switch
                  id="show-inactive"
                  checked={showInactive}
                  onCheckedChange={setShowInactive}
                />
                <label
                  htmlFor="show-inactive"
                  className="text-sm text-muted-foreground select-none cursor-pointer"
                >
                  显示已过期/退保 ({inactiveCount})
                </label>
              </div>
            )}

            {filteredGroups.length > 0 ? (
              filteredGroups.map((group) => (
                <CategorySection
                  key={group.category}
                  categoryLabel={group.categoryLabel}
                  categoryVariant={group.categoryVariant}
                  policies={group.policies}
                  totalSumAssured={group.totalSumAssured}
                />
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>所有保单均已过期或退保</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            {selectionType === "member" ? (
              data.selectedMember ? (
                <p>{data.selectedMember.name} 暂无保单记录</p>
              ) : (
                <p>请选择一位家庭成员查看保障信息</p>
              )
            ) : (
              data.selectedAsset ? (
                <p>{data.selectedAsset.name} 暂无保单记录</p>
              ) : (
                <p>请选择一项资产查看保障信息</p>
              )
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
