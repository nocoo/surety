import { homedir } from "node:os";
import { join } from "node:path";
import { ConfigManager } from "@nocoo/cli-base";

export interface SuretyConfig {
  apiUrl?: string;
  token?: string;
  email?: string;
  [k: string]: unknown;
}

export const DEFAULT_API_URL = "https://surety-api.hexly.ai";

export function getConfigDir(): string {
  return join(homedir(), ".config", "surety");
}

export function isDevMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SURETY_CLI_DEV === "1" || env.SURETY_CLI_DEV === "true";
}

export function createConfig(
  env: NodeJS.ProcessEnv = process.env,
): ConfigManager<SuretyConfig> {
  return new ConfigManager<SuretyConfig>(getConfigDir(), isDevMode(env));
}

export function resolveApiUrl(
  config: ConfigManager<SuretyConfig>,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.SURETY_API_URL ?? config.get("apiUrl") ?? DEFAULT_API_URL;
}

export function resolveToken(
  config: ConfigManager<SuretyConfig>,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env.SURETY_API_TOKEN ?? config.get("token");
}
