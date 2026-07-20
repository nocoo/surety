import { AlertCircle } from "lucide-react";
import useSWR from "swr";
import { fetchAPI } from "@/api";
import { AppShell } from "@/components/layout";
import { DashboardSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { DashboardData } from "@/lib/dashboard-vm";
import { DashboardContent } from "./dashboard-content";

export default function Dashboard() {
	const { data, error, isLoading, mutate } = useSWR("/api/dashboard", fetchAPI<DashboardData>);

	if (isLoading) {
		return (
			<AppShell>
				<DashboardSkeleton />
			</AppShell>
		);
	}

	if (error || !data) {
		return (
			<AppShell>
				<EmptyState
					icon={AlertCircle}
					tone="error"
					title="加载仪表盘失败"
					description={
						error instanceof Error
							? error.message
							: "请检查网络连接后重试，如果问题持续，请刷新页面"
					}
					action={<Button onClick={() => void mutate()}>重试</Button>}
				/>
			</AppShell>
		);
	}

	return (
		<AppShell>
			<DashboardContent data={data} />
		</AppShell>
	);
}
