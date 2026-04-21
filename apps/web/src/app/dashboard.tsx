import useSWR from "swr";
import { AppShell } from "@/components/layout";
import { DashboardContent } from "./dashboard-content";
import { TablePageSkeleton } from "@/components/skeletons";
import { fetchAPI } from "@/api";
import { AlertCircle } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard-vm";

export default function Dashboard() {
  const { data, error, isLoading } = useSWR("/api/dashboard", fetchAPI<DashboardData>);

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
        <div className="rounded-card bg-secondary p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive/50" />
          <h3 className="mt-4 text-lg font-medium">加载失败</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {error?.message ?? "加载仪表盘数据失败，请刷新页面重试"}
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <DashboardContent data={data} />
    </AppShell>
  );
}
