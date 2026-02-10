/**
 * Backup & Restore — pure functions, no HTTP dependency.
 *
 * buildBackup()   — collect all tables into a serializable object (raw SQL, snake_case)
 * restoreBackup() — full destructive replace: clear all → insert (transactional)
 *
 * The backup format uses raw snake_case column names and raw SQLite values
 * (e.g. timestamps as integers, not Date objects).  This ensures the JSON
 * is a faithful snapshot of the database and can be restored without any
 * key/value transformations.
 */

import { getRawSqlite } from "@/db";

// ── Types ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BackupRow = Record<string, any>;

export interface BackupData {
  version: number;
  exportedAt: string;
  data: {
    members: BackupRow[];
    insurers: BackupRow[];
    assets: BackupRow[];
    policies: BackupRow[];
    beneficiaries: BackupRow[];
    payments: BackupRow[];
    cashValues: BackupRow[];
    policyExtensions: BackupRow[];
    settings: BackupRow[];
  };
}

export interface RestoreCounts {
  members: number;
  insurers: number;
  assets: number;
  policies: number;
  beneficiaries: number;
  payments: number;
  cashValues: number;
  policyExtensions: number;
  settings: number;
}

/** All table keys in the backup, ordered for display. */
export const ALL_TABLE_KEYS = [
  "members",
  "insurers",
  "assets",
  "policies",
  "beneficiaries",
  "payments",
  "cashValues",
  "policyExtensions",
  "settings",
] as const;

export type TableKey = (typeof ALL_TABLE_KEYS)[number];

/**
 * SQL table names corresponding to each backup key.
 * Some backup keys use camelCase while SQL tables use snake_case.
 */
const TABLE_NAME_MAP: Record<TableKey, string> = {
  members: "members",
  insurers: "insurers",
  assets: "assets",
  policies: "policies",
  beneficiaries: "beneficiaries",
  payments: "payments",
  cashValues: "cash_values",
  policyExtensions: "policy_extensions",
  settings: "settings",
};

// ── Export ────────────────────────────────────────────────────────────

/**
 * Collect every table into a single BackupData object using raw SQL.
 * This returns snake_case column names and raw SQLite values (integers
 * for timestamps), making the backup format database-faithful.
 */
export function buildBackup(): BackupData {
  const raw = getRawSqlite();
  const query = (table: string): BackupRow[] => raw.prepare(`SELECT * FROM ${table}`).all();

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      members: query("members"),
      insurers: query("insurers"),
      assets: query("assets"),
      policies: query("policies"),
      beneficiaries: query("beneficiaries"),
      payments: query("payments"),
      cashValues: query("cash_values"),
      policyExtensions: query("policy_extensions"),
      settings: query("settings"),
    },
  };
}

/**
 * Generate the canonical backup filename for today.
 */
export function buildBackupFilename(): string {
  return `surety-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

// ── Import ───────────────────────────────────────────────────────────

/**
 * Validate that a parsed JSON object looks like a valid backup payload.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateBackup(payload: unknown): string | null {
  if (payload == null || typeof payload !== "object") {
    return "Payload is not an object";
  }
  const obj = payload as Record<string, unknown>;
  if (obj.version !== 1) {
    return `Unsupported backup version: ${String(obj.version)}`;
  }
  if (obj.data == null || typeof obj.data !== "object") {
    return "Missing 'data' field";
  }
  const data = obj.data as Record<string, unknown>;
  for (const key of ALL_TABLE_KEYS) {
    const val = data[key];
    // undefined/null is ok (treated as empty), but if present must be array
    if (val !== undefined && val !== null && !Array.isArray(val)) {
      return `data.${key} must be an array, got ${typeof val}`;
    }
  }
  return null;
}

/**
 * FK-safe deletion order (children first).
 */
const DELETE_ORDER: readonly TableKey[] = [
  "policyExtensions",
  "cashValues",
  "payments",
  "beneficiaries",
  "policies",
  "assets",
  "insurers",
  "members",
  "settings",
];

/**
 * FK-safe insertion order (parents first).
 */
const INSERT_ORDER: readonly TableKey[] = [
  "members",
  "insurers",
  "assets",
  "policies",
  "beneficiaries",
  "payments",
  "cashValues",
  "policyExtensions",
  "settings",
];

/**
 * Restore data from a BackupData object.
 * This is a FULL DESTRUCTIVE REPLACE:
 *   1. Delete all existing data (children first)
 *   2. Reset autoincrement sequences
 *   3. Insert backup rows preserving original IDs (parents first)
 *
 * The entire operation runs inside a SQLite transaction for atomicity.
 *
 * @throws Error if validation fails or any SQL operation errors
 */
export function restoreBackup(payload: BackupData): RestoreCounts {
  const error = validateBackup(payload);
  if (error) {
    throw new Error(`Invalid backup: ${error}`);
  }

  const raw = getRawSqlite();
  const { data } = payload;

  // Wrap in a transaction for atomicity
  raw.exec("BEGIN TRANSACTION");
  try {
    // 1. Clear all tables (FK-safe order)
    for (const key of DELETE_ORDER) {
      raw.exec(`DELETE FROM ${TABLE_NAME_MAP[key]}`);
    }
    raw.exec("DELETE FROM sqlite_sequence");

    // 2. Insert rows (FK-safe order)
    const counts: RestoreCounts = {
      members: 0,
      insurers: 0,
      assets: 0,
      policies: 0,
      beneficiaries: 0,
      payments: 0,
      cashValues: 0,
      policyExtensions: 0,
      settings: 0,
    };

    for (const key of INSERT_ORDER) {
      const rows = data[key];
      if (!rows || rows.length === 0) continue;
      const tableName = TABLE_NAME_MAP[key];
      const first = rows[0]!;
      const cols = Object.keys(first);
      const placeholders = cols.map(() => "?").join(", ");
      const sql = `INSERT INTO ${tableName} (${cols.join(", ")}) VALUES (${placeholders})`;
      const stmt = raw.prepare(sql);
      for (const row of rows) {
        stmt.run(...cols.map((c) => row[c] ?? null));
      }
      counts[key] = rows.length;
    }

    raw.exec("COMMIT");
    return counts;
  } catch (err) {
    raw.exec("ROLLBACK");
    throw err;
  }
}
