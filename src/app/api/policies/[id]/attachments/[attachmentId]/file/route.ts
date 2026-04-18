import { NextRequest, NextResponse } from "next/server";
import { getReposFromRequest } from "@/lib/api-helpers";
import { getR2ClientFromEnv, R2Error } from "@/lib/r2-client";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; attachmentId: string }>;
};

/**
 * GET /api/policies/[id]/attachments/[attachmentId]/file
 *
 * Stream file content from R2 for preview or download.
 * - Default: Content-Disposition: inline (for PDF preview in iframe)
 * - ?download=true: Content-Disposition: attachment (triggers download)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const __auth = await requireAuth();
  if (__auth instanceof Response) return __auth;
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

  // Proxy from R2 via Worker
  const r2Client = getR2ClientFromEnv(targetDb);
  let r2Response: Response;
  try {
    r2Response = await r2Client.download(attachment.r2Key);
  } catch (error) {
    if (error instanceof R2Error && error.status === 404) {
      return NextResponse.json(
        { error: "File not found in storage" },
        { status: 404 },
      );
    }
    throw error; // other errors → 500
  }

  // Determine disposition from query param
  const download =
    request.nextUrl.searchParams.get("download") === "true";

  const disposition = download ? "attachment" : "inline";

  const headers = new Headers();
  headers.set("Content-Type", attachment.contentType);
  headers.set("Content-Length", attachment.size.toString());
  // no-store: URL is attachment-ID-based (not content-addressed), so a deleted
  // attachment must not be served from browser cache.
  headers.set("Cache-Control", "no-store");
  headers.set(
    "Content-Disposition",
    buildContentDisposition(disposition, attachment.filename),
  );

  return new NextResponse(r2Response.body, { headers });
}

/**
 * Build Content-Disposition header with RFC 5987 filename encoding.
 * Sets both `filename` (ASCII fallback) and `filename*` (UTF-8 encoded).
 */
function buildContentDisposition(
  type: "inline" | "attachment",
  filename: string,
): string {
  // ASCII fallback: replace non-ASCII and problematic chars with underscore
  const asciiName = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  // RFC 5987: UTF-8 percent-encoded
  const utf8Name = encodeURIComponent(filename).replace(
    /['()]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${type}; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`;
}
