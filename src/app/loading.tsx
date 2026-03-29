import { AppShell } from "@/components/layout";
import { DashboardSkeleton } from "@/components/skeletons";

export default function DashboardLoading() {
  return (
    <AppShell>
      <DashboardSkeleton />
    </AppShell>
  );
}
