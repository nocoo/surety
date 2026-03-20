import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { TargetDb } from "@/db/index";

export const dynamic = "force-dynamic";

const VALID_TARGETS: TargetDb[] = ["production", "dev"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const database = body.database as string;

    if (!VALID_TARGETS.includes(database as TargetDb)) {
      return NextResponse.json(
        { error: "Invalid target database", allowed: VALID_TARGETS },
        { status: 400 },
      );
    }

    // Store the database selection in a cookie
    const cookieStore = await cookies();
    cookieStore.set("surety-database", database, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return NextResponse.json({
      success: true,
      database,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to switch database" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const database = cookieStore.get("surety-database")?.value || "production";

  return NextResponse.json({
    database,
  });
}
