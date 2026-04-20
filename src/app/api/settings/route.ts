import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();
  const settings = await repos.settings.findAll();

  const result = settings.map((s) => ({
    key: s.key,
    value: s.value,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
  const { repos } = await getReposFromRequest();

  const body = await request.json();

  if (!body.key || body.value === undefined) {
    return NextResponse.json(
      { error: "key and value are required" },
      { status: 400 }
    );
  }

  const setting = await repos.settings.set(body.key, String(body.value));

  return NextResponse.json(
    {
      key: setting.key,
      value: setting.value,
    },
    { status: 201 }
  );
}
