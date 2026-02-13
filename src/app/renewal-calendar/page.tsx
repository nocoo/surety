"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout";
import LoadingScreen from "@/components/loading-screen";
import {
  SummaryCards,
  MonthlyChart,
  MonthlyDetails,
} from "@/components/renewal";
import {
  fetchRenewalCalendarData,
  type RenewalCalendarData,
} from "@/lib/renewal-calendar-vm";

const breadcrumbs = [{ label: "续保日历" }];

export default function RenewalCalendarPage() {
  const [data, setData] = useState<RenewalCalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRenewalCalendarData()
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "加载失败");
        setLoading(false);
      });
  }, []);

  if (loading) {
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

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">续保日历</h1>
          <p className="text-sm text-muted-foreground">
            未来 12 个月的保单续保计划
          </p>
        </div>

        {/* Summary Cards */}
        <SummaryCards summary={data.summary} />

        {/* Monthly Chart - full width */}
        <MonthlyChart data={data.monthlyData} policyNames={data.policyNames} />

        {/* Monthly Details */}
        <div>
          <h2 className="text-lg font-semibold mb-4">月度明细</h2>
          <MonthlyDetails data={data.monthlyData} />
        </div>
      </div>
    </AppShell>
  );
}
