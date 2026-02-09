/**
 * Migration script: Extract beneficiaries from policy notes
 *
 * This script:
 * 1. Scans all policies for notes containing beneficiary info (e.g. "受益人: 张三")
 * 2. Matches beneficiary names to existing family members
 * 3. Creates structured beneficiary records in the beneficiaries table
 * 4. Removes the beneficiary text from notes
 *
 * Run with: bun run scripts/migrate-beneficiaries.ts
 */

import {
  policiesRepo,
  membersRepo,
  beneficiariesRepo,
} from "../src/db/repositories";

// Patterns to match beneficiary info in notes
// Supports: "受益人: 张三", "受益人：张三, 李四", "受益人: 张三（100%）"
const BENEFICIARY_LINE_PATTERN = /受益人[:：]\s*(.+)/;

interface ParsedBeneficiary {
  name: string;
  sharePercent: number;
}

function parseBeneficiaryLine(line: string): ParsedBeneficiary[] {
  const match = line.match(BENEFICIARY_LINE_PATTERN);
  if (!match || !match[1]) return [];

  const raw = match[1].trim();

  // Split by common separators
  const parts = raw.split(/[,，、;；]+/).map((s) => s.trim()).filter(Boolean);

  const beneficiaries: ParsedBeneficiary[] = [];

  for (const part of parts) {
    // Try to extract percentage: "张三（60%）" or "张三 60%"
    const percentMatch = part.match(/(.+?)\s*[（(]\s*(\d+)\s*%\s*[）)]/);
    if (percentMatch && percentMatch[1] && percentMatch[2]) {
      beneficiaries.push({
        name: percentMatch[1].trim(),
        sharePercent: parseInt(percentMatch[2], 10),
      });
    } else {
      beneficiaries.push({ name: part.trim(), sharePercent: 0 });
    }
  }

  // If no percentages specified, distribute equally
  const hasPercent = beneficiaries.some((b) => b.sharePercent > 0);
  if (!hasPercent && beneficiaries.length > 0) {
    const share = Math.floor(100 / beneficiaries.length);
    const remainder = 100 - share * beneficiaries.length;
    beneficiaries.forEach((b, i) => {
      b.sharePercent = share + (i === 0 ? remainder : 0);
    });
  }

  return beneficiaries;
}

function removeBeneficiaryFromNotes(notes: string): string {
  const lines = notes.split("\n");
  const filtered = lines.filter((line) => !BENEFICIARY_LINE_PATTERN.test(line));
  return filtered.join("\n").trim() || "";
}

async function migrateBeneficiaries() {
  console.log("🔄 Starting beneficiary migration...\n");

  const policies = policiesRepo.findAll();
  const members = membersRepo.findAll();
  const memberMap = new Map(members.map((m) => [m.name, m.id]));

  console.log(`Found ${policies.length} policies to scan`);
  console.log(`Found ${members.length} family members for matching\n`);

  let policiesProcessed = 0;
  let beneficiariesCreated = 0;
  let notesUpdated = 0;
  let skipped = 0;

  for (const policy of policies) {
    if (!policy.notes) continue;
    if (!BENEFICIARY_LINE_PATTERN.test(policy.notes)) continue;

    policiesProcessed++;

    // Check if beneficiaries already exist for this policy
    const existing = beneficiariesRepo.findByPolicyId(policy.id);
    if (existing.length > 0) {
      console.log(
        `  ⏭️  Policy #${policy.id} (${policy.productName}): already has ${existing.length} beneficiaries, skipping`,
      );
      skipped++;
      continue;
    }

    const parsed = parseBeneficiaryLine(policy.notes);
    if (parsed.length === 0) continue;

    console.log(
      `  📋 Policy #${policy.id} (${policy.productName}): found ${parsed.length} beneficiaries in notes`,
    );

    for (const [index, b] of parsed.entries()) {
      const memberId = memberMap.get(b.name);

      beneficiariesRepo.create({
        policyId: policy.id,
        memberId: memberId ?? undefined,
        externalName: memberId ? undefined : b.name,
        sharePercent: b.sharePercent,
        rankOrder: 1, // Default to first rank
      });

      const source = memberId ? `member #${memberId}` : "external";
      console.log(
        `     ${index + 1}. ${b.name} (${source}, ${b.sharePercent}%)`,
      );
      beneficiariesCreated++;
    }

    // Clean up notes
    const cleanedNotes = removeBeneficiaryFromNotes(policy.notes);
    policiesRepo.update(policy.id, {
      notes: cleanedNotes || null,
    });
    notesUpdated++;
  }

  console.log(`\n✅ Migration completed!`);
  console.log(`  Policies scanned: ${policies.length}`);
  console.log(`  Policies with beneficiary notes: ${policiesProcessed}`);
  console.log(`  Policies skipped (already had beneficiaries): ${skipped}`);
  console.log(`  Beneficiaries created: ${beneficiariesCreated}`);
  console.log(`  Notes cleaned up: ${notesUpdated}`);
}

migrateBeneficiaries().catch(console.error);
