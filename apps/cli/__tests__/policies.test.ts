import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { definePoliciesCommand } from "../src/commands/policies";
import { ApiClient } from "../src/api";
import type { CommandDef } from "@nocoo/base-cli";

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

function resolveSub(
  cmd: CommandDef,
  path: string[],
): CommandDef {
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
    stdoutChunks.push(
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString(),
    );
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
        expect(url).toBe(
          "https://api.test/api/policies/42/payments/generate",
        );
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
        expect(url).toBe(
          "https://api.test/api/policies/10/coverage-items/3",
        );
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
});
