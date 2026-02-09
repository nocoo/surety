import { NextResponse } from "next/server";
import { ensureDbFromRequest } from "@/lib/api-helpers";

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
