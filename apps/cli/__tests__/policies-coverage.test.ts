import type { CommandDef } from "@nocoo/base-cli";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ApiClient } from "../src/api";
import { definePoliciesCommand } from "../src/commands/policies";

function mockFetch(
	handler: (url: string, init: RequestInit) => { status: number; body: string },
): typeof fetch {
	return ((url: string, init?: RequestInit) => {
		const { status, body } = handler(url, init ?? {});
		return Promise.resolve(
			new Response(status === 204 || status === 205 ? null : body, {
				status,
				headers: { "content-type": "application/json" },
			}),
		);
	}) as unknown as typeof fetch;
}

function buildCmd(client: ApiClient) {
	return definePoliciesCommand(() => client);
}

function resolveSub(cmd: CommandDef, path: string[]): CommandDef {
	let current: CommandDef = cmd;
	for (const name of path) {
		const subs = current.subCommands as Record<string, CommandDef> | undefined;
		const next = subs?.[name];
		if (!next) throw new Error(`no sub at ${path.join(" > ")}`);
		current = next;
	}
	return current;
}

async function runPath(
	cmd: CommandDef,
	path: string[],
	args: Record<string, unknown>,
): Promise<void> {
	const s = resolveSub(cmd, path);
	await s.run?.({ rawArgs: [], args: args as never, cmd: s });
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

describe("policies command - main CRUD", () => {
	test("get returns single policy summary", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url) => {
				expect(url).toBe("https://api.test/api/policies/7");
				return {
					status: 200,
					body: JSON.stringify({
						id: 7,
						policyNumber: "P7",
						productName: "X",
						insurerName: "I",
						category: "Life",
						status: "Active",
						nextDueDate: null,
					}),
				};
			}),
		});
		await runPath(buildCmd(client), ["get"], { id: "7", full: false });
		expect(lastJson()).toEqual({
			id: 7,
			policyNumber: "P7",
			productName: "X",
			insurerName: "I",
			category: "Life",
			status: "Active",
			nextDueDate: null,
		});
	});

	test("get with --full returns raw record", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch(() => ({
				status: 200,
				body: JSON.stringify({
					id: 1,
					policyNumber: "P1",
					productName: "X",
					insurerName: "I",
					category: "Life",
					status: "Active",
					extra: "kept",
				}),
			})),
		});
		await runPath(buildCmd(client), ["get"], { id: "1", full: true });
		expect((lastJson() as Record<string, unknown>).extra).toBe("kept");
	});

	test("add posts JSON body and returns summary", async () => {
		let sent: string | undefined;
		let method: string | undefined;
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url, init) => {
				expect(url).toBe("https://api.test/api/policies");
				method = init.method;
				sent = init.body as string;
				return {
					status: 201,
					body: JSON.stringify({
						id: 11,
						policyNumber: "NEW",
						productName: "P",
						insurerName: "I",
						category: "Life",
						status: "Active",
					}),
				};
			}),
		});
		await runPath(buildCmd(client), ["add"], {
			data: '{"policyNumber":"NEW"}',
			full: false,
		});
		expect(method).toBe("POST");
		expect(sent).toBe(JSON.stringify({ policyNumber: "NEW" }));
		expect((lastJson() as Record<string, unknown>).id).toBe(11);
	});

	test("update PUTs to /api/policies/:id", async () => {
		let method: string | undefined;
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url, init) => {
				expect(url).toBe("https://api.test/api/policies/3");
				method = init.method;
				return {
					status: 200,
					body: JSON.stringify({
						id: 3,
						policyNumber: "P3",
						productName: "P",
						insurerName: "I",
						category: "Life",
						status: "Active",
					}),
				};
			}),
		});
		await runPath(buildCmd(client), ["update"], {
			id: "3",
			data: '{"status":"Active"}',
			full: false,
		});
		expect(method).toBe("PUT");
	});

	test("rm DELETEs and emits ok envelope", async () => {
		let method: string | undefined;
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url, init) => {
				expect(url).toBe("https://api.test/api/policies/9");
				method = init.method;
				return { status: 204, body: "" };
			}),
		});
		await runPath(buildCmd(client), ["rm"], { id: "9" });
		expect(method).toBe("DELETE");
		expect(lastJson()).toEqual({ ok: true, id: "9" });
	});
});

