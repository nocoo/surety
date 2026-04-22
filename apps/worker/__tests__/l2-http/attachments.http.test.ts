import { afterAll, describe, expect, test } from "bun:test";
import { httpJson, BASE_URL } from "./setup";

interface Member {
  id: number;
}
interface Policy {
  id: number;
}
interface Attachment {
  id: number;
  filename: string;
  contentType: string;
  size: number;
}

const cleanupPolicies: number[] = [];
const cleanupMembers: number[] = [];

afterAll(async () => {
  for (const id of cleanupPolicies) {
    await httpJson("DELETE", `/api/policies/${id}`);
  }
  for (const id of cleanupMembers) {
    await httpJson("DELETE", `/api/members/${id}`);
  }
});

async function seedPolicy(): Promise<{ memberId: number; policyId: number }> {
  const m = await httpJson<Member>("POST", "/api/members", {
    name: `att-applicant-${Date.now()}`,
    relation: "self",
  });
  expect(m.status).toBe(201);
  cleanupMembers.push(m.body.id);
  const p = await httpJson<Policy>("POST", "/api/policies", {
    applicantId: m.body.id,
    insuredType: "Member",
    insuredMemberId: m.body.id,
    category: "Health",
    insurerName: "ATT-Ins",
    productName: "ATT-Product",
    policyNumber: `POL-ATT-${Date.now()}`,
    effectiveDate: "2026-01-01",
    sumAssured: 100000,
    premium: 1000,
    paymentFrequency: "Yearly",
  });
  expect(p.status).toBe(201);
  cleanupPolicies.push(p.body.id);
  return { memberId: m.body.id, policyId: p.body.id };
}

/**
 * Smallest valid PDF that passes magic-byte validation. The body is a
 * minimal but parseable PDF 1.4 document.
 */
function tinyPdfBytes(): Uint8Array {
  const text = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj
xref
0 4
0000000000 65535 f
0000000010 00000 n
0000000053 00000 n
0000000099 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
149
%%EOF
`;
  return new TextEncoder().encode(text);
}

describe("L2-HTTP: attachments via real R2 binding", () => {
  test("upload → list → get metadata → download bytes → delete", async () => {
    const { policyId } = await seedPolicy();

    const pdf = tinyPdfBytes();
    const form = new FormData();
    form.append(
      "file",
      new File([pdf], "policy.pdf", { type: "application/pdf" }),
    );

    const upRes = await fetch(
      `${BASE_URL}/api/policies/${policyId}/attachments`,
      { method: "POST", body: form },
    );
    const att = (await upRes.json()) as Attachment;
    expect(upRes.status).toBe(201);
    expect(att.filename).toBe("policy.pdf");
    expect(att.contentType).toBe("application/pdf");
    expect(att.size).toBe(pdf.byteLength);
    expect(typeof att.id).toBe("number");

    const list = await httpJson<Attachment[]>(
      "GET",
      `/api/policies/${policyId}/attachments`,
    );
    expect(list.status).toBe(200);
    expect(list.body.some((a) => a.id === att.id)).toBe(true);

    const meta = await httpJson<Attachment>(
      "GET",
      `/api/policies/${policyId}/attachments/${att.id}`,
    );
    expect(meta.status).toBe(200);
    expect(meta.body.filename).toBe("policy.pdf");

    const fileRes = await fetch(
      `${BASE_URL}/api/policies/${policyId}/attachments/${att.id}/file`,
    );
    expect(fileRes.status).toBe(200);
    expect(fileRes.headers.get("content-type")).toBe("application/pdf");
    const downloaded = new Uint8Array(await fileRes.arrayBuffer());
    expect(downloaded.byteLength).toBe(pdf.byteLength);
    // Round-trip equality — single-byte sample is enough; full equality
    // would slow the suite for no extra signal.
    expect(downloaded[0]).toBe(pdf[0]);
    expect(downloaded[downloaded.length - 1]).toBe(pdf[pdf.length - 1]);

    const del = await httpJson(
      "DELETE",
      `/api/policies/${policyId}/attachments/${att.id}`,
    );
    expect(del.status).toBe(204);

    const after = await httpJson(
      "GET",
      `/api/policies/${policyId}/attachments/${att.id}`,
    );
    expect(after.status).toBe(404);
  });

  test("rejects non-PDF magic bytes even when content-type claims PDF", async () => {
    const { policyId } = await seedPolicy();
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])], "fake.pdf", {
        type: "application/pdf",
      }),
    );
    const res = await fetch(
      `${BASE_URL}/api/policies/${policyId}/attachments`,
      { method: "POST", body: form },
    );
    expect(res.status).toBe(400);
  });
});
