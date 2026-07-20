/**
 * JSON-only output helpers.
 *
 * All CLI commands emit JSON on stdout. There is no human-readable mode —
 * this tool is for AI/script consumers. Two sizes:
 *   - summary (default): compact projection of each record, for context-
 *     efficient listings.
 *   - full (--full): entire response as returned by the Worker API.
 *
 * For error cases use `emitError` which prints a JSON envelope and exits
 * with code 1.
 */

export type Summarizer<T> = (record: T) => Record<string, unknown>;

export interface EmitOptions {
	full: boolean;
}

export function emit(value: unknown): void {
	process.stdout.write(`${JSON.stringify(value)}\n`);
}

export function emitRecord<T>(record: T, summarize: Summarizer<T>, opts: EmitOptions): void {
	emit(opts.full ? record : summarize(record));
}

export function emitList<T>(records: T[], summarize: Summarizer<T>, opts: EmitOptions): void {
	emit(opts.full ? records : records.map(summarize));
}

export function emitError(message: string, detail?: unknown): never {
	const payload: Record<string, unknown> = { ok: false, error: message };
	if (detail !== undefined) payload.detail = detail;
	process.stderr.write(`${JSON.stringify(payload)}\n`);
	process.exit(1);
}
