/**
 * Import policies from Notion CSV export.
 *
 * SAFETY: This script REFUSES to run without explicit confirmation.
 * It will DELETE ALL existing data before importing.
 *
 * Usage:
 *   bun scripts/import-csv.ts                          # targets surety.db (requires --confirm)
 *   SURETY_DB=surety.e2e.db bun scripts/import-csv.ts  # targets E2E db
 *   bun scripts/import-csv.ts --confirm                # explicit confirmation for production
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Database } from "bun:sqlite";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DB_FILE = process.env.SURETY_DB || "surety.db";
const DB_PATH = resolve(PROJECT_ROOT, DB_FILE);

// Safety guard: require --confirm for production database
const PROTECTED_FILES = ["surety.db", "surety.example.db"];
if (PROTECTED_FILES.includes(DB_FILE) && !process.argv.includes("--confirm")) {
  console.error(
    `❌ BLOCKED: This script will DELETE ALL DATA in "${DB_FILE}" before importing.\n\n` +
    `   If you really mean to wipe and re-import production data, run:\n` +
    `     bun scripts/import-csv.ts --confirm\n\n` +
    `   Or target a safe database:\n` +
    `     SURETY_DB=surety.e2e.db bun scripts/import-csv.ts\n`
  );
  process.exit(1);
}

const CSV_PATH =
  "/Users/nocoo/Downloads/ExportBlock-4ae5e7df-985f-4378-9a18-3e28abf5c788-Part-1/保单数据库 1e078b6d9ee0806fa64cc15e570c8a6c_all.csv";

// ── Member mapping ─────────────────────────────────────────────
interface MemberDef {
  name: string;
  relation: "Self" | "Spouse" | "Child" | "Parent";
  gender: "M" | "F";
}

const MEMBERS: MemberDef[] = [
  { name: "李征", relation: "Self", gender: "M" },
  { name: "江虹萱", relation: "Spouse", gender: "F" },
  { name: "李晏同", relation: "Child", gender: "M" },
  { name: "李洪修", relation: "Parent", gender: "M" },
  { name: "段丽美", relation: "Parent", gender: "F" },
];

// ── Asset mapping (by insurer name) ────────────────────────────
interface AssetDef {
  type: "Vehicle";
  name: string;
  identifier: string;
  ownerName: string;
  matchInsurer: string; // used to link policies to this asset
}

const ASSETS: AssetDef[] = [
  {
    type: "Vehicle",
    name: "本田NC750X",
    identifier: "京B71Z57",
    ownerName: "李征",
    matchInsurer: "渤海财险",
  },
  {
    type: "Vehicle",
    name: "蔚来ES8",
    identifier: "京ADH0922",
    ownerName: "李征",
    matchInsurer: "中国太平",
  },
];

// ── Category mapping ───────────────────────────────────────────
const CATEGORY_MAP: Record<string, string> = {
  意外: "Accident",
  医疗: "Medical",
  门急诊: "Medical",
  重疾: "CriticalIllness",
  寿险: "Life",
  年金: "Annuity",
  财产: "Property",
};

// ── Sub-category: use CSV "子类别" directly ─────────────────────

// ── Renewal type mapping ───────────────────────────────────────
const RENEWAL_MAP: Record<string, string> = {
  手动: "Manual",
  自动: "Auto",
  每年: "Yearly",
};

// ── Payment frequency: derive from "缴费期" ───────────────────
function parsePaymentFrequency(raw: string): { frequency: string; years: number | null } {
  if (!raw) return { frequency: "Yearly", years: null };
  const trimmed = raw.trim();

  // "20年", "30年", "10年"
  const yearMatch = trimmed.match(/^(\d+)年$/);
  if (yearMatch) return { frequency: "Yearly", years: parseInt(yearMatch[1]!) };

  // "1年", "年交"
  if (trimmed === "1年" || trimmed === "年交") return { frequency: "Yearly", years: null };

  // "趸交"
  if (trimmed === "趸交") return { frequency: "Single", years: null };

  // "月缴"
  if (trimmed === "月缴") return { frequency: "Monthly", years: null };

  return { frequency: "Yearly", years: null };
}

// ── Parse helpers ──────────────────────────────────────────────
function parseAmount(str: string): number {
  if (!str || str.trim() === "") return 0;
  const cleaned = str.replace(/[¥,，元"]/g, "").trim();
  const match = cleaned.match(/([\d.]+)/);
  if (!match?.[1]) return 0;
  const num = parseFloat(match[1]);
  if (cleaned.includes("万")) return num * 10000;
  return num;
}

function parseDateField(str: string): string | null {
  if (!str || str.trim() === "") return null;
  // "2022/12/26" or "2022-12-26"
  const match = str.trim().match(/(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2]!.padStart(2, "0")}-${match[3]!.padStart(2, "0")}`;
  }
  return null;
}

function parseExpiryFromPeriod(period: string): string | null {
  if (!period) return null;
  // "2022年12月26日 → 2026年6月26日"
  const parts = period.split("→");
  if (parts.length === 2) {
    const expPart = parts[1]!.trim();
    const match = expPart.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (match) {
      return `${match[1]}-${match[2]!.padStart(2, "0")}-${match[3]!.padStart(2, "0")}`;
    }
  }
  return null;
}

// ── CSV parser (handles quoted fields with commas) ─────────────
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split("\n");
  const headers = splitCSVLine(lines[0]!);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const values = splitCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

// ── Determine if a policy is for an asset (Property + vehicle keywords) ─
function isAssetPolicy(category: string, subCategory: string, productName: string): boolean {
  if (category !== "Property") return false;
  const combined = `${subCategory} ${productName}`.toLowerCase();
  return (
    combined.includes("车") ||
    combined.includes("摩托") ||
    combined.includes("交强") ||
    combined.includes("商业保险") ||
    combined.includes("服务无忧")
  );
}

function matchAsset(
  insurerName: string,
  assetMap: Map<string, number>,
): number | null {
  for (const [matchKey, assetId] of assetMap) {
    if (insurerName.includes(matchKey)) return assetId;
  }
  return null;
}

// ── Main import ────────────────────────────────────────────────
function main() {
  console.log(`Opening database: ${DB_PATH}`);
  const db = new Database(DB_PATH);

  // Enable WAL mode for performance
  db.exec("PRAGMA journal_mode=WAL;");

  console.log(`Reading CSV: ${CSV_PATH}`);
  const content = readFileSync(CSV_PATH, "utf-8");
  const rows = parseCSV(content);
  console.log(`Found ${rows.length} rows\n`);

  const now = Math.floor(Date.now() / 1000);

  // ── 1. Clear existing data ───────────────────────────────────
  console.log("Clearing existing data...");
  db.exec(`
    DELETE FROM policy_extensions;
    DELETE FROM cash_values;
    DELETE FROM payments;
    DELETE FROM beneficiaries;
    DELETE FROM policies;
    DELETE FROM assets;
    DELETE FROM insurers;
    DELETE FROM members;
    DELETE FROM settings;
  `);

  // ── 2. Insert members ────────────────────────────────────────
  console.log("Creating members...");
  const memberInsert = db.prepare(
    `INSERT INTO members (name, relation, gender, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const memberMap = new Map<string, number>();

  for (const m of MEMBERS) {
    const result = memberInsert.run(m.name, m.relation, m.gender, now, now);
    const id = Number(result.lastInsertRowid);
    memberMap.set(m.name, id);
    console.log(`  + ${m.name} (${m.relation}, id=${id})`);
  }

  const applicantId = memberMap.get("李征")!;

  // ── 3. Insert insurers (deduplicated from CSV) ───────────────
  console.log("\nCreating insurers...");
  const insurerNames = new Set<string>();
  for (const row of rows) {
    const name = row["保险公司"]?.trim();
    if (name) insurerNames.add(name);
  }

  const insurerInsert = db.prepare(
    `INSERT INTO insurers (name, created_at, updated_at) VALUES (?, ?, ?)`,
  );
  const insurerMap = new Map<string, number>();

  for (const name of insurerNames) {
    const result = insurerInsert.run(name, now, now);
    const id = Number(result.lastInsertRowid);
    insurerMap.set(name, id);
    console.log(`  + ${name} (id=${id})`);
  }

  // ── 4. Insert assets (vehicles) ──────────────────────────────
  console.log("\nCreating assets...");
  const assetInsert = db.prepare(
    `INSERT INTO assets (type, name, identifier, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  // Map: insurer matchKey → asset id
  const assetMatchMap = new Map<string, number>();

  for (const a of ASSETS) {
    const ownerId = memberMap.get(a.ownerName) ?? applicantId;
    const result = assetInsert.run(a.type, a.name, a.identifier, ownerId, now, now);
    const id = Number(result.lastInsertRowid);
    assetMatchMap.set(a.matchInsurer, id);
    console.log(`  + ${a.name} (${a.identifier}, id=${id})`);
  }

  // ── 5. Insert policies ──────────────────────────────────────
  console.log("\nImporting policies...");
  const policyInsert = db.prepare(
    `INSERT INTO policies (
      applicant_id, insured_type, insured_member_id, insured_asset_id,
      category, sub_category, insurer_id, insurer_name,
      product_name, policy_number, channel,
      sum_assured, premium, payment_frequency, payment_years,
      renewal_type, payment_account, next_due_date,
      effective_date, expiry_date, status, death_benefit,
      archived, notes, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )`,
  );

  // For beneficiary insertion
  const beneficiaryInsert = db.prepare(
    `INSERT INTO beneficiaries (policy_id, member_id, external_name, share_percent, rank_order)
     VALUES (?, ?, ?, ?, ?)`,
  );

  let imported = 0;
  let skipped = 0;
  const seenPolicyNumbers = new Set<string>();

  for (const row of rows) {
    const productName = row["产品"]?.trim();
    if (!productName) {
      skipped++;
      continue;
    }

    const insurerName = row["保险公司"]?.trim() || "未知";
    let policyNumber = row["保险单号"]?.trim() || "";

    // Deduplicate: some policies appear twice (e.g. 北京普惠健康保 for multiple members)
    // Use policyNumber + insuredName as unique key
    const insuredName = row["被保险人"]?.trim() || "";
    const dedupeKey = policyNumber || `${productName}-${insurerName}`;
    const uniqueKey = `${dedupeKey}::${insuredName}`;
    if (seenPolicyNumbers.has(uniqueKey)) {
      console.log(`  ⚠ Duplicate: ${productName} (${insuredName}) — skipping`);
      skipped++;
      continue;
    }
    seenPolicyNumbers.add(uniqueKey);

    // If policy number is duplicated across different insured, append suffix
    if (seenPolicyNumbers.has(dedupeKey) || policyNumber === "") {
      // Check if the raw policy number was already used
      const suffix = insuredName ? `-${insuredName}` : `-${imported}`;
      policyNumber = policyNumber ? `${policyNumber}${suffix}` : `AUTO-${Date.now()}-${imported}`;
    }
    seenPolicyNumbers.add(dedupeKey);

    // Remove invisible characters from policy number (e.g. ‭ ‬)
    policyNumber = policyNumber.replace(/[\u200B-\u200D\u2060\u202A-\u202E\uFEFF]/g, "");

    const insuredMemberId = memberMap.get(insuredName) ?? null;
    const categoryRaw = row["保障类型"]?.trim() || "";
    const category = CATEGORY_MAP[categoryRaw] || "Accident";
    const subCategory = row["子类别"]?.trim() || null;

    const sumAssured = parseAmount(row["保额"] || "");
    const premium = parseAmount(row["年保费"] || "");

    const { frequency: paymentFrequency, years: paymentYears } = parsePaymentFrequency(
      row["缴费期"] || "",
    );

    const renewalRaw = row["续保"]?.trim() || "";
    const renewalType = RENEWAL_MAP[renewalRaw] || null;

    const effectiveDate =
      parseDateField(row["生效日期"] || "") || new Date().toISOString().split("T")[0]!;
    const expiryDate = parseExpiryFromPeriod(row["保险期间"] || "");
    const nextDueDate = parseDateField(row["下次缴费"] || "");
    const paymentAccount = row["扣费账户"]?.trim() || null;
    const deathBenefit = row["身故"]?.trim() || null;
    const channel = row["渠道"]?.trim() || null;
    const archivedRaw = row["存档"]?.trim() || "";
    const archived = archivedRaw === "Yes" || archivedRaw === "是" ? 1 : 0;

    const insurerId = insurerMap.get(insurerName) ?? null;

    // Determine if this is an asset-linked policy
    const assetPolicy = isAssetPolicy(category, subCategory || "", productName);
    let insuredType: "Member" | "Asset" = "Member";
    let insuredAssetId: number | null = null;

    if (assetPolicy) {
      insuredType = "Asset";
      insuredAssetId = matchAsset(insurerName, assetMatchMap);
    }

    const status = archived ? "Surrendered" : "Active";

    // Beneficiary info
    const beneficiaryRaw = row["受益人"]?.trim() || "";

    try {
      const result = policyInsert.run(
        applicantId,
        insuredType,
        insuredType === "Member" ? insuredMemberId : null,
        insuredType === "Asset" ? insuredAssetId : null,
        category,
        subCategory,
        insurerId,
        insurerName,
        productName,
        policyNumber,
        channel,
        sumAssured,
        premium,
        paymentFrequency,
        paymentYears,
        renewalType,
        paymentAccount,
        nextDueDate,
        effectiveDate,
        expiryDate,
        status,
        deathBenefit,
        archived,
        null, // notes
        now,
        now,
      );

      const policyId = Number(result.lastInsertRowid);

      // Insert beneficiary if specified
      if (beneficiaryRaw && beneficiaryRaw !== "") {
        const benefMemberId = memberMap.get(beneficiaryRaw) ?? null;
        if (benefMemberId) {
          beneficiaryInsert.run(policyId, benefMemberId, null, 100, 1);
        } else if (beneficiaryRaw === "法定") {
          // "法定" = legal heirs, store as external name
          beneficiaryInsert.run(policyId, null, "法定", 100, 1);
        } else {
          beneficiaryInsert.run(policyId, null, beneficiaryRaw, 100, 1);
        }
      }

      console.log(
        `  + ${productName} (${insurerName}) → ${insuredName} [${category}${subCategory ? "/" + subCategory : ""}]`,
      );
      imported++;
    } catch (error) {
      console.log(`  ✗ Failed: ${productName} (${policyNumber}) — ${error}`);
      skipped++;
    }
  }

  // ── Summary ──────────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  console.log("✅ Import completed!");
  console.log(`  Members: ${memberMap.size}`);
  console.log(`  Insurers: ${insurerMap.size}`);
  console.log(`  Assets: ${assetMatchMap.size}`);
  console.log(`  Policies imported: ${imported}`);
  console.log(`  Policies skipped: ${skipped}`);

  // Verification
  const memberCount = db.query("SELECT count(*) as c FROM members").get() as { c: number };
  const policyCount = db.query("SELECT count(*) as c FROM policies").get() as { c: number };
  const insurerCount = db.query("SELECT count(*) as c FROM insurers").get() as { c: number };
  const assetCount = db.query("SELECT count(*) as c FROM assets").get() as { c: number };
  const benefCount = db.query("SELECT count(*) as c FROM beneficiaries").get() as { c: number };

  console.log("\nVerification (from DB):");
  console.log(`  members: ${memberCount.c}`);
  console.log(`  insurers: ${insurerCount.c}`);
  console.log(`  assets: ${assetCount.c}`);
  console.log(`  policies: ${policyCount.c}`);
  console.log(`  beneficiaries: ${benefCount.c}`);

  db.close();
}

main();
