import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildClient } from "../src/lib/client";

const origExit = process.exit;
const origStderr = process.stderr.write;

class ExitCalled extends Error {
  constructor(public readonly code: number | undefined) {
    super(`exit ${code}`);
  }
}

let stderrOut = "";
let cfgRoot: string;

beforeEach(() => {
  stderrOut = "";
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrOut +=
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
    return true;
  }) as typeof process.stderr.write;
  process.exit = ((code?: number) => {
    throw new ExitCalled(code);
  }) as typeof process.exit;
  cfgRoot = mkdtempSync(join(tmpdir(), "surety-cli-buildclient-"));
});

afterEach(() => {
  process.stderr.write = origStderr;
  process.exit = origExit;
  rmSync(cfgRoot, { recursive: true, force: true });
});

describe("buildClient", () => {
  test("returns ApiClient when token is present in env", () => {
    const client = buildClient({
      HOME: cfgRoot,
      SURETY_API_TOKEN: "tok_test",
      SURETY_API_URL: "https://example.test",
    } as unknown as NodeJS.ProcessEnv);
    expect(client).toBeDefined();
    // ApiClient is constructed; token presence avoided exit branch
  });

  test("exits with JSON error envelope when no token configured", () => {
    expect(() =>
      buildClient({
        HOME: cfgRoot,
        SURETY_CLI_DEV: "1",
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(ExitCalled);
    const parsed = JSON.parse(stderrOut) as {
      ok: boolean;
      error: string;
    };
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("not logged in");
  });
});
