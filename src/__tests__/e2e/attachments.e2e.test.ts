/**
 * Attachments API E2E Tests
 *
 * Tests file attachment upload/download/delete via real HTTP calls:
 * - POST /api/policies/[id]/attachments (upload)
 * - GET /api/policies/[id]/attachments (list)
 * - GET /api/policies/[id]/attachments/[attachmentId] (metadata)
 * - GET /api/policies/[id]/attachments/[attachmentId]/file (download)
 * - DELETE /api/policies/[id]/attachments/[attachmentId]
 *
 * Requires:
 * - R2 test bucket (surety-test) configured
 * - Worker deployed with R2_TEST binding
 */
import { describe, expect, test, beforeAll, afterAll, afterEach } from "bun:test";
import { setupE2E, teardownE2E, getBaseUrl } from "./setup";

interface Attachment {
  id: number;
  policyId: number;
  filename: string;
  r2Key: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

interface Policy {
  id: number;
  policyNumber: string;
}

interface ErrorResponse {
  error: string;
}

// Test file content - a minimal valid PDF
const TEST_PDF_CONTENT = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n101\n%%EOF"
);

// Minimal valid PNG (1x1 transparent pixel)
const TEST_PNG_CONTENT = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, // RGBA, filter
  0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
  0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, // compressed data
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, // IEND chunk
  0xae, 0x42, 0x60, 0x82
]);

let testPolicyId: number;
const createdAttachmentIds: number[] = [];

/**
 * Helper to upload a file via multipart form
 */
