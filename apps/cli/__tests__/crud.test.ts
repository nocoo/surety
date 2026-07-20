import type { CommandDef } from "@nocoo/base-cli";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ApiClient } from "../src/api";
import { defineCrudCommand } from "../src/lib/crud";

interface Row extends Record<string, unknown> {
	id: number;
	name: string;
	extra?: string;
}

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

function buildCmd(client: ApiClient) {
	return defineCrudCommand<Row>({
		name: "rows",
		description: "Test rows",
		basePath: "/api/rows",
		summarize: (r) => ({ id: r.id, name: r.name }),
		buildClient: () => client,
	});
}

async function sub(cmd: ReturnType<typeof buildCmd>, name: string): Promise<CommandDef> {
	const subs = cmd.subCommands as Record<string, CommandDef>;
	const entry = subs[name];
	if (!entry) throw new Error(`no sub ${name}`);
	return entry;
}

async function runSub(
	cmd: ReturnType<typeof buildCmd>,
	name: string,
	args: Record<string, unknown>,
): Promise<void> {
	const s = await sub(cmd, name);
	await s.run?.({
		rawArgs: [],
		args: args as never,
		cmd: s,
	});
}

let stdoutChunks: string[];
let stderrChunks: string[];
const origStdout = process.stdout.write.bind(process.stdout);
const origStderr = process.stderr.write.bind(process.stderr);

beforeEach(() => {
	stdoutChunks = [];
	stderrChunks = [];
	process.stdout.write = ((chunk: string | Uint8Array) => {
		stdoutChunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
		return true;
	}) as typeof process.stdout.write;
	process.stderr.write = ((chunk: string | Uint8Array) => {
		stderrChunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
		return true;
	}) as typeof process.stderr.write;
});

afterEach(() => {
	process.stdout.write = origStdout;
	process.stderr.write = origStderr;
});

function lastJson(): unknown {
	const text = stdoutChunks.join("").trim();
	return JSON.parse(text.split("\n").pop() ?? "");
}

describe("defineCrudCommand", () => {
	test("ls returns summarized records by default", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url, init) => {
				expect(url).toBe("https://api.test/api/rows");
				expect(init.method).toBe("GET");
				return {
					status: 200,
					body: JSON.stringify([
						{ id: 1, name: "a", extra: "x" },
						{ id: 2, name: "b", extra: "y" },
					]),
				};
			}),
		});
		await runSub(buildCmd(client), "ls", { full: false });
		expect(lastJson()).toEqual([
			{ id: 1, name: "a" },
			{ id: 2, name: "b" },
		]);
	});

	test("ls --full returns raw records", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch(() => ({
				status: 200,
				body: JSON.stringify([{ id: 1, name: "a", extra: "x" }]),
			})),
		});
		await runSub(buildCmd(client), "ls", { full: true });
		expect(lastJson()).toEqual([{ id: 1, name: "a", extra: "x" }]);
	});

	test("get fetches by id and summarizes", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url) => {
				expect(url).toBe("https://api.test/api/rows/42");
				return {
					status: 200,
					body: JSON.stringify({ id: 42, name: "x", extra: "ignored" }),
				};
			}),
		});
		await runSub(buildCmd(client), "get", { id: "42", full: false });
		expect(lastJson()).toEqual({ id: 42, name: "x" });
	});

	test("add posts JSON body from --data", async () => {
		let sent: string | undefined;
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url, init) => {
				expect(url).toBe("https://api.test/api/rows");
				expect(init.method).toBe("POST");
				sent = init.body as string;
				return { status: 201, body: JSON.stringify({ id: 7, name: "new" }) };
			}),
		});
		await runSub(buildCmd(client), "add", {
			data: '{"name":"new"}',
			full: false,
		});
		expect(sent).toBe(JSON.stringify({ name: "new" }));
		expect(lastJson()).toEqual({ id: 7, name: "new" });
	});

	test("update puts JSON body by id", async () => {
		let sent: string | undefined;
		let method: string | undefined;
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url, init) => {
				expect(url).toBe("https://api.test/api/rows/5");
				method = init.method;
				sent = init.body as string;
				return {
					status: 200,
					body: JSON.stringify({ id: 5, name: "renamed" }),
				};
			}),
		});
		await runSub(buildCmd(client), "update", {
			id: "5",
			data: '{"name":"renamed"}',
			full: false,
		});
		expect(method).toBe("PUT");
		expect(sent).toBe(JSON.stringify({ name: "renamed" }));
		expect(lastJson()).toEqual({ id: 5, name: "renamed" });
	});

	test("rm deletes by id and emits ok envelope", async () => {
		let method: string | undefined;
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url, init) => {
				expect(url).toBe("https://api.test/api/rows/9");
				method = init.method;
				return { status: 200, body: "{}" };
			}),
		});
		await runSub(buildCmd(client), "rm", { id: "9" });
		expect(method).toBe("DELETE");
		expect(lastJson()).toEqual({ ok: true, id: "9" });
	});

	test("uses default buildClient when factory is omitted", async () => {
		const prev = process.env.SURETY_API_TOKEN;
		const prevUrl = process.env.SURETY_API_URL;
		process.env.SURETY_API_TOKEN = "sk_test";
		process.env.SURETY_API_URL = "https://api.test";
		try {
			const originalFetch = globalThis.fetch;
			globalThis.fetch = mockFetch((url) => {
				expect(url).toBe("https://api.test/api/rows");
				return { status: 200, body: "[]" };
			});
			const cmd = defineCrudCommand<Row>({
				name: "rows",
				description: "Test rows",
				basePath: "/api/rows",
				summarize: (r) => ({ id: r.id, name: r.name }),
			});
			const s = await sub(cmd, "ls");
			await s.run?.({ rawArgs: [], args: { full: false } as never, cmd: s });
			expect(lastJson()).toEqual([]);
			globalThis.fetch = originalFetch;
		} finally {
			if (prev === undefined) delete process.env.SURETY_API_TOKEN;
			else process.env.SURETY_API_TOKEN = prev;
			if (prevUrl === undefined) delete process.env.SURETY_API_URL;
			else process.env.SURETY_API_URL = prevUrl;
		}
	});
});
