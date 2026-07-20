import { homedir } from "node:os";
import { join } from "node:path";
import { ConfigManager } from "@nocoo/base-cli";

export interface SuretyConfig {
	apiUrl?: string;
	loginUrl?: string;
	token?: string;
	email?: string;
	[k: string]: unknown;
}

/**
 * Two domains are intentionally separate:
 *   - loginUrl: CF-Access-protected origin that mints CLI tokens via the
 *     browser loopback flow (/api/auth/cli). Required for `surety login`.
 *   - apiUrl: data-plane origin that accepts Bearer tokens. Used for
 *     every other command.
 */
export const DEFAULT_API_URL = "https://surety-api.hexly.ai";
export const DEFAULT_LOGIN_URL = "https://surety.hexly.ai";

export function getConfigDir(): string {
	return join(homedir(), ".config", "surety");
}

export function isDevMode(env: NodeJS.ProcessEnv = process.env): boolean {
	return env.SURETY_CLI_DEV === "1" || env.SURETY_CLI_DEV === "true";
}

export function createConfig(env: NodeJS.ProcessEnv = process.env): ConfigManager<SuretyConfig> {
	return new ConfigManager<SuretyConfig>(getConfigDir(), isDevMode(env));
}

export function resolveApiUrl(
	config: ConfigManager<SuretyConfig>,
	env: NodeJS.ProcessEnv = process.env,
): string {
	return env.SURETY_API_URL ?? config.get("apiUrl") ?? DEFAULT_API_URL;
}

export function resolveLoginUrl(
	config: ConfigManager<SuretyConfig>,
	env: NodeJS.ProcessEnv = process.env,
): string {
	return env.SURETY_LOGIN_URL ?? config.get("loginUrl") ?? DEFAULT_LOGIN_URL;
}

export function resolveToken(
	config: ConfigManager<SuretyConfig>,
	env: NodeJS.ProcessEnv = process.env,
): string | undefined {
	return env.SURETY_API_TOKEN ?? config.get("token");
}
