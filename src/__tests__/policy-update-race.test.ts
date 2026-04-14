/**
 * Regression test: PUT /api/policies/:id must roll back a newly-created
 * insurer when the policy vanishes between findById pre-check and update.
 *
 * This test calls the real PUT route handler with mocked repos so it
 * exercises the actual code path in route.ts, not a manual re-implementation.
 */
import { describe, expect, test, mock } from "bun:test";

// --- Mock setup (must precede route import) ---

const deleteFn = mock(() => Promise.resolve(true));

const mockRepos = {
  policies: {
    findById: mock(() => Promise.resolve({ id: 1, status: "Active" })),
    // Simulate race: update finds no row
    update: mock(() => Promise.resolve(undefined)),
  },
  insurers: {
    findOrCreate: mock(() =>
      Promise.resolve({ id: 99, name: "新保险公司", created: true }),
    ),
    delete: deleteFn,
  },
};

mock.module("@/lib/api-helpers", () => ({
  getReposFromRequest: () =>
    Promise.resolve({ repos: mockRepos, targetDb: "test" as const }),
}));

// Route handler is imported AFTER mock.module so the mock is in effect
const { PUT } = await import("@/app/api/policies/[id]/route");

// --- Tests ---

describe("PUT /api/policies/:id route handler rollback", () => {
  test("rolls back newly created insurer when update returns undefined (race condition)", async () => {
    deleteFn.mockClear();

    const request = new Request("http://localhost/api/policies/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        insurerName: "新保险公司",
        productName: "新产品",
        category: "Life",
      }),
    });

    const context = { params: Promise.resolve({ id: "1" }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PUT(request as any, context);

    // Handler should return 404 for the vanished policy
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Policy not found");

    // Key assertion: the route handler itself called insurers.delete(99)
    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(deleteFn).toHaveBeenCalledWith(99);
  });

  test("does NOT roll back existing insurer when update returns undefined", async () => {
    deleteFn.mockClear();

    // Override findOrCreate to return created: false (existing insurer)
    mockRepos.insurers.findOrCreate.mockImplementation(() =>
      Promise.resolve({ id: 50, name: "已有保险公司", created: false }),
    );

    const request = new Request("http://localhost/api/policies/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        insurerName: "已有保险公司",
        productName: "新产品",
        category: "Life",
      }),
    });

    const context = { params: Promise.resolve({ id: "1" }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PUT(request as any, context);

    expect(response.status).toBe(404);

    // delete must NOT be called — insurer already existed
    expect(deleteFn).not.toHaveBeenCalled();

    // Restore for other tests
    mockRepos.insurers.findOrCreate.mockImplementation(() =>
      Promise.resolve({ id: 99, name: "新保险公司", created: true }),
    );
  });

  test("rolls back newly created insurer when update throws (catch branch)", async () => {
    deleteFn.mockClear();

    // Override update to throw instead of returning undefined
    mockRepos.policies.update.mockImplementation(() =>
      Promise.reject(new Error("DB connection lost")),
    );

    const request = new Request("http://localhost/api/policies/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        insurerName: "新保险公司",
        productName: "新产品",
        category: "Life",
      }),
    });

    const context = { params: Promise.resolve({ id: "1" }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await PUT(request as any, context);

    expect(response.status).toBe(500);

    // catch branch should also roll back
    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(deleteFn).toHaveBeenCalledWith(99);

    // Restore for other tests
    mockRepos.policies.update.mockImplementation(() =>
      Promise.resolve(undefined),
    );
  });
});
