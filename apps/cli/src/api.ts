import { emitError } from "./output.js";

export interface ApiClientOptions {
	apiUrl: string;
	token?: string | undefined;
	fetchImpl?: typeof fetch;
	/**
	 * When true (the default), non-2xx responses terminate the process with a
	 * JSON error envelope on stderr — matching the CLI's public output
	 * contract. Tests set this to false to observe the thrown `ApiError`.
	 */
	exitOnError?: boolean;
}

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly method: string,
		public readonly path: string,
		public readonly body: unknown,
	) {
		super(`${method} ${path} → ${status}`);
		this.name = "ApiError";
	}
}

export class ApiClient {
	private readonly apiUrl: string;
	private readonly token: string | undefined;
	private readonly fetchImpl: typeof fetch;
	private readonly exitOnError: boolean;

	constructor(opts: ApiClientOptions) {
		this.apiUrl = opts.apiUrl.replace(/\/+$/, "");
		this.token = opts.token;
		this.fetchImpl = opts.fetchImpl ?? fetch;
		this.exitOnError = opts.exitOnError !== false;
	}

	async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
		const url = `${this.apiUrl}${path.startsWith("/") ? path : `/${path}`}`;
		const headers: Record<string, string> = {
			accept: "application/json",
		};
		if (this.token) headers.authorization = `Bearer ${this.token}`;
		const init: RequestInit = { method, headers };
		if (body !== undefined) {
			headers["content-type"] = "application/json";
			init.body = JSON.stringify(body);
		}
		let res: Response;
		try {
			res = await this.fetchImpl(url, init);
		} catch (err) {
			if (this.exitOnError) {
				emitError(`network error: ${method} ${path}`, (err as Error).message);
			}
			throw err;
		}
		const text = await res.text();
		let parsed: unknown = text;
		if (text.length > 0) {
			try {
				parsed = JSON.parse(text);
			} catch {
				// leave parsed as raw text
			}
		}
		if (!res.ok) {
			if (this.exitOnError) {
				emitError(`api error: ${res.status} ${method} ${path}`, parsed);
			}
			throw new ApiError(res.status, method, path, parsed);
		}
		return parsed as T;
	}

	get<T = unknown>(path: string): Promise<T> {
		return this.request<T>("GET", path);
	}
	post<T = unknown>(path: string, body?: unknown): Promise<T> {
		return this.request<T>("POST", path, body);
	}
	put<T = unknown>(path: string, body?: unknown): Promise<T> {
		return this.request<T>("PUT", path, body);
	}
	delete<T = unknown>(path: string): Promise<T> {
		return this.request<T>("DELETE", path);
	}
}
