import { describe, expect, test } from "bun:test";
import { ApiClient, ApiError } from "../src/api";

function mockFetch(
  handler: (url: string, init: RequestInit) => {
    status: number;
    body: string;
  },
): typeof fetch {
  return ((url: string, init?: RequestInit) => {
    const { status, body } = handler(url, init ?? {});
    return Promise.resolve(
      new Response(body, {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as unknown as typeof fetch;
}

describe("ApiClient", () => {
  test("GET adds Authorization when token set and returns parsed JSON", async () => {
    let capturedInit: RequestInit = {};
    const client = new ApiClient({
      apiUrl: "https://api.test",
      token: "sk_abc",
      fetchImpl: mockFetch((url, init) => {
        expect(url).toBe("https://api.test/api/members");
        capturedInit = init;
        return { status: 200, body: JSON.stringify([{ id: 1 }]) };
      }),
    });
    const data = await client.get<Array<{ id: number }>>("/api/members");
    expect(data).toEqual([{ id: 1 }]);
    expect((capturedInit.headers as Record<string, string>).authorization).toBe(
      "Bearer sk_abc",
    );
    expect(capturedInit.method).toBe("GET");
  });

  test("omits Authorization when no token", async () => {
    let capturedInit: RequestInit = {};
    const client = new ApiClient({
      apiUrl: "https://api.test",
      fetchImpl: mockFetch((_url, init) => {
        capturedInit = init;
        return { status: 200, body: "{}" };
      }),
    });
    await client.get("/api/live");
    expect(
      (capturedInit.headers as Record<string, string>).authorization,
    ).toBeUndefined();
  });

  test("POST serializes body as JSON", async () => {
    let sentBody: string | undefined;
    const client = new ApiClient({
      apiUrl: "https://api.test/",
      token: "sk",
      fetchImpl: mockFetch((_url, init) => {
        sentBody = init.body as string;
        return { status: 201, body: JSON.stringify({ id: 42 }) };
      }),
    });
    const out = await client.post<{ id: number }>("/api/members", {
      name: "Zhang",
    });
    expect(out).toEqual({ id: 42 });
    expect(sentBody).toBe(JSON.stringify({ name: "Zhang" }));
  });

  test("throws ApiError on non-2xx with parsed body", async () => {
    const client = new ApiClient({
      apiUrl: "https://api.test",
      fetchImpl: mockFetch(() => ({
        status: 401,
        body: JSON.stringify({ error: "unauth" }),
      })),
    });
    try {
      await client.get("/api/members");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.status).toBe(401);
        expect(err.method).toBe("GET");
        expect(err.path).toBe("/api/members");
        expect(err.body).toEqual({ error: "unauth" });
      }
    }
  });

  test("handles non-JSON response bodies", async () => {
    const client = new ApiClient({
      apiUrl: "https://api.test",
      fetchImpl: mockFetch(() => ({ status: 200, body: "plain text" })),
    });
    const out = await client.get<unknown>("/api/live");
    expect(out).toBe("plain text");
  });

  test("strips trailing slash from apiUrl", async () => {
    let capturedUrl = "";
    const client = new ApiClient({
      apiUrl: "https://api.test///",
      fetchImpl: mockFetch((url) => {
        capturedUrl = url;
        return { status: 200, body: "{}" };
      }),
    });
    await client.get("/api/live");
    expect(capturedUrl).toBe("https://api.test/api/live");
  });

  test("prepends leading slash when path missing one", async () => {
    let capturedUrl = "";
    const client = new ApiClient({
      apiUrl: "https://api.test",
      fetchImpl: mockFetch((url) => {
        capturedUrl = url;
        return { status: 200, body: "{}" };
      }),
    });
    await client.get("api/live");
    expect(capturedUrl).toBe("https://api.test/api/live");
  });
});
