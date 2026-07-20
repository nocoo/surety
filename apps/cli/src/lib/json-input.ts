import { readFileSync } from "node:fs";
import { emitError } from "../output.js";

/**
 * Parse a JSON payload from (in priority order):
 *   1. `--data <json>` argument
 *   2. `--data-file <path>` argument (use `-` for stdin)
 *   3. stdin if not a TTY
 *
 * Returns `undefined` if no input source is available. Emits a JSON error
 * and exits if input is present but is not valid JSON.
 */
export function readJsonInput(args: Record<string, unknown>): unknown {
	const inline = args.data;
	if (typeof inline === "string" && inline.length > 0) {
		return parseOrExit(inline, "--data");
	}
	const file = args["data-file"];
	if (typeof file === "string" && file.length > 0) {
		const raw = file === "-" ? readStdin() : readFileSync(file, "utf8");
		return parseOrExit(raw, file === "-" ? "stdin" : `--data-file ${file}`);
	}
	if (!process.stdin.isTTY) {
		const raw = readStdin();
		if (raw.trim().length > 0) return parseOrExit(raw, "stdin");
	}
	return undefined;
}

export function requireJsonInput(args: Record<string, unknown>): unknown {
	const body = readJsonInput(args);
	if (body === undefined) {
		emitError(
			"missing JSON payload — pass --data '<json>' or --data-file <path> (or pipe via stdin)",
		);
	}
	return body;
}

function parseOrExit(raw: string, source: string): unknown {
	try {
		return JSON.parse(raw);
	} catch (err) {
		emitError(`invalid JSON from ${source}`, (err as Error).message);
	}
}

function readStdin(): string {
	// Bun exposes a sync file reader on fd 0
	try {
		return readFileSync(0, "utf8");
	} catch {
		return "";
	}
}

/**
 * Shared citty args definition for commands that accept a JSON payload.
 */
export const jsonInputArgs = {
	data: {
		type: "string" as const,
		description: "Inline JSON payload",
	},
	"data-file": {
		type: "string" as const,
		description: "Path to JSON file (use `-` for stdin)",
	},
} as const;
