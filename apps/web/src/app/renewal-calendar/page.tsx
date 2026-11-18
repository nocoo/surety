import { PageHeader } from "@nocoo/basalt/components/page-header";
import { SectionRule as SectionDivider } from "@nocoo/basalt/components/section-rule";
import { fetchRenewalCalendarData, type RenewalCalendarData } from "@surety/api/renewal-calendar";
import { useEffect, useState } from "react";
import { MonthlyCalendar, MonthlyChart, MonthlyDetails, SummaryCards } from "@/components/renewal";
import { RenewalCalendarSkeleton } from "@/components/skeletons";

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
		return <RenewalCalendarSkeleton />;
	}

	if (error || !data) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-basalt-destructive">{error ?? "加载失败"}</div>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<PageHeader title="续保日历" description="未来 12 个月的保单续保计划" />

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
	);
}
