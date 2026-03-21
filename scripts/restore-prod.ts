#!/usr/bin/env bun
/**
 * One-shot script: restore production D1 from a JSON backup.
 * Generates SQL file with explicit column names, then executes via wrangler.
 *
 * Usage: bun scripts/restore-prod.ts <backup.json>
 */

import { writeFileSync } from "fs";

const backupPath = process.argv[2];
if (!backupPath) {
  console.error("Usage: bun scripts/restore-prod.ts <backup.json>");
  process.exit(1);
}

const backup = await Bun.file(backupPath).json();
const data = backup.data;

function esc(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

const lines: string[] = [];

// DELETE order: children first (FK constraints)
const deleteOrder = [
  "coverage_items", "cash_values", "payments", "beneficiaries",
  "policies", "assets", "insurers", "members", "settings",
];
for (const table of deleteOrder) {
  lines.push(`DELETE FROM ${table};`);
}
lines.push("DELETE FROM sqlite_sequence;");
lines.push("");

// INSERT order: parents first
function insertRows(tableName: string, rows: Record<string, unknown>[]) {
  if (!rows || rows.length === 0) return;
  const first = rows[0];
  if (!first) return;
  const cols = Object.keys(first);
  for (const row of rows) {
    const vals = cols.map((c) => esc(row[c]));
    lines.push(`INSERT INTO ${tableName} (${cols.join(", ")}) VALUES (${vals.join(", ")});`);
  }
  lines.push("");
}

// Map JSON keys to table names
insertRows("members", data.members);
insertRows("insurers", data.insurers);
insertRows("assets", data.assets);
insertRows("policies", data.policies);
insertRows("beneficiaries", data.beneficiaries);
insertRows("payments", data.payments);
insertRows("cash_values", data.cashValues ?? []);
insertRows("coverage_items", data.coverageItems ?? []);
insertRows("settings", data.settings?.map((s: { key: string; value: string; updated_at: number }) => ({
  key: s.key,
  value: s.value,
  updated_at: s.updated_at,
})) ?? []);

const sqlFile = "/tmp/surety-restore-prod.sql";
writeFileSync(sqlFile, lines.join("\n"), "utf-8");

console.log(`✅ Generated ${sqlFile}`);
console.log(`   Total statements: ${lines.filter((l) => l.endsWith(";")).length}`);
console.log(`\n   Members: ${data.members?.length ?? 0}`);
console.log(`   Insurers: ${data.insurers?.length ?? 0}`);
console.log(`   Assets: ${data.assets?.length ?? 0}`);
console.log(`   Policies: ${data.policies?.length ?? 0}`);
console.log(`   Beneficiaries: ${data.beneficiaries?.length ?? 0}`);
console.log(`   Payments: ${data.payments?.length ?? 0}`);
console.log(`   Coverage Items: ${data.coverageItems?.length ?? 0}`);
console.log(`   Settings: ${data.settings?.length ?? 0}`);
console.log(`\nNext step: review the SQL, then run:`);
console.log(`   bunx wrangler d1 execute surety-db --remote --file=${sqlFile}`);
