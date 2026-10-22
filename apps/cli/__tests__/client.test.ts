import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getConfigDir } from "../src/config";
import { buildClient } from "../src/lib/client";

const fixture = vi.hoisted(() => ({ home: "" }));

vi.mock("node:os", async (importOriginal) => ({
	...(await importOriginal<typeof import("node:os")>()),
	homedir: () => {
		if (!fixture.home) throw new Error("Missing owned CLI test fixture");
		return fixture.home;
	},
}));

const origExit = process.exit;
const origStderr = process.stderr.write;

class ExitCalled extends Error {
	constructor(public readonly code: number | undefined) {
		super(`exit ${code}`);
	}
}

let stderrOut = "";

beforeEach(() => {
	fixture.home = realpathSync(mkdtempSync(join(tmpdir(), "surety-client-")));
	stderrOut = "";
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
	const owned = fixture.home;
	fixture.home = "";
	expect(realpathSync(owned)).toBe(owned);
	rmSync(owned, { recursive: true });
});

describe("buildClient", () => {
	test("returns ApiClient when token is present in env", () => {
		const client = buildClient({
			SURETY_API_TOKEN: "tok_test",
			SURETY_API_URL: "https://example.test",
		} as unknown as NodeJS.ProcessEnv);
		expect(client).toBeDefined();
	});

	test("reads a synthetic token only from the owned config fixture", () => {
		const directory = getConfigDir();
		expect(directory).toBe(join(fixture.home, ".config", "surety"));
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, "config.dev.json"),
			JSON.stringify({ token: "fixture-token", apiUrl: "https://example.test" }),
		);
		expect(buildClient({ SURETY_CLI_DEV: "1" } as NodeJS.ProcessEnv)).toBeDefined();
	});

	test("exits with JSON error envelope when no token configured", () => {
		expect(() =>
			buildClient({
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
