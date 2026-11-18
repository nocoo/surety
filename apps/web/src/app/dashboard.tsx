import { Button } from "@nocoo/basalt";
import { AlertCircle } from "@nocoo/basalt/icons";
import useSWR from "swr";
import { fetchAPI } from "@/api";
import { EmptyState } from "@/components/empty-state";
import { DashboardSkeleton } from "@/components/skeletons";
import type { DashboardData } from "@/lib/dashboard-vm";
import { DashboardContent } from "./dashboard-content";

export default function Dashboard() {
	const { data, error, isLoading, mutate } = useSWR("/api/dashboard", fetchAPI<DashboardData>);

	if (isLoading) {
		return <DashboardSkeleton />;
	}

	if (error || !data) {
		return (
			<EmptyState
				icon={AlertCircle}
				tone="error"
				title="加载仪表盘失败"
				description={
					error instanceof Error ? error.message : "请检查网络连接后重试，如果问题持续，请刷新页面"
				}
				action={<Button onClick={() => void mutate()}>重试</Button>}
			/>
		);
	}

	return <DashboardContent data={data} />;
}
