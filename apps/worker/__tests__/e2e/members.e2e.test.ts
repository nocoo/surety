/**
 * L2 E2E — full HTTP lifecycle for the members module against an in-memory
 * Drizzle DB. Drives the same Hono routes that production exposes.
 */
import { describe, expect, test } from "bun:test";
import { buildTestApp, jsonRequest } from "./setup";

describe("L2 E2E: /api/live", () => {
  test("returns ok with version + database probe", async () => {
    const env = buildTestApp();
    const { status, body } = await jsonRequest(env, "GET", "/api/live");
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.status).toBe("ok");
    expect(typeof b.version).toBe("string");
    expect((b.database as { connected: boolean }).connected).toBe(true);
  });
});

describe("L2 E2E: /api/members CRUD", () => {
  test("full create → list → get → update → delete cycle", async () => {
    const env = buildTestApp();

    // empty list
    const ls0 = await jsonRequest(env, "GET", "/api/members");
    expect(ls0.status).toBe(200);
    expect(ls0.body).toEqual([]);

    // create
    const c1 = await jsonRequest(env, "POST", "/api/members", {
      name: "张三",
      relation: "self",
      gender: "male",
    });
    expect(c1.status).toBe(201);
    const created = c1.body as { id: number; name: string; relation: string };
    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe("张三");

    // list contains
    const ls1 = await jsonRequest(env, "GET", "/api/members");
    expect((ls1.body as unknown[]).length).toBe(1);

    // get
    const g1 = await jsonRequest(env, "GET", `/api/members/${created.id}`);
    expect(g1.status).toBe(200);

    // update
    const u1 = await jsonRequest(env, "PUT", `/api/members/${created.id}`, {
      name: "张三（更新）",
      relation: "self",
    });
    expect(u1.status).toBe(200);
    expect((u1.body as { name: string }).name).toBe("张三（更新）");

    // delete
    const d1 = await jsonRequest(env, "DELETE", `/api/members/${created.id}`);
    expect(d1.status).toBe(200);

    // get after delete
    const g2 = await jsonRequest(env, "GET", `/api/members/${created.id}`);
    expect(g2.status).toBe(404);
  });

  test("validates required fields on create", async () => {
    const env = buildTestApp();
    const r = await jsonRequest(env, "POST", "/api/members", { name: "no rel" });
    expect(r.status).toBe(400);
  });

  test("rejects non-numeric id", async () => {
    const env = buildTestApp();
    const r = await jsonRequest(env, "GET", "/api/members/abc");
    expect(r.status).toBe(400);
  });

  test("delete blocked when member is policyholder", async () => {
    const env = buildTestApp();
    const c1 = await jsonRequest(env, "POST", "/api/members", {
      name: "投保人",
      relation: "self",
    });
    const memberId = (c1.body as { id: number }).id;

    const p1 = await jsonRequest(env, "POST", "/api/policies", {
      applicantId: memberId,
      insuredType: "Member",
      insuredMemberId: memberId,
      category: "Life",
      insurerName: "Test Insurer",
      productName: "Test Product",
      policyNumber: "POL-001",
      effectiveDate: "2026-01-01",
    });
    expect(p1.status).toBe(201);

    const d = await jsonRequest(env, "DELETE", `/api/members/${memberId}`);
    expect(d.status).toBe(409);
  });
});
