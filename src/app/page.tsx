import { AppShell } from "@/components/layout";
import { getDashboardData } from "@/lib/dashboard-data";
import { DashboardContent } from "./dashboard-content";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getDashboardData();

  return (
    <AppShell>
      <DashboardContent data={data} />
    </AppShell>
  );
}
