import { ApiClient } from "../api.js";
import { createConfig, resolveApiUrl, resolveToken } from "../config.js";
import { emitError } from "../output.js";

/**
 * Build an authenticated ApiClient from env + config. Exits with a JSON
 * error envelope if no token is available.
 */
export function buildClient(env: NodeJS.ProcessEnv = process.env): ApiClient {
  const config = createConfig(env);
  const apiUrl = resolveApiUrl(config, env);
  const token = resolveToken(config, env);
  if (!token) {
    emitError("not logged in — run `surety login`");
  }
  return new ApiClient({ apiUrl, token });
}
