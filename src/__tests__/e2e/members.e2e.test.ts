import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { setupE2E, teardownE2E, apiRequest } from "./setup";

interface Member {
  id: number;
  name: string;
  relation: string;
  gender: string | null;
  birthDate: string | null;
  idCard: string | null;
  idType: string | null;
  idExpiry: string | null;
  phone: string | null;
  hasSocialInsurance: boolean | null;
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

  describe("New fields: idType, idExpiry, hasSocialInsurance", () => {
    let memberId: number;

    test("POST /api/members with new fields", async () => {
      const { status, data } = await apiRequest<Member>("/api/members", {
        method: "POST",
        body: JSON.stringify({
          name: "新字段测试",
          relation: "Self",
          gender: "M",
          birthDate: "1986-03-15",
          idCard: "110101198603150099",
          idType: "身份证",
          idExpiry: "2021-10-05|2041-10-05",
          phone: "13800000099",
          hasSocialInsurance: true,
        }),
      });

      expect(status).toBe(201);
      expect(data.idType).toBe("身份证");
      expect(data.idExpiry).toBe("2021-10-05|2041-10-05");
      expect(data.hasSocialInsurance).toBe(true);
      expect(data.idCard).toBe("110101198603150099");
      memberId = data.id;
    });

    test("GET /api/members/:id returns new fields", async () => {
      const { status, data } = await apiRequest<Member>(
        `/api/members/${memberId}`
      );

      expect(status).toBe(200);
      expect(data.idType).toBe("身份证");
      expect(data.idExpiry).toBe("2021-10-05|2041-10-05");
      expect(data.hasSocialInsurance).toBe(true);
    });

    test("GET /api/members list includes new fields", async () => {
      const { status, data } = await apiRequest<Member[]>("/api/members");

      expect(status).toBe(200);
      const target = data.find((m) => m.id === memberId);
      expect(target).toBeDefined();
      expect(target!.idType).toBe("身份证");
      expect(target!.idExpiry).toBe("2021-10-05|2041-10-05");
      expect(target!.hasSocialInsurance).toBe(true);
    });

    test("PUT /api/members/:id updates new fields", async () => {
      const { status, data } = await apiRequest<Member>(
        `/api/members/${memberId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            idType: "护照",
            idExpiry: "2025-01-01|2035-01-01",
            hasSocialInsurance: false,
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.idType).toBe("护照");
      expect(data.idExpiry).toBe("2025-01-01|2035-01-01");
      expect(data.hasSocialInsurance).toBe(false);
    });

    test("POST /api/members without new fields defaults to null", async () => {
      const { status, data } = await apiRequest<Member>("/api/members", {
        method: "POST",
        body: JSON.stringify({
          name: "无新字段测试",
          relation: "Child",
        }),
      });

      expect(status).toBe(201);
      expect(data.idType).toBeNull();
      expect(data.idExpiry).toBeNull();
      expect(data.hasSocialInsurance).toBeNull();

      // cleanup
      await apiRequest(`/api/members/${data.id}`, { method: "DELETE" });
    });

    test("cleanup: delete test member", async () => {
      const { status } = await apiRequest<{ success: boolean }>(
        `/api/members/${memberId}`,
        { method: "DELETE" }
      );
      expect(status).toBe(200);
    });
  });
});
