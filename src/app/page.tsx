import { AppShell } from "@/components/layout";
import { getReposFromRequest } from "@/lib/api-helpers";
import { getDashboardData } from "@/lib/dashboard-data";
import { DashboardContent } from "./dashboard-content";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { repos } = await getReposFromRequest();
  const data = await getDashboardData(repos);

  return (
    <AppShell>
      <DashboardContent data={data} />
    </AppShell>
  );
}
