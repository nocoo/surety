import { NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { getDashboardData } from "@/lib/dashboard-data";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const data = await getDashboardData(repos);
  return NextResponse.json(data);
}
