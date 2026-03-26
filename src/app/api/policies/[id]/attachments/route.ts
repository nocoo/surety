import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { getR2ClientFromEnv } from "@/lib/r2-client";
import {
  validateFile,
  validatePdfMagicBytes,
  generateR2Key,
  MAX_FILE_SIZE,
  MAX_ATTACHMENTS_PER_POLICY,
} from "@/lib/attachment-validation";

export const dynamic = "force-dynamic";

/**
 * Maximum request body size for multipart upload.
 * Slightly larger than MAX_FILE_SIZE to account for multipart boundary overhead.
 */
const MAX_REQUEST_BODY_SIZE = MAX_FILE_SIZE + 1024 * 1024; // 51 MB

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/policies/[id]/attachments — Upload a PDF attachment.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // Pre-check Content-Length before buffering the body into memory.
  // This is a best-effort guard: Content-Length can be spoofed or absent,
  // but it rejects honest oversized uploads before allocating memory.
  // The real file.size check after formData() catches everything else.
  const contentLength = parseInt(
    request.headers.get("content-length") ?? "",
    10,
  );
  if (!isNaN(contentLength) && contentLength > MAX_REQUEST_BODY_SIZE) {
    return NextResponse.json(
      { error: `Request too large. Maximum upload size is ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  const { repos, targetDb } = await getReposFromRequest();
  const { id } = await context.params;
  const policyId = parseInt(id, 10);

  if (isNaN(policyId)) {
    return NextResponse.json({ error: "Invalid policy ID" }, { status: 400 });
  }

  // Verify policy exists
  const policy = await repos.policies.findById(policyId);
  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  // Parse multipart form — this buffers the entire body into memory (Next.js limitation).
  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate content type and size (authoritative check — Content-Length above was advisory)
  const validation = validateFile(file.type, file.size);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Validate PDF magic bytes (prevents spoofed Content-Type)
  const magicCheck = await validatePdfMagicBytes(file);
  if (!magicCheck.valid) {
    return NextResponse.json({ error: magicCheck.error }, { status: 400 });
  }

  // Check attachment count limit (soft limit — concurrent uploads can exceed by 1-2;
  // acceptable for a family app, strict enforcement would require DB-level constraint)
  const count = await repos.attachments.countByPolicyId(policyId);
  if (count >= MAX_ATTACHMENTS_PER_POLICY) {
    return NextResponse.json(
      { error: `Maximum ${MAX_ATTACHMENTS_PER_POLICY} attachments per policy` },
      { status: 400 },
    );
  }

  // Upload to R2 (stream, no extra buffering)
  // R2 failure here → uncaught → 500 (no DB record created = no orphan)
  const r2Key = generateR2Key(policyId, file.name);
  const r2Client = getR2ClientFromEnv(targetDb);
  await r2Client.upload(r2Key, file.stream(), file.type);

  // Create DB record — if this fails, clean up the R2 orphan
  let attachment;
  try {
    attachment = await repos.attachments.create({
      policyId,
      filename: file.name,
      r2Key,
      contentType: file.type,
      size: file.size,
    });
  } catch (dbError) {
    // Best-effort orphan cleanup — don't let cleanup failure mask the real error
    await r2Client.delete(r2Key).catch(() => {});
    throw dbError;
  }

  return NextResponse.json(attachment, { status: 201 });
}

/**
 * GET /api/policies/[id]/attachments — List all attachments.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { repos } = await getReposFromRequest();
  const { id } = await context.params;
  const policyId = parseInt(id, 10);

  if (isNaN(policyId)) {
    return NextResponse.json({ error: "Invalid policy ID" }, { status: 400 });
  }

  // Verify policy exists — don't silently return [] for nonexistent policies
  const policy = await repos.policies.findById(policyId);
  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  const list = await repos.attachments.findByPolicyId(policyId);
  return NextResponse.json(list);
}
