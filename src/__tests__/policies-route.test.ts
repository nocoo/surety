/**
 * Unit tests for GET / PUT / DELETE handlers in
 * src/app/api/policies/[id]/route.ts using mocked repos.
 *
 * These tests cover the success paths that existing coverage was missing:
 * - GET: 200 success, 400 invalid id, 404 missing
 * - PUT: 200 success, 400 invalid id, 409 duplicate policy number
 * - DELETE: 200 success (batch + non-batch), 400 invalid id, 404 missing
 */
import { describe, expect, test, mock, beforeEach } from "bun:test";
import type { NextRequest } from "next/server";

// --- Mock setup (must precede route import) ---

const policiesFindById = mock(() => Promise.resolve<Record<string, unknown> | undefined>(undefined));
const policiesUpdate = mock(() => Promise.resolve<Record<string, unknown> | undefined>(undefined));
const policiesDelete = mock(() => Promise.resolve(true));

const insurersFindOrCreate = mock(() =>
  Promise.resolve({ id: 42, name: "示例保险", created: false }),
);
const insurersDelete = mock(() => Promise.resolve(true));

const membersFindAll = mock(() =>
  Promise.resolve([
    { id: 1, name: "张三" },
    { id: 2, name: "李四" },
  ]),
);
const assetsFindAll = mock(() =>
  Promise.resolve([
    { id: 10, name: "房产A" },
  ]),
);

const attachmentsFindByPolicyId = mock(() => Promise.resolve<Array<{ r2Key: string }>>([]));
const attachmentsDeleteByPolicyId = mock(() => Promise.resolve(0));
const beneficiariesDeleteByPolicyId = mock(() => Promise.resolve(0));
const paymentsDeleteByPolicyId = mock(() => Promise.resolve(0));
const cashValuesDeleteByPolicyId = mock(() => Promise.resolve(0));
const coverageItemsDeleteByPolicyId = mock(() => Promise.resolve(0));

const batchExecute = mock(() => Promise.resolve());

const mockRepos = {
  policies: {
    findById: policiesFindById,
    update: policiesUpdate,
    delete: policiesDelete,
  },
  insurers: {
    findOrCreate: insurersFindOrCreate,
    delete: insurersDelete,
  },
  members: { findAll: membersFindAll },
  assets: { findAll: assetsFindAll },
  attachments: {
    findByPolicyId: attachmentsFindByPolicyId,
    deleteByPolicyId: attachmentsDeleteByPolicyId,
  },
  beneficiaries: { deleteByPolicyId: beneficiariesDeleteByPolicyId },
  payments: { deleteByPolicyId: paymentsDeleteByPolicyId },
  cashValues: { deleteByPolicyId: cashValuesDeleteByPolicyId },
  coverageItems: { deleteByPolicyId: coverageItemsDeleteByPolicyId },
};

let includeBatch = true;

mock.module("@/lib/api-helpers", () => ({
  getReposFromRequest: () =>
    Promise.resolve(
      includeBatch
        ? { repos: mockRepos, targetDb: "test" as const, batchExecute }
        : { repos: mockRepos, targetDb: "test" as const },
    ),
}));

// r2-client: always throw so DELETE code path skips R2 cleanup.
mock.module("@/lib/r2-client", () => ({
  getR2ClientFromEnv: () => {
    throw new Error("R2 env not configured");
  },
}));

// Route handler imported AFTER mock.module
const { GET, PUT, DELETE } = await import("@/app/api/policies/[id]/route");

// --- Helpers ---

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function resetAllMocks() {
  policiesFindById.mockReset();
  policiesUpdate.mockReset();
  policiesDelete.mockReset();
  insurersFindOrCreate.mockReset();
  insurersDelete.mockReset();
  membersFindAll.mockReset();
  assetsFindAll.mockReset();
  attachmentsFindByPolicyId.mockReset();
  attachmentsDeleteByPolicyId.mockReset();
  beneficiariesDeleteByPolicyId.mockReset();
  paymentsDeleteByPolicyId.mockReset();
  cashValuesDeleteByPolicyId.mockReset();
  coverageItemsDeleteByPolicyId.mockReset();
  batchExecute.mockReset();

  // Re-establish default implementations
  membersFindAll.mockImplementation(() =>
    Promise.resolve([
      { id: 1, name: "张三" },
      { id: 2, name: "李四" },
    ]),
  );
  assetsFindAll.mockImplementation(() =>
    Promise.resolve([{ id: 10, name: "房产A" }]),
  );
  attachmentsFindByPolicyId.mockImplementation(() => Promise.resolve([]));
  attachmentsDeleteByPolicyId.mockImplementation(() => Promise.resolve(0));
  beneficiariesDeleteByPolicyId.mockImplementation(() => Promise.resolve(0));
  paymentsDeleteByPolicyId.mockImplementation(() => Promise.resolve(0));
  cashValuesDeleteByPolicyId.mockImplementation(() => Promise.resolve(0));
  coverageItemsDeleteByPolicyId.mockImplementation(() => Promise.resolve(0));
  policiesDelete.mockImplementation(() => Promise.resolve(true));
  insurersFindOrCreate.mockImplementation(() =>
    Promise.resolve({ id: 42, name: "示例保险", created: false }),
  );
  insurersDelete.mockImplementation(() => Promise.resolve(true));
  batchExecute.mockImplementation(() => Promise.resolve());
  includeBatch = true;
}

