import { NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const { repos } = await getReposFromRequest();
  const data = await getDashboardData(repos);
  return NextResponse.json(data);
}
