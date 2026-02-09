import { NextRequest, NextResponse } from "next/server";
import { ensureDbFromRequest } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDbFromRequest();
  const { settingsRepo } = await import("@/db/repositories");
  const settings = settingsRepo.findAll();

  const result = settings.map((s) => ({
    key: s.key,
    value: s.value,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  await ensureDbFromRequest();
  const { settingsRepo } = await import("@/db/repositories");

  const body = await request.json();

  if (!body.key || body.value === undefined) {
    return NextResponse.json(
      { error: "key and value are required" },
      { status: 400 }
    );
  }

  const setting = settingsRepo.set(body.key, String(body.value));

  return NextResponse.json(
    {
      key: setting.key,
      value: setting.value,
    },
    { status: 201 }
  );
}
