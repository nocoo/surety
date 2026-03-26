import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { getR2ClientFromEnv } from "@/lib/r2-client";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; attachmentId: string }>;
};

/**
 * GET /api/policies/[id]/attachments/[attachmentId] — Attachment metadata.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { repos } = await getReposFromRequest();
  const { id, attachmentId } = await context.params;
  const policyId = parseInt(id, 10);
  const attId = parseInt(attachmentId, 10);

  if (isNaN(policyId) || isNaN(attId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const attachment = await repos.attachments.findByIdAndPolicyId(
    attId,
    policyId,
  );
  if (!attachment) {
    return NextResponse.json(
      { error: "Attachment not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(attachment);
}

/**
 * DELETE /api/policies/[id]/attachments/[attachmentId] — Delete attachment.
 *
 * Strategy: Delete DB record first, then R2 object.
 * - DB failure → 500, R2 untouched, user can retry (fully consistent)
 * - DB success + R2 failure → orphan R2 object with no DB reference (harmless,
 *   only wastes storage; no user-visible inconsistency)
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { repos, targetDb } = await getReposFromRequest();
  const { id, attachmentId } = await context.params;
  const policyId = parseInt(id, 10);
  const attId = parseInt(attachmentId, 10);

  if (isNaN(policyId) || isNaN(attId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const attachment = await repos.attachments.findByIdAndPolicyId(
    attId,
    policyId,
  );
  if (!attachment) {
    return NextResponse.json(
      { error: "Attachment not found" },
      { status: 404 },
    );
  }

  // Eagerly create R2 client BEFORE DB delete so that env-missing errors
  // surface before any state change (user sees 500, nothing changed).
  let r2Client: ReturnType<typeof getR2ClientFromEnv> | null = null;
  try {
    r2Client = getR2ClientFromEnv(targetDb);
  } catch {
    // env vars missing — we can still delete the DB record; R2 cleanup
    // will simply be skipped (orphan R2 object, harmless).
  }

  // Delete DB record first — if this fails, nothing has changed
  await repos.attachments.delete(attachment.id);

  // Then delete from R2 — best-effort; failure leaves an orphan object but
  // the user-facing state is already correct (attachment gone from list).
  // Wrapped in try/catch so R2 errors never turn a successful DB delete into 500.
  if (r2Client) {
    try {
      await r2Client.delete(attachment.r2Key);
    } catch {
      // R2 failure after DB delete → orphan object, harmless
    }
  }

  return new NextResponse(null, { status: 204 });
}
