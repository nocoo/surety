import { describe, expect, test } from "bun:test";
import { APP_VERSION } from "@/lib/version";
import pkg from "../../package.json";

describe("APP_VERSION", () => {
  test("matches package.json version", () => {
    expect(APP_VERSION).toBe(pkg.version);
  });

  test("is a valid semver string", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("is not empty", () => {
    expect(APP_VERSION.length).toBeGreaterThan(0);
  });
});
