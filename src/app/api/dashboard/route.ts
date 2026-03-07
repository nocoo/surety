import { NextResponse } from "next/server";
import { ensureDbFromRequest } from "@/lib/api-helpers";
import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDbFromRequest();
  const data = await getDashboardData();
  return NextResponse.json(data);
}
