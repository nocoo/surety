import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readJsonInput,
  requireJsonInput,
  jsonInputArgs,
} from "../src/lib/json-input";

const origExit = process.exit;
const origStderr = process.stderr.write;
const origIsTTY = process.stdin.isTTY;

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
  Object.defineProperty(process.stdin, "isTTY", {
    value: origIsTTY,
    configurable: true,
  });
});

describe("readJsonInput", () => {
  test("returns parsed object from --data", () => {
    const out = readJsonInput({ data: '{"a":1}' });
    expect(out).toEqual({ a: 1 });
  });

  test("returns undefined when no source available and stdin is TTY", () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
    });
    const out = readJsonInput({});
    expect(out).toBeUndefined();
  });

  test("ignores empty --data string and falls through", () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
    });
    const out = readJsonInput({ data: "" });
    expect(out).toBeUndefined();
  });

  test("reads from --data-file when provided", () => {
    const dir = mkdtempSync(join(tmpdir(), "surety-cli-jsoninput-"));
    const file = join(dir, "payload.json");
    try {
      writeFileSync(file, '{"hello":"world"}');
      const out = readJsonInput({ "data-file": file });
      expect(out).toEqual({ hello: "world" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("invalid --data exits with JSON error envelope", () => {
    expect(() => readJsonInput({ data: "{ not json" })).toThrow(ExitCalled);
    const parsed = JSON.parse(stderrOut) as {
      ok: boolean;
      error: string;
      detail: unknown;
    };
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("--data");
  });

  test("invalid --data-file content emits source path in error", () => {
    const dir = mkdtempSync(join(tmpdir(), "surety-cli-jsoninput-"));
    const file = join(dir, "bad.json");
    try {
      writeFileSync(file, "not-json");
      expect(() => readJsonInput({ "data-file": file })).toThrow(ExitCalled);
      const parsed = JSON.parse(stderrOut) as { error: string };
      expect(parsed.error).toContain(file);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("requireJsonInput", () => {
  test("returns parsed body when --data present", () => {
    const out = requireJsonInput({ data: '{"x":1}' });
    expect(out).toEqual({ x: 1 });
  });

  test("exits with JSON error when no input source", () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
    });
    expect(() => requireJsonInput({})).toThrow(ExitCalled);
    const parsed = JSON.parse(stderrOut) as { error: string };
    expect(parsed.error).toContain("missing JSON payload");
  });
});

describe("jsonInputArgs", () => {
  test("exposes data + data-file string definitions", () => {
    expect(jsonInputArgs.data.type).toBe("string");
    expect(jsonInputArgs["data-file"].type).toBe("string");
  });
});
