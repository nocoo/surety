/**
 * Backup & Restore — pure functions using Drizzle ORM, no raw SQLite dependency.
 *
 * buildBackup()   — collect all tables into a serializable object (snake_case)
 * restoreBackup() — full destructive replace: clear all → insert (transactional)
 *
 * The backup format uses raw snake_case column names and raw SQLite values
 * (e.g. timestamps as integers, not Date objects).  This ensures the JSON
 * is a faithful snapshot of the database and can be restored without any
 * key/value transformations.
 *
 * Internally, Drizzle ORM returns camelCase + Date objects, so we convert
 * at the boundary to maintain backward-compatible backup format.
 */

import { sql } from "drizzle-orm";
import * as schema from "./schema";
import type { DbInstance } from "./index";

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
    coverageItems: BackupRow[];
    attachments: BackupRow[];
    settings: BackupRow[];
    hospitals: BackupRow[];
    doctors: BackupRow[];
    medicalVisits: BackupRow[];
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
  coverageItems: number;
  attachments: number;
  settings: number;
  hospitals: number;
  doctors: number;
  medicalVisits: number;
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
  "coverageItems",
  "attachments",
  "settings",
  "hospitals",
  "doctors",
  "medicalVisits",
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
  coverageItems: "coverage_items",
  attachments: "attachments",
  settings: "settings",
  hospitals: "hospitals",
  doctors: "doctors",
  medicalVisits: "medical_visits",
};

// ── Column mapping (camelCase ↔ snake_case) ─────────────────────────

/**
 * Map of Drizzle schema table objects, keyed by backup table key.
 * Used to extract column mapping from the schema definition.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SCHEMA_TABLE_MAP: Record<TableKey, any> = {
  members: schema.members,
  insurers: schema.insurers,
  assets: schema.assets,
  policies: schema.policies,
  beneficiaries: schema.beneficiaries,
  payments: schema.payments,
  cashValues: schema.cashValues,
  coverageItems: schema.coverageItems,
  attachments: schema.attachments,
  settings: schema.settings,
  hospitals: schema.hospitals,
  doctors: schema.doctors,
  medicalVisits: schema.medicalVisits,
};

/**
 * Build camelCase → snake_case column mapping for a Drizzle table.
 * Reads the column definitions from the schema to get the SQL column name.
 */
function getColumnMapping(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
): { camelToSnake: Record<string, string>; snakeToCamel: Record<string, string> } {
  const camelToSnake: Record<string, string> = {};
  const snakeToCamel: Record<string, string> = {};
  const columns = table[Symbol.for("drizzle:Columns")];
  if (columns) {
    for (const [camelKey, col] of Object.entries(columns)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const snakeKey = (col as any).name as string;
      camelToSnake[camelKey] = snakeKey;
      snakeToCamel[snakeKey] = camelKey;
    }
  }
  return { camelToSnake, snakeToCamel };
}

/**
 * Set of camelCase column names that use `{ mode: "timestamp" }` in the schema.
 * Drizzle returns Date objects for these; backup format expects integer (seconds since epoch).
 */
const TIMESTAMP_COLUMNS = new Set(["createdAt", "updatedAt"]);

/**
 * Set of camelCase column names that use `{ mode: "boolean" }` in the schema.
 * Drizzle returns boolean; backup format expects 0/1 integer.
 */
const BOOLEAN_COLUMNS = new Set(["hasSocialInsurance", "isOptional", "archived", "isPublic"]);

/**
 * Convert a Drizzle ORM row (camelCase, Date objects) to backup format
 * (snake_case, integer timestamps, 0/1 booleans).
 */