describe("policies command - payments", () => {
	test("payments add POSTs to nested payments path", async () => {
		let method: string | undefined;
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url, init) => {
				expect(url).toBe("https://api.test/api/policies/5/payments");
				method = init.method;
				return {
					status: 201,
					body: JSON.stringify({
						id: 1,
						policyId: 5,
						periodNumber: 1,
						dueDate: "2026-01-01",
						amount: 100,
						status: "Pending",
					}),
				};
			}),
		});
		await runPath(buildCmd(client), ["payments", "add"], {
			id: "5",
			data: '{"amount":100}',
			full: false,
		});
		expect(method).toBe("POST");
	});

	test("payments update PUTs nested payment id", async () => {
		let method: string | undefined;
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url, init) => {
				expect(url).toBe("https://api.test/api/policies/5/payments/8");
				method = init.method;
				return {
					status: 200,
					body: JSON.stringify({
						id: 8,
						policyId: 5,
						periodNumber: 1,
						dueDate: "2026-01-01",
						amount: 200,
						status: "Paid",
					}),
				};
			}),
		});
		await runPath(buildCmd(client), ["payments", "update"], {
			id: "5",
			paymentId: "8",
			data: '{"amount":200}',
			full: false,
		});
		expect(method).toBe("PUT");
	});

	test("payments rm DELETEs nested payment", async () => {
		let method: string | undefined;
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url, init) => {
				expect(url).toBe("https://api.test/api/policies/5/payments/8");
				method = init.method;
				return { status: 204, body: "" };
			}),
		});
		await runPath(buildCmd(client), ["payments", "rm"], {
			id: "5",
			paymentId: "8",
		});
		expect(method).toBe("DELETE");
		expect(lastJson()).toEqual({ ok: true, id: "8" });
	});
});

describe("policies command - beneficiaries", () => {
	test("beneficiaries ls returns summarized rows", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url) => {
				expect(url).toBe("https://api.test/api/policies/3/beneficiaries");
				return {
					status: 200,
					body: JSON.stringify([
						{
							id: 1,
							memberId: 99,
							name: "Spouse",
							sharePercent: 50,
							rankOrder: 1,
						},
					]),
				};
			}),
		});
		await runPath(buildCmd(client), ["beneficiaries", "ls"], {
			id: "3",
			full: false,
		});
		expect(lastJson()).toEqual([{ id: 1, name: "Spouse", sharePercent: 50, rankOrder: 1 }]);
	});
});

describe("policies command - coverage-items", () => {
	test("coverage-items ls returns summaries", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url) => {
				expect(url).toBe("https://api.test/api/policies/2/coverage-items");
				return {
					status: 200,
					body: JSON.stringify([
						{
							id: 1,
							policyId: 2,
							name: "Accident",
							periodLimit: "100k",
							lifetimeLimit: null,
							isOptional: false,
						},
					]),
				};
			}),
		});
		await runPath(buildCmd(client), ["coverage-items", "ls"], {
			id: "2",
			full: false,
		});
		expect((lastJson() as unknown[]).length).toBe(1);
	});

	test("coverage-items get fetches single item", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url) => {
				expect(url).toBe("https://api.test/api/policies/2/coverage-items/4");
				return {
					status: 200,
					body: JSON.stringify({
						id: 4,
						policyId: 2,
						name: "Hospital",
						periodLimit: "50k",
						lifetimeLimit: null,
						isOptional: true,
					}),
				};
			}),
		});
		await runPath(buildCmd(client), ["coverage-items", "get"], {
			id: "2",
			itemId: "4",
			full: false,
		});
		expect((lastJson() as Record<string, unknown>).name).toBe("Hospital");
	});

	test("coverage-items add posts payload", async () => {
		let method: string | undefined;
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((_url, init) => {
				method = init.method;
				return {
					status: 201,
					body: JSON.stringify({
						id: 9,
						policyId: 2,
						name: "New",
					}),
				};
			}),
		});
		await runPath(buildCmd(client), ["coverage-items", "add"], {
			id: "2",
			data: '{"name":"New"}',
			full: false,
		});
		expect(method).toBe("POST");
	});

	test("coverage-items rm deletes nested item", async () => {
		let method: string | undefined;
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url, init) => {
				expect(url).toBe("https://api.test/api/policies/2/coverage-items/4");
				method = init.method;
				return { status: 204, body: "" };
			}),
		});
		await runPath(buildCmd(client), ["coverage-items", "rm"], {
			id: "2",
			itemId: "4",
		});
		expect(method).toBe("DELETE");
		expect(lastJson()).toEqual({ ok: true, id: "4" });
	});
});

describe("policies command - attachments", () => {
	test("attachments ls returns summaries", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url) => {
				expect(url).toBe("https://api.test/api/policies/1/attachments");
				return {
					status: 200,
					body: JSON.stringify([
						{
							id: 11,
							policyId: 1,
							filename: "scan.pdf",
							contentType: "application/pdf",
							size: 1024,
						},
					]),
				};
			}),
		});
		await runPath(buildCmd(client), ["attachments", "ls"], {
			id: "1",
			full: false,
		});
		expect((lastJson() as Array<Record<string, unknown>>)[0]?.filename).toBe("scan.pdf");
	});

	test("attachments get returns metadata for single item", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url) => {
				expect(url).toBe("https://api.test/api/policies/1/attachments/11");
				return {
					status: 200,
					body: JSON.stringify({
						id: 11,
						policyId: 1,
						filename: "x.pdf",
						contentType: "application/pdf",
						size: 100,
					}),
				};
			}),
		});
		await runPath(buildCmd(client), ["attachments", "get"], {
			id: "1",
			attachmentId: "11",
			full: false,
		});
		expect((lastJson() as Record<string, unknown>).filename).toBe("x.pdf");
	});
});
