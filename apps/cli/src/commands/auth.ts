import { defineCommand, openBrowser, performLogin } from "@nocoo/cli-base";
import { ApiClient, ApiError } from "../api.js";
import {
  createConfig,
  resolveApiUrl,
  resolveLoginUrl,
  resolveToken,
} from "../config.js";
import { emit, emitError } from "../output.js";

const login = defineCommand({
  meta: {
    name: "login",
    description: "Sign in via browser (CF Access) and save the API token",
  },
  args: {
    "login-url": {
      type: "string",
      description:
        "Override login origin (CF-Access-protected host that mints tokens, default https://surety.hexly.ai)",
    },
    "api-url": {
      type: "string",
      description:
        "Override data-plane API URL saved to config (default https://surety-api.hexly.ai)",
    },
    timeout: {
      type: "string",
      description: "Timeout in seconds (default 180)",
    },
  },
  async run({ args }) {
    const config = createConfig();
    const loginUrl =
      (args["login-url"] as string | undefined) ?? resolveLoginUrl(config);
    const apiUrl =
      (args["api-url"] as string | undefined) ?? resolveApiUrl(config);
    const timeoutSec = args.timeout
      ? Number.parseInt(String(args.timeout), 10)
      : 180;
    if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) {
      emitError("invalid --timeout");
    }

    const result = await performLogin({
      openBrowser,
      apiUrl: loginUrl,
      timeoutMs: timeoutSec * 1000,
      onSaveToken: (token: string) => {
        config.write({ ...config.read(), apiUrl, loginUrl, token });
      },
    });

    if (!result.success) {
      emitError(result.error ?? "login failed");
    }

    const email = result.email ?? result.params?.email;
    if (email) config.write({ ...config.read(), email });
    emit({ ok: true, apiUrl, loginUrl, email: email ?? null });
  },
});

const logout = defineCommand({
  meta: { name: "logout", description: "Forget the saved API token" },
  async run() {
    const config = createConfig();
    const current = config.read();
    delete current.token;
    delete current.email;
    config.write(current);
    emit({ ok: true });
  },
});

const whoami = defineCommand({
  meta: { name: "whoami", description: "Print the authenticated identity" },
  async run() {
    const config = createConfig();
    const apiUrl = resolveApiUrl(config);
    const token = resolveToken(config);
    if (!token) {
      emitError("not logged in — run `surety login`");
    }
    const client = new ApiClient({ apiUrl, token });
    try {
      const me = await client.get<{ email: string; authenticated: boolean }>(
        "/api/me",
      );
      emit({ ok: true, apiUrl, ...me });
    } catch (err) {
      if (err instanceof ApiError) {
        emitError(`api error: ${err.status}`, err.body);
      }
      throw err;
    }
  },
});

export const authCommand = { login, logout, whoami };
