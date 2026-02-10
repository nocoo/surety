import { NextRequest, NextResponse } from "next/server";
import { ensureDbFromRequest } from "@/lib/api-helpers";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDbFromRequest();

  const {
    membersRepo,
    insurersRepo,
    assetsRepo,
    policiesRepo,
    beneficiariesRepo,
    paymentsRepo,
    cashValuesRepo,
    policyExtensionsRepo,
    settingsRepo,
  } = await import("@/db/repositories");

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      members: membersRepo.findAll(),
      insurers: insurersRepo.findAll(),
      assets: assetsRepo.findAll(),
      policies: policiesRepo.findAll(),
      beneficiaries: beneficiariesRepo.findAll(),
      payments: paymentsRepo.findAll(),
      cashValues: cashValuesRepo.findAll(),
      policyExtensions: policyExtensionsRepo.findAll(),
      settings: settingsRepo.findAll(),
    },
  };

  const filename = `surety-backup-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BackupRow = Record<string, any>;

interface BackupPayload {
  version: number;
  data: {
    members?: BackupRow[];
    insurers?: BackupRow[];
    assets?: BackupRow[];
    policies?: BackupRow[];
    beneficiaries?: BackupRow[];
    payments?: BackupRow[];
    cashValues?: BackupRow[];
    policyExtensions?: BackupRow[];
    settings?: BackupRow[];
  };
}

/**
 * Restore data from a backup JSON.
 * Clears all existing data and inserts backup rows preserving original IDs.
 */
export async function POST(request: NextRequest) {
  await ensureDbFromRequest();

  const body = (await request.json()) as BackupPayload;
  if (!body.data) {
    return NextResponse.json({ error: "Invalid backup: missing data" }, { status: 400 });
  }

  const db = getDb();

  // Use raw SQL via the underlying sqlite connection to preserve IDs.
  // Access the internal session (bun:sqlite Database instance).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = (db as any).session as { run(sql: string): void; exec(sql: string): void };
  // Drizzle exposes the underlying driver differently; for bun-sqlite it's at db.$client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (db as any).$client || session;
  if (!raw) {
    return NextResponse.json({ error: "Cannot access raw database" }, { status: 500 });
  }

  try {
    // Clear all data (respect FK order: children first)
    raw.exec(`
      DELETE FROM policy_extensions;
      DELETE FROM cash_values;
      DELETE FROM payments;
      DELETE FROM beneficiaries;
      DELETE FROM policies;
      DELETE FROM assets;
      DELETE FROM insurers;
      DELETE FROM members;
      DELETE FROM settings;
      DELETE FROM sqlite_sequence;
    `);

    const { data } = body;

    // Helper: insert rows preserving all columns including id
    const insertRows = (table: string, rows: BackupRow[] | undefined) => {
      if (!rows || rows.length === 0) return;
      const first = rows[0]!;
      const cols = Object.keys(first);
      const placeholders = cols.map(() => "?").join(", ");
      const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
      const stmt = raw.prepare(sql);
      for (const row of rows) {
        stmt.run(...cols.map((c) => row[c] ?? null));
      }
    };

    // Insert in FK-safe order (parents first)
    insertRows("members", data.members);
    insertRows("insurers", data.insurers);
    insertRows("assets", data.assets);
    insertRows("policies", data.policies);
    insertRows("beneficiaries", data.beneficiaries);
    insertRows("payments", data.payments);
    insertRows("cash_values", data.cashValues);
    insertRows("policy_extensions", data.policyExtensions);

    // Settings use key/value format
    if (data.settings && data.settings.length > 0) {
      const stmt = raw.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)");
      for (const s of data.settings) {
        stmt.run(s.key, s.value, s.updated_at ?? s.updatedAt ?? Date.now());
      }
    }

    const counts = {
      members: data.members?.length ?? 0,
      insurers: data.insurers?.length ?? 0,
      assets: data.assets?.length ?? 0,
      policies: data.policies?.length ?? 0,
      beneficiaries: data.beneficiaries?.length ?? 0,
      payments: data.payments?.length ?? 0,
      cashValues: data.cashValues?.length ?? 0,
      policyExtensions: data.policyExtensions?.length ?? 0,
      settings: data.settings?.length ?? 0,
    };

    return NextResponse.json({ success: true, restored: counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Restore failed: " + message }, { status: 500 });
  }
}
