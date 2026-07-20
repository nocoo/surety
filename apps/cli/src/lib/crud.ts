import { defineCommand } from "@nocoo/base-cli";
import type { ApiClient } from "../api.js";
import { emit, emitList, emitRecord, type Summarizer } from "../output.js";
import { buildClient } from "./client.js";
import { jsonInputArgs, requireJsonInput } from "./json-input.js";

export interface CrudDef<T extends Record<string, unknown>> {
	/** Command name, e.g. "members" */
	name: string;
	/** Short description shown in `surety --help` */
	description: string;
	/** Base path on the Worker, e.g. "/api/members" (no trailing slash) */
	basePath: string;
	/** Project a record down to a summary for the default JSON output */
	summarize: Summarizer<T>;
	/**
	 * Optional factory to build the client. Defaults to `buildClient()`.
	 * Useful for tests.
	 */
	buildClient?: () => ApiClient;
}

const fullArg = {
	full: {
		type: "boolean" as const,
		description: "Return the full record(s) instead of a summary",
		default: false,
	},
} as const;

const idArg = {
	id: {
		type: "positional" as const,
		description: "Record id",
		required: true,
	},
} as const;

export function defineCrudCommand<T extends Record<string, unknown>>(def: CrudDef<T>) {
	const client = () => (def.buildClient ?? buildClient)();

	const ls = defineCommand({
		meta: { name: "ls", description: `List ${def.name}` },
		args: { ...fullArg },
		async run({ args }) {
			const records = await client().get<T[]>(def.basePath);
			emitList(records, def.summarize, { full: Boolean(args.full) });
		},
	});

	const get = defineCommand({
		meta: { name: "get", description: `Get one ${def.name} by id` },
		args: { ...idArg, ...fullArg },
		async run({ args }) {
			const record = await client().get<T>(`${def.basePath}/${args.id}`);
			emitRecord(record, def.summarize, { full: Boolean(args.full) });
		},
	});

	const add = defineCommand({
		meta: { name: "add", description: `Create a new ${def.name}` },
		args: { ...jsonInputArgs, ...fullArg },
		async run({ args }) {
			const body = requireJsonInput(args);
			const created = await client().post<T>(def.basePath, body);
			emitRecord(created, def.summarize, { full: Boolean(args.full) });
		},
	});

	const update = defineCommand({
		meta: { name: "update", description: `Update a ${def.name} by id` },
		args: { ...idArg, ...jsonInputArgs, ...fullArg },
		async run({ args }) {
			const body = requireJsonInput(args);
			const updated = await client().put<T>(`${def.basePath}/${args.id}`, body);
			emitRecord(updated, def.summarize, { full: Boolean(args.full) });
		},
	});

	const rm = defineCommand({
		meta: { name: "rm", description: `Delete a ${def.name} by id` },
		args: { ...idArg },
		async run({ args }) {
			await client().delete(`${def.basePath}/${args.id}`);
			emit({ ok: true, id: args.id });
		},
	});

	return defineCommand({
		meta: { name: def.name, description: def.description },
		subCommands: { ls, get, add, update, rm },
	});
}
