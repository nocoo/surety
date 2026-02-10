import { NextRequest, NextResponse } from "next/server";
import { ensureDbFromRequest } from "@/lib/api-helpers";
import { buildBackup, buildBackupFilename, restoreBackup, validateBackup } from "@/db/backup";

export const dynamic = "force-dynamic";

/**
 * GET /api/backup — export all data as a downloadable JSON file.
 */
export async function GET() {
  await ensureDbFromRequest();

  const backup = buildBackup();
  const filename = buildBackupFilename();

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/**
 * POST /api/backup — restore data from a backup JSON.
 * Full destructive replace: clears all existing data, then imports.
 */
export async function POST(request: NextRequest) {
  await ensureDbFromRequest();

  const body: unknown = await request.json();

  const error = validateBackup(body);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const counts = restoreBackup(body as any);
    return NextResponse.json({ success: true, restored: counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Restore failed: " + message }, { status: 500 });
  }
}
