import { AppShell } from "@/components/layout";
import { getDashboardData } from "@/lib/dashboard-data";
import { ensureDatabaseFromCookie } from "@/db/index";
import { cookies } from "next/headers";
import { DashboardContent } from "./dashboard-content";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  ensureDatabaseFromCookie(cookieStore.get("surety-database")?.value);

  const data = await getDashboardData();

  return (
    <AppShell>
      <DashboardContent data={data} />
    </AppShell>
  );
}
