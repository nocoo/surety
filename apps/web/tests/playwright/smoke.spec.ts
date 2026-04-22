import { test, expect } from "./fixtures";

test("API /api/live responds with version + ok status under L3 webServer", async ({
  request,
}) => {
  const res = await request.get("/api/live");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { status: string; version: string };
  expect(body.status).toBe("ok");
  expect(typeof body.version).toBe("string");
});
