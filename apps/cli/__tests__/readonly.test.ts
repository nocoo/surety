import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ApiClient } from "../src/api";
import { defineReadonlyCommands } from "../src/commands/readonly";

function mockFetch(
	handler: (url: string, init: RequestInit) => { status: number; body: string },
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

async function runCmd(
	cmd: { run?: (ctx: never) => unknown | Promise<unknown> },
	args: Record<string, unknown>,
): Promise<void> {
	await cmd.run?.({ rawArgs: [], args, cmd } as never);
}

let stdoutChunks: string[];
const origStdout = process.stdout.write.bind(process.stdout);

beforeEach(() => {
	stdoutChunks = [];
	process.stdout.write = ((chunk: string | Uint8Array) => {
		stdoutChunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
		return true;
	}) as typeof process.stdout.write;
});

afterEach(() => {
	process.stdout.write = origStdout;
});

function lastJson(): unknown {
	const text = stdoutChunks.join("").trim();
	return JSON.parse(text.split("\n").pop() ?? "");
}

describe("readonly commands", () => {
	test("coverage passes type and id as query params", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url) => {
				expect(url).toBe("https://api.test/api/coverage-lookup?type=member&id=3");
				return { status: 200, body: JSON.stringify({ member: { id: 3 } }) };
			}),
		});
		const cmds = defineReadonlyCommands(() => client);
		await runCmd(cmds.coverage, { type: "member", id: "3" });
		expect(lastJson()).toEqual({ member: { id: 3 } });
	});

	test("coverage without id omits the id param", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url) => {
				expect(url).toBe("https://api.test/api/coverage-lookup?type=asset");
				return { status: 200, body: JSON.stringify({}) };
			}),
		});
		const cmds = defineReadonlyCommands(() => client);
		await runCmd(cmds.coverage, { type: "asset" });
		expect(lastJson()).toEqual({});
	});

	test("coverage without type or id hits overview path", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url) => {
				expect(url).toBe("https://api.test/api/coverage-lookup");
				return { status: 200, body: JSON.stringify({ overview: true }) };
			}),
		});
		const cmds = defineReadonlyCommands(() => client);
		await runCmd(cmds.coverage, {});
		expect(lastJson()).toEqual({ overview: true });
	});

	test("renewals calls renewal-calendar", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url) => {
				expect(url).toBe("https://api.test/api/renewal-calendar");
				return { status: 200, body: JSON.stringify({ months: [] }) };
			}),
		});
		const cmds = defineReadonlyCommands(() => client);
		await runCmd(cmds.renewals, {});
		expect(lastJson()).toEqual({ months: [] });
	});

	test("dashboard calls dashboard endpoint", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url) => {
				expect(url).toBe("https://api.test/api/dashboard");
				return { status: 200, body: JSON.stringify({ totalPolicies: 5 }) };
			}),
		});
		const cmds = defineReadonlyCommands(() => client);
		await runCmd(cmds.dashboard, {});
		expect(lastJson()).toEqual({ totalPolicies: 5 });
	});
});
