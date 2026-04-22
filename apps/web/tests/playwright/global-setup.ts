import type { FullConfig } from "@playwright/test";

const PORT = Number(process.env.L3_PORT ?? 27012);
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function fetchJson(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { accept: "application/json" };
  let payload: string | undefined;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    // leave as text
  }
  return { status: res.status, body: parsed };
}

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/live`);
      if (res.ok) return;
    } catch {
      // not yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`L3 server health check failed at ${BASE_URL}`);
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  await waitForHealth();

  // Seed: one member + one policy so dashboard / list pages have content.
  const member = await fetchJson("POST", "/api/members", {
    name: "测试家庭成员",
    relation: "self",
    gender: "M",
  });
  if (member.status !== 201) {
    throw new Error(`seed member failed: ${member.status} ${JSON.stringify(member.body)}`);
  }
  const memberId = (member.body as { id: number }).id;

  const policy = await fetchJson("POST", "/api/policies", {
    applicantId: memberId,
    insuredType: "Member",
    insuredMemberId: memberId,
    category: "Health",
    insurerName: "测试保险公司",
    productName: "测试产品",
    policyNumber: "L3-SEED-001",
    effectiveDate: "2026-01-01",
    sumAssured: 1000000,
    premium: 5000,
    paymentFrequency: "Yearly",
  });
  if (policy.status !== 201) {
    throw new Error(`seed policy failed: ${policy.status} ${JSON.stringify(policy.body)}`);
  }

  const insurer = await fetchJson("POST", "/api/insurers", {
    name: "L3测试保险公司",
    phone: "400-123-4567",
  });
  if (insurer.status !== 201) {
    throw new Error(`seed insurer failed: ${insurer.status} ${JSON.stringify(insurer.body)}`);
  }
  process.env.L3_SEED_INSURER_ID = String((insurer.body as { id: number }).id);

  process.env.L3_SEED_MEMBER_ID = String(memberId);
  process.env.L3_SEED_POLICY_ID = String((policy.body as { id: number }).id);
}
