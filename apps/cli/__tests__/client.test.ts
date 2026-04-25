import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { buildClient } from "../src/lib/client";

const origExit = process.exit;
const origStderr = process.stderr.write;

class ExitCalled extends Error {
  constructor(public readonly code: number | undefined) {
    super(`exit ${code}`);
  }
}

let stderrOut = "";

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
});

afterEach(() => {
  process.stderr.write = origStderr;
  process.exit = origExit;
});

describe("buildClient", () => {
  // We deliberately do not pass a HOME override: getConfigDir() in
  // src/config.ts uses os.homedir() (a syscall), which ignores the env arg.
  // The previous mkdtempSync(...) + rmSync(...) dance was wasted I/O
  // (~5ms/test) since ConfigManager still read from the real ~/.config/surety.
  // Both branches below are env-driven (token in env vs dev mode + missing
  // file), so we don't need a sandbox dir for correctness either.
  test("returns ApiClient when token is present in env", () => {
    const client = buildClient({
      SURETY_API_TOKEN: "tok_test",
      SURETY_API_URL: "https://example.test",
    } as unknown as NodeJS.ProcessEnv);
    expect(client).toBeDefined();
  });

  test("exits with JSON error envelope when no token configured", () => {
    expect(() =>
      buildClient({
        // dev-mode → reads config.dev.json which does not exist in CI
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
