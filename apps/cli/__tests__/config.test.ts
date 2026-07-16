import { describe, expect, test } from "vitest";
import {
  DEFAULT_API_URL,
  DEFAULT_LOGIN_URL,
  isDevMode,
  resolveApiUrl,
  resolveLoginUrl,
  resolveToken,
} from "../src/config";
import type { ConfigManager } from "@nocoo/base-cli";
import type { SuretyConfig } from "../src/config";

function stubConfig(data: SuretyConfig): ConfigManager<SuretyConfig> {
  return {
    read: () => data,
    get: (key: keyof SuretyConfig) => data[key as string],
    // rest is unused by the helpers under test
  } as unknown as ConfigManager<SuretyConfig>;
}

function env(obj: Record<string, string>): NodeJS.ProcessEnv {
  return obj as unknown as NodeJS.ProcessEnv;
}

describe("isDevMode", () => {
  test("true when SURETY_CLI_DEV=1", () => {
    expect(isDevMode(env({ SURETY_CLI_DEV: "1" }))).toBe(true);
  });
  test("true when SURETY_CLI_DEV=true", () => {
    expect(isDevMode(env({ SURETY_CLI_DEV: "true" }))).toBe(true);
  });
  test("false by default", () => {
    expect(isDevMode(env({}))).toBe(false);
  });
});

describe("resolveApiUrl", () => {
  test("env SURETY_API_URL wins over config", () => {
    const cfg = stubConfig({ apiUrl: "https://config.example" });
    expect(resolveApiUrl(cfg, env({ SURETY_API_URL: "https://env.example" }))).toBe(
      "https://env.example",
    );
  });
  test("config apiUrl used when env unset", () => {
    const cfg = stubConfig({ apiUrl: "https://config.example" });
    expect(resolveApiUrl(cfg, env({}))).toBe("https://config.example");
  });
  test("falls back to DEFAULT_API_URL", () => {
    const cfg = stubConfig({});
    expect(resolveApiUrl(cfg, env({}))).toBe(DEFAULT_API_URL);
  });
});

describe("resolveLoginUrl", () => {
  test("env SURETY_LOGIN_URL wins over config", () => {
    const cfg = stubConfig({ loginUrl: "https://config-login.example" });
    expect(
      resolveLoginUrl(
        cfg,
        env({ SURETY_LOGIN_URL: "https://env-login.example" }),
      ),
    ).toBe("https://env-login.example");
  });
  test("config loginUrl used when env unset", () => {
    const cfg = stubConfig({ loginUrl: "https://config-login.example" });
    expect(resolveLoginUrl(cfg, env({}))).toBe("https://config-login.example");
  });
  test("falls back to DEFAULT_LOGIN_URL and is distinct from DEFAULT_API_URL", () => {
    const cfg = stubConfig({});
    expect(resolveLoginUrl(cfg, env({}))).toBe(DEFAULT_LOGIN_URL);
    expect(DEFAULT_LOGIN_URL).not.toBe(DEFAULT_API_URL);
  });
});

describe("resolveToken", () => {
  test("env SURETY_API_TOKEN wins over config", () => {
    const cfg = stubConfig({ token: "from-config" });
    expect(resolveToken(cfg, env({ SURETY_API_TOKEN: "from-env" }))).toBe(
      "from-env",
    );
  });
  test("falls back to config", () => {
    const cfg = stubConfig({ token: "from-config" });
    expect(resolveToken(cfg, env({}))).toBe("from-config");
  });
  test("undefined when neither set", () => {
    const cfg = stubConfig({});
    expect(resolveToken(cfg, env({}))).toBeUndefined();
  });
});
