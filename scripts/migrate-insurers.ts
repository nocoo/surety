/**
 * Migration script: Extract insurers from policies
 * 
 * This script:
 * 1. Extracts unique insurer names from existing policies
 * 2. Creates insurer records in the insurers table
 * 3. Updates policies with the corresponding insurer_id
 * 
 * Run with: bun run scripts/migrate-insurers.ts
 */

import { insurersRepo, policiesRepo } from "../src/db/repositories";

async function migrateInsurers() {
  console.log("🔄 Starting insurer migration...\n");

  // Get all policies
  const policies = policiesRepo.findAll();
  console.log(`Found ${policies.length} policies to process`);

  // Extract unique insurer names
  const uniqueInsurerNames = new Set<string>();
  for (const policy of policies) {
    if (policy.insurerName) {
      uniqueInsurerNames.add(policy.insurerName);
    }
  }

  console.log(`Found ${uniqueInsurerNames.size} unique insurer names`);

  // Create insurer records
  const insurerMap = new Map<string, number>();
  let created = 0;
  let existing = 0;

  for (const name of uniqueInsurerNames) {
    const insurer = insurersRepo.findOrCreate(name);
    insurerMap.set(name, insurer.id);
    
    // Check if it was newly created by comparing timestamps
    const timeDiff = Date.now() - insurer.createdAt.getTime();
    if (timeDiff < 1000) {
      created++;
    } else {
      existing++;
    }
  }

  console.log(`  Created: ${created} new insurers`);
  console.log(`  Existing: ${existing} insurers already existed`);

  // Update policies with insurer_id
  let updated = 0;

  for (const policy of policies) {
    const insurerId = insurerMap.get(policy.insurerName);
    if (insurerId && policy.insurerId !== insurerId) {
      policiesRepo.update(policy.id, { insurerId });
      updated++;
    }
  }

  console.log(`\n✅ Migration completed!`);
  console.log(`  Insurers: ${uniqueInsurerNames.size}`);
  console.log(`  Policies updated: ${updated}`);

  // Show insurer summary
  console.log("\n📋 Insurer Summary:");
  const allInsurers = insurersRepo.findAll();
  for (const insurer of allInsurers) {
    const policyCount = policies.filter(p => p.insurerName === insurer.name).length;
    const phoneStatus = insurer.phone ? `📞 ${insurer.phone}` : "⚠️ No phone";
    console.log(`  - ${insurer.name}: ${policyCount} policies (${phoneStatus})`);
  }
}

migrateInsurers().catch(console.error);
