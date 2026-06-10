
import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout";
import { RenewalCalendarSkeleton } from "@/components/skeletons";
import { SectionDivider } from "@/components/ui/section-divider";
import {
  SummaryCards,
  MonthlyChart,
  MonthlyCalendar,
  MonthlyDetails,
} from "@/components/renewal";
import {
  fetchRenewalCalendarData,
  type RenewalCalendarData,
} from "@surety/api/renewal-calendar";

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
    return (
      <AppShell breadcrumbs={breadcrumbs}>
        <RenewalCalendarSkeleton />
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
          <h1 className="text-2xl font-semibold tracking-tight">续保日历</h1>
          <p className="text-sm text-muted-foreground">
            未来 12 个月的保单续保计划
          </p>
        </div>

        {/* Summary Cards */}
        <SummaryCards summary={data.summary} />

        {/* 12-month calendar grid — primary view, answers "which days do I owe" */}
        <SectionDivider title="日历视图">
          <MonthlyCalendar data={data.monthlyData} />
        </SectionDivider>

        {/* Bar chart — secondary, answers "which month is the heaviest" */}
        <SectionDivider title="按月柱状图">
          <MonthlyChart data={data.monthlyData} policyNames={data.policyNames} />
        </SectionDivider>

        <SectionDivider title="月度明细">
          <MonthlyDetails data={data.monthlyData} />
        </SectionDivider>
      </div>
    </AppShell>
  );
}
