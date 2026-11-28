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

describe("policies command", () => {
	test("ls returns summarized policies by default", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url) => {
				expect(url).toBe("https://api.test/api/policies");
				return {
					status: 200,
					body: JSON.stringify([
						{
							id: 1,
							policyNumber: "P001",
							productName: "X",
							insurerName: "Insurer",
							category: "Medical",
							status: "Active",
							premium: 1000,
							nextDueDate: "2026-05-01",
							extraIgnored: true,
						},
					]),
				};
			}),
		});
		await runPath(buildCmd(client), ["ls"], { full: false });
		expect(lastJson()).toEqual([
			{
				id: 1,
				policyNumber: "P001",
				productName: "X",
				insurerName: "Insurer",
				category: "Medical",
				status: "Active",
				nextDueDate: "2026-05-01",
			},
		]);
	});

	test("payments ls lists payments for a policy", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url) => {
				expect(url).toBe("https://api.test/api/policies/42/payments");
				return {
					status: 200,
					body: JSON.stringify([
						{
							id: 7,
							policyId: 42,
							periodNumber: 1,
							dueDate: "2026-01-01",
							amount: 100,
							status: "Pending",
						},
					]),
				};
			}),
		});
		await runPath(buildCmd(client), ["payments", "ls"], {
			id: "42",
			full: false,
		});
		expect(lastJson()).toEqual([
			{
				id: 7,
				periodNumber: 1,
				dueDate: "2026-01-01",
				amount: 100,
				status: "Pending",
			},
		]);
	});

	test("payments generate posts and returns generated count with summaries", async () => {
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url, init) => {
				expect(url).toBe("https://api.test/api/policies/42/payments/generate");
				expect(init.method).toBe("POST");
				return {
					status: 200,
					body: JSON.stringify({
						generated: 2,
						payments: [
							{
								id: 1,
								policyId: 42,
								periodNumber: 1,
								dueDate: "2026-01-01",
								amount: 100,
								status: "Pending",
							},
							{
								id: 2,
								policyId: 42,
								periodNumber: 2,
								dueDate: "2027-01-01",
								amount: 100,
								status: "Pending",
							},
						],
					}),
				};
			}),
		});
		await runPath(buildCmd(client), ["payments", "generate"], { id: "42" });
		expect(lastJson()).toEqual({
			generated: 2,
			payments: [
				{
					id: 1,
					periodNumber: 1,
					dueDate: "2026-01-01",
					amount: 100,
					status: "Pending",
				},
				{
					id: 2,
					periodNumber: 2,
					dueDate: "2027-01-01",
					amount: 100,
					status: "Pending",
				},
			],
		});
	});

	test("coverage-items update PUTs body to nested path", async () => {
		let method: string | undefined;
		let sent: string | undefined;
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url, init) => {
				expect(url).toBe("https://api.test/api/policies/10/coverage-items/3");
				method = init.method;
				sent = init.body as string;
				return {
					status: 200,
					body: JSON.stringify({
						id: 3,
						policyId: 10,
						name: "Renamed",
						isOptional: true,
					}),
				};
			}),
		});
		await runPath(buildCmd(client), ["coverage-items", "update"], {
			id: "10",
			itemId: "3",
			data: '{"name":"Renamed","isOptional":true}',
			full: false,
		});
		expect(method).toBe("PUT");
		expect(sent).toBe(JSON.stringify({ name: "Renamed", isOptional: true }));
		expect(lastJson()).toEqual({
			id: 3,
			name: "Renamed",
			periodLimit: undefined,
			lifetimeLimit: undefined,
			isOptional: true,
		});
	});

	test("attachments rm deletes by nested id and emits ok envelope", async () => {
		let method: string | undefined;
		const client = new ApiClient({
			apiUrl: "https://api.test",
			token: "t",
			fetchImpl: mockFetch((url, init) => {
				expect(url).toBe("https://api.test/api/policies/5/attachments/9");
				method = init.method;
				return { status: 204, body: "" };
			}),
		});
		await runPath(buildCmd(client), ["attachments", "rm"], {
			id: "5",
			attachmentId: "9",
		});
		expect(method).toBe("DELETE");
		expect(lastJson()).toEqual({ ok: true, id: "9" });
	});

	test.each([
		{
			name: "get (summary)",
			path: ["get"],
			args: { id: "7", full: false },
			expectedMethod: "GET",
			expectedUrl: "https://api.test/api/policies/7",
			status: 200,
			response: {
				id: 7,
				policyNumber: "P7",
				productName: "X",
				insurerName: "I",
				category: "Life",
				status: "Active",
				nextDueDate: null,
				extra: "dropped",
			},
			expected: {
				id: 7,
				policyNumber: "P7",
				productName: "X",
				insurerName: "I",
				category: "Life",
				status: "Active",
				nextDueDate: null,
			},
		},
		{
			name: "get --full",
			path: ["get"],
			args: { id: "1", full: true },
			expectedMethod: "GET",
			expectedUrl: "https://api.test/api/policies/1",
			status: 200,
			response: { id: 1, policyNumber: "P1", extra: "kept" },
			expected: { id: 1, policyNumber: "P1", extra: "kept" },
		},
		{
			name: "add",
			path: ["add"],
			args: { data: '{"policyNumber":"NEW"}', full: false },
			expectedMethod: "POST",
			expectedUrl: "https://api.test/api/policies",
			status: 201,
			response: {
				id: 11,
				policyNumber: "NEW",
				productName: "P",
				insurerName: "I",
				category: "Life",
				status: "Active",
			},
			expected: {
				id: 11,
				policyNumber: "NEW",
				productName: "P",
				insurerName: "I",
				category: "Life",
				status: "Active",
				nextDueDate: undefined,
			},
		},
		{
			name: "update",
			path: ["update"],
			args: { id: "3", data: '{"status":"Active"}', full: false },
			expectedMethod: "PUT",
			expectedUrl: "https://api.test/api/policies/3",
			status: 200,
			response: {
				id: 3,
				policyNumber: "P3",
				productName: "P",
				insurerName: "I",
				category: "Life",
				status: "Active",
			},
			expected: {
				id: 3,
				policyNumber: "P3",
				productName: "P",
				insurerName: "I",
				category: "Life",
				status: "Active",
				nextDueDate: undefined,
			},
		},
		{
			name: "rm",
			path: ["rm"],
			args: { id: "9" },
			expectedMethod: "DELETE",
			expectedUrl: "https://api.test/api/policies/9",
			status: 204,
			response: null,
			expected: { ok: true, id: "9" },
		},
		{
			name: "payments add",
			path: ["payments", "add"],
			args: { id: "5", data: '{"amount":100}', full: false },
			expectedMethod: "POST",
			expectedUrl: "https://api.test/api/policies/5/payments",
			status: 201,
			response: {
				id: 1,
				policyId: 5,
				periodNumber: 1,
				dueDate: "2026-01-01",
				amount: 100,
				status: "Pending",
			},
			expected: {
				id: 1,
				periodNumber: 1,
				dueDate: "2026-01-01",
				amount: 100,
				status: "Pending",
			},
		},
		{
			name: "payments update",
			path: ["payments", "update"],
			args: { id: "5", paymentId: "8", data: '{"amount":200}', full: false },
			expectedMethod: "PUT",
			expectedUrl: "https://api.test/api/policies/5/payments/8",
			status: 200,
			response: {
				id: 8,
				policyId: 5,
				periodNumber: 1,
				dueDate: "2026-01-01",
				amount: 200,
				status: "Paid",
			},
			expected: {
				id: 8,
				periodNumber: 1,
				dueDate: "2026-01-01",
				amount: 200,
				status: "Paid",
			},
		},
		{
			name: "payments rm",
			path: ["payments", "rm"],
			args: { id: "5", paymentId: "8" },
			expectedMethod: "DELETE",
			expectedUrl: "https://api.test/api/policies/5/payments/8",
			status: 204,
			response: null,
			expected: { ok: true, id: "8" },
		},
		{
			name: "beneficiaries ls",
			path: ["beneficiaries", "ls"],
			args: { id: "3", full: false },
			expectedMethod: "GET",
			expectedUrl: "https://api.test/api/policies/3/beneficiaries",
			status: 200,
			response: [{ id: 1, memberId: 99, name: "Spouse", sharePercent: 50, rankOrder: 1 }],
			expected: [{ id: 1, name: "Spouse", sharePercent: 50, rankOrder: 1 }],
		},
		{
			name: "coverage-items ls",
			path: ["coverage-items", "ls"],
			args: { id: "2", full: false },
			expectedMethod: "GET",
			expectedUrl: "https://api.test/api/policies/2/coverage-items",
			status: 200,
			response: [
				{
					id: 1,
					policyId: 2,
					name: "Accident",
					periodLimit: "100k",
					lifetimeLimit: null,
					isOptional: false,
				},
			],
			expected: [
				{
					id: 1,
					name: "Accident",
					periodLimit: "100k",
					lifetimeLimit: null,
					isOptional: false,
				},
			],
		},
		{
			name: "coverage-items get",
			path: ["coverage-items", "get"],
			args: { id: "2", itemId: "4", full: false },
			expectedMethod: "GET",
			expectedUrl: "https://api.test/api/policies/2/coverage-items/4",
			status: 200,
			response: {
				id: 4,
				policyId: 2,
				name: "Hospital",
				periodLimit: "50k",
				lifetimeLimit: null,
				isOptional: true,
			},
			expected: {
				id: 4,
				name: "Hospital",
				periodLimit: "50k",
				lifetimeLimit: null,
				isOptional: true,
			},
		},
		{
			name: "coverage-items add",
			path: ["coverage-items", "add"],
			args: { id: "2", data: '{"name":"New"}', full: false },
			expectedMethod: "POST",
			expectedUrl: "https://api.test/api/policies/2/coverage-items",
			status: 201,
			response: { id: 9, policyId: 2, name: "New" },
			expected: {
				id: 9,
				name: "New",
				periodLimit: undefined,
				lifetimeLimit: undefined,
				isOptional: undefined,
			},
		},
		{
			name: "coverage-items rm",
			path: ["coverage-items", "rm"],
			args: { id: "2", itemId: "4" },
			expectedMethod: "DELETE",
			expectedUrl: "https://api.test/api/policies/2/coverage-items/4",
			status: 204,
			response: null,
			expected: { ok: true, id: "4" },
		},
		{
			name: "attachments ls",
			path: ["attachments", "ls"],
			args: { id: "1", full: false },
			expectedMethod: "GET",
			expectedUrl: "https://api.test/api/policies/1/attachments",
			status: 200,
			response: [
				{ id: 11, policyId: 1, filename: "scan.pdf", contentType: "application/pdf", size: 1024 },
			],
			expected: [{ id: 11, filename: "scan.pdf", contentType: "application/pdf", size: 1024 }],
		},
		{
			name: "attachments get",
			path: ["attachments", "get"],
			args: { id: "1", attachmentId: "11", full: false },
			expectedMethod: "GET",
			expectedUrl: "https://api.test/api/policies/1/attachments/11",
			status: 200,
			response: {
				id: 11,
				policyId: 1,
				filename: "x.pdf",
				contentType: "application/pdf",
				size: 100,
			},
			expected: { id: 11, filename: "x.pdf", contentType: "application/pdf", size: 100 },
		},
	])(
		"$name dispatches request and formats output",
		async ({ path, args, expectedMethod, expectedUrl, status, response, expected }) => {
			let method: string | undefined;
			const client = new ApiClient({
				apiUrl: "https://api.test",
				token: "t",
				fetchImpl: mockFetch((url, init) => {
					expect(url).toBe(expectedUrl);
					method = init.method ?? "GET";
					return { status, body: response === null ? "" : JSON.stringify(response) };
				}),
			});
			await runPath(buildCmd(client), path, args);
			expect(method).toBe(expectedMethod);
			expect(lastJson()).toEqual(expected);
		},
	);
});
