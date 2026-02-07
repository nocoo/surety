import { readFileSync } from "fs";
import { db, initSchema } from "../src/db";
import { membersRepo, policiesRepo } from "../src/db/repositories";
import type { NewMember, NewPolicy } from "../src/db/schema";

const CSV_PATH =
  "/Users/nocoo/Downloads/ExportBlock-4ae5e7df-985f-4378-9a18-3e28abf5c788-Part-1/保单数据库 1e078b6d9ee0806fa64cc15e570c8a6c.csv";

const categoryMap: Record<string, NewPolicy["category"]> = {
  意外: "Accident",
  医疗: "Medical",
  门急诊: "Medical",
  重疾: "CriticalIllness",
  寿险: "Life",
  年金: "Annuity",
  财产: "Property",
};

const paymentFrequencyMap: Record<string, NewPolicy["paymentFrequency"]> = {
  趸交: "Single",
  月缴: "Monthly",
  年缴: "Yearly",
};

const renewalTypeMap: Record<string, NewPolicy["renewalType"]> = {
  手动: "Manual",
  自动: "Auto",
  每年: "Yearly",
};

function parseAmount(str: string): number {
  if (!str || str.trim() === "") return 0;
  const cleaned = str.replace(/[¥,，元]/g, "").trim();
  const match = cleaned.match(/([\d.]+)/);
  if (!match || !match[1]) return 0;
  const num = parseFloat(match[1]);
  if (cleaned.includes("万")) return num * 10000;
  return num;
}

function parseDate(str: string): string | undefined {
  if (!str || str.trim() === "") return undefined;
  const match = str.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
  }
  return undefined;
}

function parsePeriod(str: string): { effectiveDate?: string; expiryDate?: string } {
  if (!str || str.trim() === "") return {};
  const parts = str.split(/[-~～—]/);
  if (parts.length === 2) {
    const result: { effectiveDate?: string; expiryDate?: string } = {};
    const eff = parseDate(parts[0]!);
    const exp = parseDate(parts[1]!);
    if (eff) result.effectiveDate = eff;
    if (exp) result.expiryDate = exp;
    return result;
  }
  return {};
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split("\n");
  const headers = lines[0]!.split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]!.split(",");
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim() ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function clearDatabase() {
  db.run("DELETE FROM policy_extensions");
  db.run("DELETE FROM cash_values");
  db.run("DELETE FROM payments");
  db.run("DELETE FROM beneficiaries");
  db.run("DELETE FROM policies");
  db.run("DELETE FROM assets");
  db.run("DELETE FROM members");
  db.run("DELETE FROM settings");
}

async function importCSV() {
  console.log("Initializing database schema...");
  initSchema();

  console.log("Clearing existing data...");
  clearDatabase();

  console.log(`Reading CSV from: ${CSV_PATH}`);
  const content = readFileSync(CSV_PATH, "utf-8");
  const rows = parseCSV(content);
  console.log(`Found ${rows.length} rows`);

  const memberMap = new Map<string, number>();
  const uniqueMembers = new Set<string>();

  for (const row of rows) {
    const name = row["被保险人"]?.trim();
    if (name && name !== "") {
      uniqueMembers.add(name);
    }
  }

  console.log("\nCreating members...");
  for (const name of uniqueMembers) {
    const member: NewMember = {
      name,
      relation: "Self",
    };
    const created = membersRepo.create(member);
    memberMap.set(name, created.id);
    console.log(`  + ${name}`);
  }

  console.log("\nImporting policies...");
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const insuredName = row["被保险人"]?.trim();
    const productName = row["产品"]?.trim();
    const insurerName = row["保险公司"]?.trim();
    const policyNumber = row["保险单号"]?.trim();
    const categoryRaw = row["保障类型"]?.trim();

    if (!productName) {
      skipped++;
      continue;
    }

    const insuredMemberId = insuredName ? memberMap.get(insuredName) : undefined;
    const applicantId = insuredMemberId ?? memberMap.values().next().value;

    if (!applicantId) {
      console.log(`  ⚠ Skipping "${productName}" - no applicant`);
      skipped++;
      continue;
    }

    const category = categoryMap[categoryRaw ?? ""] ?? "Accident";
    const subCategory = row["子类别"]?.trim() || undefined;
    const channel = row["渠道"]?.trim() || undefined;
    const sumAssured = parseAmount(row["保额"] ?? "");
    const premium = parseAmount(row["年保费"] ?? "");

    const paymentFrequencyRaw = row["缴费期"]?.trim();
    const paymentFrequency = paymentFrequencyMap[paymentFrequencyRaw ?? ""] ?? "Yearly";

    const renewalRaw = row["续保"]?.trim();
    const renewalType = renewalTypeMap[renewalRaw ?? ""] || undefined;

    const effectiveDateRaw = row["生效日期"]?.trim();
    const effectiveDate = parseDate(effectiveDateRaw ?? "") ?? new Date().toISOString().split("T")[0]!;

    const periodRaw = row["保险期间"]?.trim();
    const period = parsePeriod(periodRaw ?? "");

    const nextDueDateRaw = row["下次缴费"]?.trim();
    const nextDueDate = parseDate(nextDueDateRaw ?? "");

    const paymentAccount = row["扣费账户"]?.trim() || undefined;
    const deathBenefit = row["身故"]?.trim() || undefined;
    const beneficiaryRaw = row["受益人"]?.trim() || undefined;
    const archivedRaw = row["存档"]?.trim();
    const archived = archivedRaw === "是" || archivedRaw === "true";

    const uniquePolicyNumber = policyNumber || `AUTO-${Date.now()}-${imported}`;

    const policy: NewPolicy = {
      applicantId,
      insuredType: "Member",
      insuredMemberId,
      category,
      subCategory,
      insurerName: insurerName || "未知",
      productName,
      policyNumber: uniquePolicyNumber,
      channel,
      sumAssured: sumAssured || 0,
      premium: premium || 0,
      paymentFrequency,
      renewalType,
      nextDueDate,
      paymentAccount,
      effectiveDate,
      expiryDate: period.expiryDate,
      deathBenefit,
      archived,
      status: archived ? "Surrendered" : "Active",
      notes: beneficiaryRaw ? `受益人: ${beneficiaryRaw}` : undefined,
    };

    try {
      policiesRepo.create(policy);
      console.log(`  + ${productName} (${insurerName || "未知"})`);
      imported++;
    } catch (error) {
      console.log(`  ⚠ Failed: ${productName} - ${error}`);
      skipped++;
    }
  }

  console.log("\n✅ Import completed!");
  console.log(`  Members: ${uniqueMembers.size}`);
  console.log(`  Policies imported: ${imported}`);
  console.log(`  Policies skipped: ${skipped}`);
}

importCSV().catch(console.error);
