import { describe, expect, test } from "bun:test";
import { httpJson } from "./setup";
import packageJson from "../../../../package.json" with { type: "json" };

describe("L2-HTTP /api/live", () => {
  test("returns ok + version + connected D1", async () => {
    const res = await httpJson<{
      status: string;
      version: string;
      database: { connected: boolean };
    }>("GET", "/api/live");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.version).toBe(packageJson.version);
    expect(res.body.database.connected).toBe(true);
  });

  test("Cache-Control is no-store", async () => {
    const res = await httpJson("GET", "/api/live");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