async function uploadFile(
  policyId: number,
  filename: string,
  content: Buffer,
  contentType: string
): Promise<{ status: number; data: Attachment | ErrorResponse }> {
  const formData = new FormData();
  // Convert Buffer to Uint8Array for Blob compatibility
  const blob = new Blob([new Uint8Array(content)], { type: contentType });
  formData.append("file", blob, filename);

  const response = await fetch(
    `${getBaseUrl()}/api/policies/${policyId}/attachments`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();
  return { status: response.status, data };
}

/**
 * Helper to list attachments
 */
async function listAttachments(
  policyId: number
): Promise<{ status: number; data: Attachment[] | ErrorResponse }> {
  const response = await fetch(
    `${getBaseUrl()}/api/policies/${policyId}/attachments`
  );
  const data = await response.json();
  return { status: response.status, data };
}

/**
 * Helper to get attachment metadata
 */
async function getAttachment(
  policyId: number,
  attachmentId: number
): Promise<{ status: number; data: Attachment | ErrorResponse }> {
  const response = await fetch(
    `${getBaseUrl()}/api/policies/${policyId}/attachments/${attachmentId}`
  );
  const data = await response.json();
  return { status: response.status, data };
}

/**
 * Helper to download attachment file
 */
async function downloadAttachmentFile(
  policyId: number,
  attachmentId: number
): Promise<{ status: number; data: ArrayBuffer | null; contentType: string | null }> {
  const response = await fetch(
    `${getBaseUrl()}/api/policies/${policyId}/attachments/${attachmentId}/file`
  );
  
  if (!response.ok) {
    return { status: response.status, data: null, contentType: null };
  }
  
  return {
    status: response.status,
    data: await response.arrayBuffer(),
    contentType: response.headers.get("content-type"),
  };
}

/**
 * Helper to delete attachment
 */
async function deleteAttachment(
  policyId: number,
  attachmentId: number
): Promise<{ status: number }> {
  const response = await fetch(
    `${getBaseUrl()}/api/policies/${policyId}/attachments/${attachmentId}`,
    { method: "DELETE" }
  );
  return { status: response.status };
}

describe("Attachments API E2E", () => {
  beforeAll(async () => {
    await setupE2E();
    
    // Get a test policy to use
    const response = await fetch(`${getBaseUrl()}/api/policies`);
    const policies = await response.json() as Policy[];
    if (policies.length > 0 && policies[0]) {
      testPolicyId = policies[0].id;
    } else {
      throw new Error("No policies found for attachment tests");
    }
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  });

  // Clean up created attachments after each test
  afterEach(async () => {
    for (const id of createdAttachmentIds) {
      await deleteAttachment(testPolicyId, id).catch(() => {});
    }
    createdAttachmentIds.length = 0;
  });

  describe("POST /api/policies/[id]/attachments", () => {
    test("uploads a PDF file", async () => {
      const { status, data } = await uploadFile(
        testPolicyId,
        "test-document.pdf",
        TEST_PDF_CONTENT,
        "application/pdf"
      );

      expect(status).toBe(201);
      const attachment = data as Attachment;
      expect(attachment.id).toBeGreaterThan(0);
      expect(attachment.policyId).toBe(testPolicyId);
      expect(attachment.filename).toBe("test-document.pdf");
      expect(attachment.contentType).toBe("application/pdf");
      expect(attachment.size).toBe(TEST_PDF_CONTENT.length);
      expect(attachment.r2Key).toContain("policies/");
      
      createdAttachmentIds.push(attachment.id);
    });

    test("uploads a PNG image", async () => {
      const { status, data } = await uploadFile(
        testPolicyId,
        "test-image.png",
        TEST_PNG_CONTENT,
        "image/png"
      );

      expect(status).toBe(201);
      const attachment = data as Attachment;
      expect(attachment.contentType).toBe("image/png");
      
      createdAttachmentIds.push(attachment.id);
    });

    test("returns 404 for non-existent policy", async () => {
      const { status, data } = await uploadFile(
        999999,
        "test.pdf",
        TEST_PDF_CONTENT,
        "application/pdf"
      );

      expect(status).toBe(404);
      expect((data as ErrorResponse).error).toContain("not found");
    });

    test("returns 400 for invalid policy ID", async () => {
      const formData = new FormData();
      const blob = new Blob([TEST_PDF_CONTENT], { type: "application/pdf" });
      formData.append("file", blob, "test.pdf");

      const response = await fetch(
        `${getBaseUrl()}/api/policies/invalid/attachments`,
        { method: "POST", body: formData }
      );

      expect(response.status).toBe(400);
    });

    test("returns 400 when no file provided", async () => {
      const response = await fetch(
        `${getBaseUrl()}/api/policies/${testPolicyId}/attachments`,
        {
          method: "POST",
          body: new FormData(), // Empty form
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("file");
    });

    test("returns 400 for unsupported file type", async () => {
      const { status, data } = await uploadFile(
        testPolicyId,
        "test.exe",
        Buffer.from("MZ..."), // Fake executable
        "application/x-msdownload"
      );

      expect(status).toBe(400);
      expect((data as ErrorResponse).error).toBeDefined();
    });
  });

  describe("GET /api/policies/[id]/attachments", () => {
    test("returns empty list for policy with no attachments", async () => {
      // Use a different policy that likely has no attachments
      const response = await fetch(`${getBaseUrl()}/api/policies`);
      const policies = await response.json() as Policy[];
      const otherPolicy = policies.find(p => p.id !== testPolicyId);
      
      if (otherPolicy) {
        const { status, data } = await listAttachments(otherPolicy.id);
        expect(status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
      }
    });

    test("returns list with uploaded attachment", async () => {
      // Upload first
      const uploadResult = await uploadFile(
        testPolicyId,
        "list-test.pdf",
        TEST_PDF_CONTENT,
        "application/pdf"
      );
      expect(uploadResult.status).toBe(201);
      createdAttachmentIds.push((uploadResult.data as Attachment).id);

      // List
      const { status, data } = await listAttachments(testPolicyId);
      expect(status).toBe(200);
      
      const attachments = data as Attachment[];
      expect(Array.isArray(attachments)).toBe(true);
      expect(attachments.length).toBeGreaterThan(0);
      
      const uploaded = attachments.find(a => a.filename === "list-test.pdf");
      expect(uploaded).toBeDefined();
    });

    test("returns 404 for non-existent policy", async () => {
      const { status, data } = await listAttachments(999999);
      expect(status).toBe(404);
      expect((data as ErrorResponse).error).toContain("not found");
    });

    test("returns 400 for invalid policy ID", async () => {
      const response = await fetch(
        `${getBaseUrl()}/api/policies/invalid/attachments`
      );
      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/policies/[id]/attachments/[attachmentId]", () => {
    test("returns attachment metadata", async () => {
      // Upload first
      const uploadResult = await uploadFile(
        testPolicyId,
        "metadata-test.pdf",
        TEST_PDF_CONTENT,
        "application/pdf"
      );
      const uploaded = uploadResult.data as Attachment;
      createdAttachmentIds.push(uploaded.id);

      // Get metadata
      const { status, data } = await getAttachment(testPolicyId, uploaded.id);
      expect(status).toBe(200);
      
      const attachment = data as Attachment;
      expect(attachment.id).toBe(uploaded.id);
      expect(attachment.filename).toBe("metadata-test.pdf");
      expect(attachment.contentType).toBe("application/pdf");
    });

    test("returns 404 for non-existent attachment", async () => {
      const { status, data } = await getAttachment(testPolicyId, 999999);
      expect(status).toBe(404);
      expect((data as ErrorResponse).error).toContain("not found");
    });
  });

  describe("GET /api/policies/[id]/attachments/[attachmentId]/file", () => {
    test("downloads the uploaded file", async () => {
      // Upload first
      const uploadResult = await uploadFile(
        testPolicyId,
        "download-test.pdf",
        TEST_PDF_CONTENT,
        "application/pdf"
      );
      const uploaded = uploadResult.data as Attachment;
      createdAttachmentIds.push(uploaded.id);

      // Download
      const { status, data, contentType } = await downloadAttachmentFile(
        testPolicyId,
        uploaded.id
      );

      expect(status).toBe(200);
      expect(contentType).toBe("application/pdf");
      expect(data).not.toBeNull();
      
      // Verify content matches
      expect(data).not.toBeNull();
      const downloadedContent = Buffer.from(data as ArrayBuffer);
      expect(downloadedContent.length).toBe(TEST_PDF_CONTENT.length);
      expect(downloadedContent.toString()).toBe(TEST_PDF_CONTENT.toString());
    });

    test("returns 404 for non-existent attachment", async () => {
      const { status } = await downloadAttachmentFile(testPolicyId, 999999);
      expect(status).toBe(404);
    });
  });

  describe("DELETE /api/policies/[id]/attachments/[attachmentId]", () => {
    test("deletes an attachment", async () => {
      // Upload first
      const uploadResult = await uploadFile(
        testPolicyId,
        "delete-test.pdf",
        TEST_PDF_CONTENT,
        "application/pdf"
      );
      const uploaded = uploadResult.data as Attachment;

      // Delete
      const { status } = await deleteAttachment(testPolicyId, uploaded.id);
      expect(status).toBe(204);

      // Verify it's gone
      const { status: getStatus } = await getAttachment(testPolicyId, uploaded.id);
      expect(getStatus).toBe(404);
    });

    test("returns 404 for non-existent attachment", async () => {
      const { status } = await deleteAttachment(testPolicyId, 999999);
      expect(status).toBe(404);
    });
  });

  describe("Full attachment lifecycle", () => {
    test("upload → list → get metadata → download → delete", async () => {
      // 1. Upload
      const uploadResult = await uploadFile(
        testPolicyId,
        "lifecycle-test.pdf",
        TEST_PDF_CONTENT,
        "application/pdf"
      );
      expect(uploadResult.status).toBe(201);
      const attachment = uploadResult.data as Attachment;

      // 2. List (should include uploaded file)
      const listResult = await listAttachments(testPolicyId);
      expect(listResult.status).toBe(200);
      const list = listResult.data as Attachment[];
      expect(list.some(a => a.id === attachment.id)).toBe(true);

      // 3. Get metadata
      const getResult = await getAttachment(testPolicyId, attachment.id);
      expect(getResult.status).toBe(200);
      expect((getResult.data as Attachment).filename).toBe("lifecycle-test.pdf");

      // 4. Download
      const downloadResult = await downloadAttachmentFile(testPolicyId, attachment.id);
      expect(downloadResult.status).toBe(200);
      expect(downloadResult.data).not.toBeNull();
      expect(Buffer.from(downloadResult.data as ArrayBuffer).toString()).toBe(TEST_PDF_CONTENT.toString());

      // 5. Delete
      const deleteResult = await deleteAttachment(testPolicyId, attachment.id);
      expect(deleteResult.status).toBe(204);

      // 6. Verify deleted
      const verifyResult = await getAttachment(testPolicyId, attachment.id);
      expect(verifyResult.status).toBe(404);
    });
  });
});
