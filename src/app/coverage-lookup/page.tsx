"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Building2 } from "lucide-react";
import { AppShell } from "@/components/layout";
import LoadingScreen from "@/components/loading-screen";
import { Button } from "@/components/ui/button";
import { MemberSelector, AssetSelector, CategorySection } from "@/components/coverage-lookup";
import {
  fetchCoverageLookupData,
  type CoverageLookupData,
  type SelectionType,
} from "@/lib/coverage-lookup-vm";
import { cn } from "@/lib/utils";

const breadcrumbs = [{ label: "保障速查" }];

export default function CoverageLookupPage() {
  const [data, setData] = useState<CoverageLookupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectionType, setSelectionType] = useState<SelectionType>("member");
  const [selectedId, setSelectedId] = useState<number | null>(null);

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

  useEffect(() => {
    loadData(selectionType);
  }, [loadData, selectionType]);

  const handleSwitchType = (type: SelectionType) => {
    if (type !== selectionType) {
      setSelectionType(type);
      setSelectedId(null);
    }
  };

  const handleSelectMember = (memberId: number) => {
    setSelectedId(memberId);
    loadData("member", memberId);
  };

  const handleSelectAsset = (assetId: number) => {
    setSelectedId(assetId);
    loadData("asset", assetId);
  };

  if (loading && !data) {
    return <LoadingScreen />;
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">保障速查</h1>
          <p className="text-sm text-muted-foreground">
            快速查看家庭成员和资产的保障信息，紧急情况下快速定位联系方式
          </p>
        </div>

        {/* Type Switcher */}
        <div className="flex gap-2">
          <Button
            variant={selectionType === "member" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSwitchType("member")}
            className={cn(
              "gap-2",
              selectionType === "member" && "pointer-events-none"
            )}
          >
            <Users className="h-4 w-4" />
            家庭成员
            {hasMembers && (
              <span className="ml-1 text-xs opacity-70">({data.members.length})</span>
            )}
          </Button>
          <Button
            variant={selectionType === "asset" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSwitchType("asset")}
            className={cn(
              "gap-2",
              selectionType === "asset" && "pointer-events-none"
            )}
          >
            <Building2 className="h-4 w-4" />
            资产
            {hasAssets && (
              <span className="ml-1 text-xs opacity-70">({data.assets.length})</span>
            )}
          </Button>
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

        {/* Category Sections */}
        {data.categoryGroups.length > 0 ? (
          <div className="space-y-6">
            {data.categoryGroups.map((group) => (
              <CategorySection
                key={group.category}
                categoryLabel={group.categoryLabel}
                categoryVariant={group.categoryVariant}
                policies={group.policies}
                totalSumAssured={group.totalSumAssured}
              />
            ))}
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
