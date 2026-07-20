import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { readFileSyncMock } = vi.hoisted(() => ({
	readFileSyncMock: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return { ...actual, readFileSync: readFileSyncMock };
});

import { jsonInputArgs, readJsonInput, requireJsonInput } from "../src/lib/json-input";

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
	readFileSyncMock.mockReset();
	process.stderr.write = ((chunk: string | Uint8Array) => {
		stderrOut += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
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
		readFileSyncMock.mockImplementation((p: string) => {
			if (p === "/in-memory/payload.json") return '{"hello":"world"}';
			throw new Error(`unexpected fs read: ${p}`);
		});
		const out = readJsonInput({ "data-file": "/in-memory/payload.json" });
		expect(out).toEqual({ hello: "world" });
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
		const SENTINEL = "/in-memory/bad.json";
		readFileSyncMock.mockImplementation((p: string) => {
			if (p === SENTINEL) return "not-json";
			throw new Error(`unexpected fs read: ${p}`);
		});
		expect(() => readJsonInput({ "data-file": SENTINEL })).toThrow(ExitCalled);
		const parsed = JSON.parse(stderrOut) as { error: string };
		expect(parsed.error).toContain(SENTINEL);
	});
});

describe("stdin paths", () => {
	test("--data-file - reads from stdin via fd 0", () => {
		readFileSyncMock.mockImplementation((fd: number | string) => {
			if (fd === 0) return '{"piped":true}';
			throw new Error("unexpected fs read");
		});
		const out = readJsonInput({ "data-file": "-" });
		expect(out).toEqual({ piped: true });
	});

	test("reads from piped stdin when not a TTY", () => {
		Object.defineProperty(process.stdin, "isTTY", {
			value: false,
			configurable: true,
		});
		readFileSyncMock.mockImplementation((fd: number | string) => {
			if (fd === 0) return '{"via":"stdin"}';
			throw new Error("unexpected fs read");
		});
		const out = readJsonInput({});
		expect(out).toEqual({ via: "stdin" });
	});

	test("readStdin swallows fd 0 read errors and returns empty", () => {
		Object.defineProperty(process.stdin, "isTTY", {
			value: false,
			configurable: true,
		});
		readFileSyncMock.mockImplementation((fd: number | string) => {
			if (fd === 0) throw new Error("EBADF");
			throw new Error("unexpected fs read");
		});
		const out = readJsonInput({});
		expect(out).toBeUndefined();
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
