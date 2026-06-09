import useSWR from "swr";
import { AppShell } from "@/components/layout";
import { DashboardContent } from "./dashboard-content";
import { TablePageSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { fetchAPI } from "@/api";
import { AlertCircle } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard-vm";

export default function Dashboard() {
  const { data, error, isLoading, mutate } = useSWR("/api/dashboard", fetchAPI<DashboardData>);

  if (isLoading) {
    return (
      <AppShell>
        <TablePageSkeleton />
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