// --- GET ---

describe("GET /api/policies/[id]", () => {
  beforeEach(resetAllMocks);

  test("returns 400 for non-numeric id", async () => {
    const req = new Request("http://localhost/api/policies/abc");
     
    const res = await GET(req as unknown as NextRequest, ctx("abc"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid id" });
  });

  test("returns 404 when policy is missing", async () => {
    policiesFindById.mockImplementation(() => Promise.resolve(undefined));
    const req = new Request("http://localhost/api/policies/1");
     
    const res = await GET(req as unknown as NextRequest, ctx("1"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Policy not found" });
  });

  test("returns 200 with enriched member + asset names", async () => {
    policiesFindById.mockImplementation(() =>
      Promise.resolve({
        id: 1,
        policyNumber: "POL-1",
        productName: "平安福",
        insurerName: "平安人寿",
        insuredMemberId: 1,
        insuredAssetId: null,
        applicantId: 2,
        insuredType: "Member",
        category: "Life",
        subCategory: null,
        channel: null,
        sumAssured: 100000,
        premium: 5000,
        paymentFrequency: "Yearly",
        paymentYears: 20,
        totalPayments: 20,
        renewalType: null,
        paymentAccount: null,
        nextDueDate: null,
        effectiveDate: "2024-01-01",
        expiryDate: null,
        hesitationEndDate: null,
        waitingDays: null,
        guaranteedRenewalYears: null,
        status: "Active",
        deathBenefit: null,
        policyFilePath: null,
        notes: null,
      }),
    );

    const req = new Request("http://localhost/api/policies/1");
     
    const res = await GET(req as unknown as NextRequest, ctx("1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.insuredName).toBe("张三");
    expect(body.applicantName).toBe("李四");
    expect(body.insuredAssetName).toBeNull();
    expect(body.status).toBe("Active");
  });

  test("maps missing member/asset names to '未知'", async () => {
    policiesFindById.mockImplementation(() =>
      Promise.resolve({
        id: 1,
        policyNumber: "POL-2",
        productName: "p",
        insurerName: "i",
        insuredMemberId: null,
        insuredAssetId: 999, // Unknown asset id
        applicantId: 888, // Unknown applicant id
        insuredType: "Asset",
        category: "Property",
        subCategory: null,
        channel: null,
        sumAssured: 0,
        premium: 0,
        paymentFrequency: "Single",
        effectiveDate: "2024-01-01",
        expiryDate: null,
        status: "Active",
      }),
    );

    const req = new Request("http://localhost/api/policies/1");
     
    const res = await GET(req as unknown as NextRequest, ctx("1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.insuredName).toBe("未知");
    expect(body.insuredAssetName).toBeNull();
    expect(body.applicantName).toBe("未知");
  });
});

// --- PUT ---

describe("PUT /api/policies/[id]", () => {
  beforeEach(resetAllMocks);

  function putReq(body: Record<string, unknown>) {
    return new Request("http://localhost/api/policies/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  test("returns 400 for non-numeric id", async () => {
     
    const res = await PUT(putReq({}) as unknown as NextRequest, ctx("abc"));
    expect(res.status).toBe(400);
  });

  test("returns 404 when policy missing before update", async () => {
    policiesFindById.mockImplementation(() => Promise.resolve(undefined));
     
    const res = await PUT(putReq({ productName: "x" }) as unknown as NextRequest, ctx("1"));
    expect(res.status).toBe(404);
  });

  test("returns 200 on successful update with Member insuredType clearing asset", async () => {
    policiesFindById.mockImplementation(() =>
      Promise.resolve({ id: 1, status: "Active" }),
    );
    policiesUpdate.mockImplementation(() =>
      Promise.resolve({
        id: 1,
        policyNumber: "POL-1",
        productName: "新产品",
        insurerName: "平安人寿",
        category: "Life",
        status: "Active",
      }),
    );

    const res = await PUT(
       
      putReq({
        insurerName: "平安人寿",
        productName: "新产品",
        category: "Life",
        insuredType: "Member",
        insuredMemberId: 1,
        insuredAssetId: 99, // Should be cleared
      }) as unknown as NextRequest,
      ctx("1"),
    );
    expect(res.status).toBe(200);
    const call = policiesUpdate.mock.calls[0] as unknown as [number, Record<string, unknown>];
    const updateArg = call[1];
    expect(updateArg.insuredAssetId).toBeNull();
    expect(updateArg.insuredMemberId).toBe(1);
  });

  test("Asset insuredType clears member id", async () => {
    policiesFindById.mockImplementation(() => Promise.resolve({ id: 1 }));
    policiesUpdate.mockImplementation(() =>
      Promise.resolve({ id: 1, category: "Property", status: "Active" }),
    );

     
    await PUT(
      putReq({
        productName: "p",
        category: "Property",
        insuredType: "Asset",
        insuredMemberId: 5,
        insuredAssetId: 10,
      }) as unknown as NextRequest,
      ctx("1"),
    );
    const call = policiesUpdate.mock.calls[0] as unknown as [number, Record<string, unknown>];
    const updateArg = call[1];
    expect(updateArg.insuredMemberId).toBeNull();
    expect(updateArg.insuredAssetId).toBe(10);
  });

  test("returns 409 for UNIQUE policy_number violation", async () => {
    policiesFindById.mockImplementation(() => Promise.resolve({ id: 1 }));
    policiesUpdate.mockImplementation(() =>
      Promise.reject(new Error("UNIQUE constraint failed: policies.policy_number")),
    );

     
    const res = await PUT(
      putReq({ productName: "p", category: "Life" }) as unknown as NextRequest,
      ctx("1"),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("保单编号已存在");
  });

  test("returns 500 for generic update errors", async () => {
    policiesFindById.mockImplementation(() => Promise.resolve({ id: 1 }));
    policiesUpdate.mockImplementation(() =>
      Promise.reject(new Error("random DB failure")),
    );

     
    const res = await PUT(
      putReq({ productName: "p", category: "Life" }) as unknown as NextRequest,
      ctx("1"),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("更新保单失败");
  });
});

// --- DELETE ---

describe("DELETE /api/policies/[id]", () => {
  beforeEach(resetAllMocks);

  test("returns 400 for non-numeric id", async () => {
    const req = new Request("http://localhost/api/policies/abc", { method: "DELETE" });
     
    const res = await DELETE(req as unknown as NextRequest, ctx("abc"));
    expect(res.status).toBe(400);
  });

  test("returns 404 when policy missing", async () => {
    policiesFindById.mockImplementation(() => Promise.resolve(undefined));
    const req = new Request("http://localhost/api/policies/1", { method: "DELETE" });
     
    const res = await DELETE(req as unknown as NextRequest, ctx("1"));
    expect(res.status).toBe(404);
  });

  test("returns success via batch path when batchExecute is available", async () => {
    policiesFindById.mockImplementation(() => Promise.resolve({ id: 1 }));

    const req = new Request("http://localhost/api/policies/1", { method: "DELETE" });
     
    const res = await DELETE(req as unknown as NextRequest, ctx("1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(batchExecute).toHaveBeenCalledTimes(1);
    const call = batchExecute.mock.calls[0] as unknown as [Array<{ sql: string }>];
    const statements = call[0];
    expect(statements).toHaveLength(6);
    expect(statements.at(-1)?.sql).toContain("DELETE FROM policies");
  });

  test("returns success via non-batch fallback path", async () => {
    includeBatch = false;
    policiesFindById.mockImplementation(() => Promise.resolve({ id: 1 }));

    const req = new Request("http://localhost/api/policies/1", { method: "DELETE" });
     
    const res = await DELETE(req as unknown as NextRequest, ctx("1"));
    expect(res.status).toBe(200);
    expect(attachmentsDeleteByPolicyId).toHaveBeenCalledWith(1);
    expect(beneficiariesDeleteByPolicyId).toHaveBeenCalledWith(1);
    expect(paymentsDeleteByPolicyId).toHaveBeenCalledWith(1);
    expect(cashValuesDeleteByPolicyId).toHaveBeenCalledWith(1);
    expect(coverageItemsDeleteByPolicyId).toHaveBeenCalledWith(1);
    expect(policiesDelete).toHaveBeenCalledWith(1);
  });

  test("skips R2 cleanup gracefully when env missing", async () => {
    policiesFindById.mockImplementation(() => Promise.resolve({ id: 1 }));
    attachmentsFindByPolicyId.mockImplementation(() =>
      Promise.resolve([{ r2Key: "policies/1/a.pdf" }]),
    );

    const req = new Request("http://localhost/api/policies/1", { method: "DELETE" });
     
    const res = await DELETE(req as unknown as NextRequest, ctx("1"));
    // R2 env-missing should NOT turn a successful DB delete into 500
    expect(res.status).toBe(200);
  });
});