function toBackupRow(row: Record<string, unknown>, camelToSnake: Record<string, string>): BackupRow {
  const result: BackupRow = {};
  for (const [camelKey, value] of Object.entries(row)) {
    const snakeKey = camelToSnake[camelKey] ?? camelKey;
    if (value instanceof Date) {
      // Timestamp columns: Date → seconds since epoch (integer)
      result[snakeKey] = Math.floor(value.getTime() / 1000);
    } else if (BOOLEAN_COLUMNS.has(camelKey) && typeof value === "boolean") {
      // Boolean columns: boolean → 0/1
      result[snakeKey] = value ? 1 : 0;
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

/**
 * Convert a backup row (snake_case, integer timestamps) to Drizzle ORM format
 * (camelCase, Date objects for timestamp columns).
 */
function fromBackupRow(row: BackupRow, snakeToCamel: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [snakeKey, value] of Object.entries(row)) {
    const camelKey = snakeToCamel[snakeKey] ?? snakeKey;
    if (TIMESTAMP_COLUMNS.has(camelKey) && typeof value === "number") {
      // Integer timestamp → Date object
      result[camelKey] = new Date(value * 1000);
    } else if (BOOLEAN_COLUMNS.has(camelKey) && typeof value === "number") {
      // 0/1 → boolean
      result[camelKey] = value !== 0;
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

// ── Export ────────────────────────────────────────────────────────────

/**
 * Collect every table into a single BackupData object using Drizzle ORM.
 * Queries each table via the provided db instance, then converts
 * camelCase → snake_case and Date → integer for backward-compatible format.
 */
export async function buildBackup(db: DbInstance): Promise<BackupData> {
  const queryTable = async (key: TableKey): Promise<BackupRow[]> => {
    const table = SCHEMA_TABLE_MAP[key];
    const { camelToSnake } = getColumnMapping(table);
    const rows = await db.select().from(table).all();
    return rows.map((row: Record<string, unknown>) => toBackupRow(row, camelToSnake));
  };

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      members: await queryTable("members"),
      insurers: await queryTable("insurers"),
      assets: await queryTable("assets"),
      policies: await queryTable("policies"),
      beneficiaries: await queryTable("beneficiaries"),
      payments: await queryTable("payments"),
      cashValues: await queryTable("cashValues"),
      coverageItems: await queryTable("coverageItems"),
      attachments: await queryTable("attachments"),
      settings: await queryTable("settings"),
      hospitals: await queryTable("hospitals"),
      doctors: await queryTable("doctors"),
      medicalVisits: await queryTable("medicalVisits"),
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
 *
 * Missing table keys are automatically backfilled with empty arrays for
 * forward-compatibility (older backups won't have newer tables like attachments).
 * If a key is present, it must be an array.
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
    // Missing keys are backfilled with empty arrays (forward-compat for older backups)
    if (val === undefined || val === null) {
      data[key] = [];
      continue;
    }
    if (!Array.isArray(val)) {
      return `data.${key} must be an array, got ${typeof val}`;
    }
  }
  return null;
}

/**
 * FK-safe deletion order (children first).
 */
const DELETE_ORDER: readonly TableKey[] = [
  "medicalVisits",
  "doctors",
  "hospitals",
  "coverageItems",
  "cashValues",
  "payments",
  "beneficiaries",
  "attachments",
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
  "coverageItems",
  "attachments",
  "settings",
  "hospitals",
  "doctors",
  "medicalVisits",
];

/**
 * A single SQL statement with optional bind params.
 * Used by the batch executor to send all restore operations at once.
 */
export interface SqlStatement {
  sql: string;
  params: unknown[];
}

/**
 * Batch executor function type.
 * When provided, restoreBackup collects all SQL statements and calls this
 * function once with the full array. The executor is responsible for atomicity.
 *
 * For D1: maps to WorkerDbClient.batch() which uses D1's atomic batch API.
 * For bun-sqlite: not needed (uses BEGIN/COMMIT/ROLLBACK).
 */
export type BatchExecuteFn = (statements: SqlStatement[]) => Promise<void>;

/**
 * Build a parameterized INSERT statement from a table name and camelCase row data.
 * Converts camelCase keys to snake_case column names using the column mapping.
 */
function buildInsertStatement(
  tableName: string,
  row: Record<string, unknown>,
  camelToSnake: Record<string, string>,
): SqlStatement {
  const columns: string[] = [];
  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (const [camelKey, value] of Object.entries(row)) {
    const snakeKey = camelToSnake[camelKey] ?? camelKey;
    columns.push(snakeKey);
    // Convert Date objects to epoch seconds for SQLite storage
    if (value instanceof Date) {
      values.push(Math.floor(value.getTime() / 1000));
    } else if (typeof value === "boolean") {
      values.push(value ? 1 : 0);
    } else {
      values.push(value);
    }
    placeholders.push("?");
  }

  return {
    sql: `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`,
    params: values,
  };
}

/**
 * Restore data from a BackupData object.
 * This is a FULL DESTRUCTIVE REPLACE:
 *   1. Delete all existing data (children first)
 *   2. Reset autoincrement sequences
 *   3. Insert backup rows preserving original IDs (parents first)
 *
 * Atomicity strategy:
 * - When `batchExecute` is provided (D1/Worker path): all statements are collected
 *   and sent as a single batch call. D1 batch() is atomic (all-or-nothing).
 * - When `batchExecute` is omitted (bun-sqlite/test path): uses Drizzle ORM insert
 *   wrapped in BEGIN/COMMIT/ROLLBACK for local transaction atomicity.
 *
 * @param db - Drizzle database instance
 * @param payload - Backup data to restore
 * @param batchExecute - Optional batch executor for D1 atomic execution
 * @throws Error if validation fails or any SQL operation errors
 */
export async function restoreBackup(
  db: DbInstance,
  payload: BackupData,
  batchExecute?: BatchExecuteFn,
): Promise<RestoreCounts> {
  const error = validateBackup(payload);
  if (error) {
    throw new Error(`Invalid backup: ${error}`);
  }

  const { data } = payload;

  const counts: RestoreCounts = {
    members: 0,
    insurers: 0,
    assets: 0,
    policies: 0,
    beneficiaries: 0,
    payments: 0,
    cashValues: 0,
    coverageItems: 0,
    attachments: 0,
    settings: 0,
    hospitals: 0,
    doctors: 0,
    medicalVisits: 0,
  };

  if (batchExecute) {
    // D1 path: collect all statements and execute atomically via batch API
    const statements: SqlStatement[] = [];

    // 1. Clear all tables (FK-safe order) — full destructive replace
    for (const key of DELETE_ORDER) {
      statements.push({ sql: `DELETE FROM ${TABLE_NAME_MAP[key]}`, params: [] });
    }
    statements.push({ sql: "DELETE FROM sqlite_sequence", params: [] });

    // 2. Build INSERT statements (FK-safe order)
    for (const key of INSERT_ORDER) {
      const rows = data[key];
      if (!rows || rows.length === 0) continue;

      const table = SCHEMA_TABLE_MAP[key];
      const { snakeToCamel, camelToSnake } = getColumnMapping(table);
      const tableName = TABLE_NAME_MAP[key];

      for (const row of rows) {
        const drizzleRow = fromBackupRow(row, snakeToCamel);
        statements.push(buildInsertStatement(tableName, drizzleRow, camelToSnake));
      }
      counts[key] = rows.length;
    }

    await batchExecute(statements);
  } else {
    // bun-sqlite path: local transaction with Drizzle ORM insert
    await db.run(sql.raw("BEGIN TRANSACTION"));
    try {
      // 1. Clear all tables (FK-safe order) — full destructive replace
      for (const key of DELETE_ORDER) {
        const tableName = TABLE_NAME_MAP[key];
        await db.run(sql.raw(`DELETE FROM ${tableName}`));
      }
      await db.run(sql.raw("DELETE FROM sqlite_sequence"));

      // 2. Insert rows via Drizzle ORM (FK-safe order)
      for (const key of INSERT_ORDER) {
        const rows = data[key];
        if (!rows || rows.length === 0) continue;

        const table = SCHEMA_TABLE_MAP[key];
        const { snakeToCamel } = getColumnMapping(table);
        const drizzleRows = rows.map((row) => fromBackupRow(row, snakeToCamel));

        for (const row of drizzleRows) {
          await db.insert(table).values(row).run();
        }
        counts[key] = rows.length;
      }

      await db.run(sql.raw("COMMIT"));
    } catch (err) {
      await db.run(sql.raw("ROLLBACK"));
      throw err;
    }
  }

  return counts;
}
