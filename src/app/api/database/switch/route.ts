import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { TargetDb } from "@/db/index";

export const dynamic = "force-dynamic";

const VALID_TARGETS: TargetDb[] = ["production", "dev"];

/**
 * POST /api/database/switch — switch the active database.
 *
 * Safety: when E2E_SKIP_AUTH is set, switching is locked to the current
 * SURETY_TARGET_DB (typically "dev"). This prevents E2E tests from
 * accidentally operating on production data.
 */
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

    // E2E guard: lock to SURETY_TARGET_DB when E2E_SKIP_AUTH is set
    if (process.env.E2E_SKIP_AUTH === "true") {
      const locked = process.env.SURETY_TARGET_DB;
      if (locked && database !== locked) {
        return NextResponse.json(
          { error: `E2E mode: database locked to "${locked}"`, database: locked },
          { status: 403 },
        );
      }
    }

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

/**
 * GET /api/database/switch — return the current database selection.
 */
export async function GET() {
  const cookieStore = await cookies();
  const database = cookieStore.get("surety-database")?.value || "production";

  return NextResponse.json({
    database,
  });
}
