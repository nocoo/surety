/**
 * Seed script: Populate insurer contact information
 *
 * This script updates insurers with their official customer service hotlines and websites.
 * Data sourced from official insurer websites.
 *
 * Uses bun:sqlite directly (not the D1 Worker proxy) since this is a local script.
 *
 * Run with: SURETY_DB=database/surety.db bun run scripts/seed-insurer-contacts.ts
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../src/db/schema";
import { insurers } from "../src/db/schema";
import { eq } from "drizzle-orm";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dbFile = process.env.SURETY_DB;

if (!dbFile) {
  console.error(
    "❌ BLOCKED: SURETY_DB is not set.\n\n" +
    "   Usage:\n" +
    "     SURETY_DB=database/surety.db bun run scripts/seed-insurer-contacts.ts\n"
  );
  process.exit(1);
}

const dbPath = resolve(PROJECT_ROOT, dbFile);

// Official customer service hotlines and websites for Chinese insurers
// All phone numbers are official 24-hour customer service lines
const insurerContacts: Record<string, { phone: string; website: string }> = {
  // CPIC Group (中国太平洋保险集团)
  "太平洋财险": {
    phone: "95500",
    website: "https://www.cpic.com.cn",
  },
  "太平洋健康": {
    phone: "95500",
    website: "https://health.cpic.com.cn",
  },

  // China Taiping Insurance Group (中国太平保险集团)
  "中国太平": {
    phone: "95589",
    website: "https://www.cntaiping.com",
  },

  // Junlong Life (君龙人寿) - formerly KGI Life
  "君龙人寿": {
    phone: "400-666-0123",
    website: "https://www.kdlins.com.cn",
  },

  // PICC Group (中国人民保险集团)
  "人保健康": {
    phone: "95518",
    website: "https://www.picchealth.com",
  },
  "人保财险": {
    phone: "95518",
    website: "https://www.epicc.com.cn",
  },

  // Ruihua Health Insurance (瑞华健康保险)
  "瑞华健康": {
    phone: "400-609-6868",
    website: "https://www.rhassurance.com",
  },

  // Sunshine Insurance Group (阳光保险集团)
  "阳光人寿": {
    phone: "95510",
    website: "https://wecare.sinosig.com",
  },

  // Guofu Life (国富人寿)
  "国富人寿": {
    phone: "400-694-6688",
    website: "https://www.e-guofu.com",
  },

  // Huagui Insurance (华贵保险)
  "华贵保险": {
    phone: "400-684-1888",
    website: "https://www.huaguilife.cn",
  },

  // Everbright Sun Life (光大永明人寿)
  "光大永明": {
    phone: "95105698",
    website: "https://www.sunlife-everbright.com",
  },

  // Bohai Property Insurance (渤海财险)
  "渤海财险": {
    phone: "95541",
    website: "https://www.bpic.com.cn",
  },

  // China Life (中国人寿)
  "中国人寿": {
    phone: "95519",
    website: "https://www.chinalife.com.cn",
  },
};

async function seedInsurerContacts() {
  console.log(`Opening database: ${dbPath}`);
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema });

  console.log("🔄 Seeding insurer contact information...\n");

  const existingInsurers = db.select().from(insurers).all();
  console.log(`Found ${existingInsurers.length} insurers in database`);

  let updated = 0;
  let notFound = 0;

  for (const insurer of existingInsurers) {
    const contact = insurerContacts[insurer.name];

    if (contact) {
      db.update(insurers)
        .set({
          phone: contact.phone,
          website: contact.website,
          updatedAt: new Date(),
        })
        .where(eq(insurers.id, insurer.id))
        .run();

      console.log(`  ✅ ${insurer.name}: ${contact.phone} | ${contact.website}`);
      updated++;
    } else {
      console.log(`  ⚠️ ${insurer.name}: No contact data found`);
      notFound++;
    }
  }

  sqlite.close();

  console.log(`\n✅ Seed completed!`);
  console.log(`  Updated: ${updated} insurers`);
  console.log(`  Not found: ${notFound} insurers`);
}

seedInsurerContacts().catch(console.error);
