import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { switchDatabase, ensureDatabase, type DatabaseType } from "@/db/index";

export const dynamic = "force-dynamic";

const VALID_DATABASES = ["production", "example", "test"] as const;

const DATABASE_FILES: Record<DatabaseType, string> = {
  production: "surety.db",
  example: "surety.example.db",
  test: "surety.e2e.db",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const database = body.database as string;

    if (!VALID_DATABASES.includes(database as DatabaseType)) {
      return NextResponse.json(
        { error: "Invalid database type" },
        { status: 400 }
      );
    }

    // Store the database selection in a cookie for server-side access
    const cookieStore = await cookies();
    cookieStore.set("surety-database", database, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    // Actually switch the database connection
    switchDatabase(database as DatabaseType);

    return NextResponse.json({
      success: true,
      database,
      file: DATABASE_FILES[database as DatabaseType],
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to switch database" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const database = (cookieStore.get("surety-database")?.value || "production") as DatabaseType;

  // Ensure the database connection matches the cookie (only switches if necessary)
  ensureDatabase(database);

  return NextResponse.json({
    database,
    file: DATABASE_FILES[database] || DATABASE_FILES.production,
  });
}
