"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout";
import { MemberSelector, CategorySection } from "@/components/member-coverage";
import {
  fetchMemberCoverageData,
  type MemberCoverageData,
} from "@/lib/member-coverage-vm";

const breadcrumbs = [{ label: "成员保障" }];

export default function MemberCoveragePage() {
  const [data, setData] = useState<MemberCoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  const loadData = useCallback(async (memberId?: number) => {
    try {
      setLoading(true);
      const result = await fetchMemberCoverageData(memberId);
      setData(result);
      if (!memberId && result.selectedMember) {
        setSelectedMemberId(result.selectedMember.id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectMember = (memberId: number) => {
    setSelectedMemberId(memberId);
    loadData(memberId);
  };

  if (loading && !data) {
    return (
      <AppShell breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">加载中...</div>
        </div>
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

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">成员保障</h1>
          <p className="text-sm text-muted-foreground">
            快速查看家庭成员的保障信息，紧急情况下快速定位联系方式
          </p>
        </div>

        {/* Member Selector - horizontal scrolling cards */}
        <MemberSelector
          members={data.members}
          selectedMemberId={selectedMemberId}
          onSelectMember={handleSelectMember}
        />

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
            {data.selectedMember ? (
              <p>{data.selectedMember.name} 暂无保单记录</p>
            ) : (
              <p>请选择一位家庭成员查看保障信息</p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
