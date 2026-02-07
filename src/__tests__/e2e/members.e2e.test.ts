import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface Member {
  id: number;
  name: string;
  relation: string;
  gender: string | null;
  birthDate: string | null;
  phone: string | null;
}

describe("Members API E2E", () => {
  beforeAll(async () => {
    await setupE2E();
  }, 60000);

  afterAll(async () => {
    await teardownE2E();
  });

  describe("CRUD operations", () => {
    let createdMemberId: number;

    test("GET /api/members returns list", async () => {
      const { status, data } = await apiRequest<Member[]>("/api/members");
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    test("POST /api/members creates new member", async () => {
      const newMember = {
        name: "E2E测试用户",
        relation: "Self",
        gender: "M",
        birthDate: "1990-01-01",
        phone: "13800000000",
      };

      const { status, data } = await apiRequest<Member>("/api/members", {
        method: "POST",
        body: JSON.stringify(newMember),
      });

      expect(status).toBe(201);
      expect(data.id).toBeGreaterThan(0);
      expect(data.name).toBe("E2E测试用户");
      expect(data.relation).toBe("Self");
      createdMemberId = data.id;
    });

    test("GET /api/members/:id returns single member", async () => {
      const { status, data } = await apiRequest<Member>(
        `/api/members/${createdMemberId}`
      );

      expect(status).toBe(200);
      expect(data.id).toBe(createdMemberId);
      expect(data.name).toBe("E2E测试用户");
    });

    test("PUT /api/members/:id updates member", async () => {
      const { status, data } = await apiRequest<Member>(
        `/api/members/${createdMemberId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: "E2E更新用户",
            relation: "Spouse",
            phone: "13900000000",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.name).toBe("E2E更新用户");
      expect(data.relation).toBe("Spouse");
      expect(data.phone).toBe("13900000000");
    });

    test("DELETE /api/members/:id deletes member", async () => {
      const { status, data } = await apiRequest<{ success: boolean }>(
        `/api/members/${createdMemberId}`,
        { method: "DELETE" }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);

      const { status: getStatus } = await apiRequest<Member>(
        `/api/members/${createdMemberId}`
      );
      expect(getStatus).toBe(404);
    });
  });

  describe("Error handling", () => {
    test("POST /api/members with missing fields returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/members",
        {
          method: "POST",
          body: JSON.stringify({ name: "只有名字" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test("POST /api/members with empty name returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/members",
        {
          method: "POST",
          body: JSON.stringify({ name: "", relation: "Self" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test("POST /api/members with missing relation returns 400", async () => {
      const { status, data } = await apiRequest<{ error: string }>(
        "/api/members",
        {
          method: "POST",
          body: JSON.stringify({ name: "测试用户" }),
        }
      );

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test("GET /api/members/:id with invalid id returns 400", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/members/invalid"
      );
      expect(status).toBe(400);
    });

    test("GET /api/members/:id with negative id returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/members/-1"
      );
      expect(status).toBe(404);
    });

    test("GET /api/members/:id with non-existent id returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/members/99999"
      );
      expect(status).toBe(404);
    });

    test("PUT /api/members/:id with invalid id returns 400", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/members/abc",
        {
          method: "PUT",
          body: JSON.stringify({ name: "测试" }),
        }
      );
      expect(status).toBe(400);
    });

    test("PUT /api/members/:id with non-existent id returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/members/99999",
        {
          method: "PUT",
          body: JSON.stringify({ name: "不存在" }),
        }
      );
      expect(status).toBe(404);
    });

    test("DELETE /api/members/:id with invalid id returns 400", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/members/xyz",
        { method: "DELETE" }
      );
      expect(status).toBe(400);
    });

    test("DELETE /api/members/:id with non-existent id returns 404", async () => {
      const { status } = await apiRequest<{ error: string }>(
        "/api/members/99999",
        { method: "DELETE" }
      );
      expect(status).toBe(404);
    });
  });

  describe("Edge cases", () => {
    let edgeCaseMemberId: number;

    test("POST /api/members with optional fields as null", async () => {
      const { status, data } = await apiRequest<Member>("/api/members", {
        method: "POST",
        body: JSON.stringify({
          name: "可选字段测试",
          relation: "Parent",
          gender: null,
          birthDate: null,
          phone: null,
        }),
      });

      expect(status).toBe(201);
      expect(data.name).toBe("可选字段测试");
      expect(data.gender).toBeNull();
      expect(data.birthDate).toBeNull();
      expect(data.phone).toBeNull();
      edgeCaseMemberId = data.id;
    });

    test("PUT /api/members/:id with partial update", async () => {
      const { status, data } = await apiRequest<Member>(
        `/api/members/${edgeCaseMemberId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            phone: "13812345678",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.phone).toBe("13812345678");
    });

    test("cleanup: delete edge case member", async () => {
      const { status } = await apiRequest<{ success: boolean }>(
        `/api/members/${edgeCaseMemberId}`,
        { method: "DELETE" }
      );
      expect(status).toBe(200);
    });
  });
});
