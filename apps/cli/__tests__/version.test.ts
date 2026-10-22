import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { CLI_PACKAGE_VERSION, cliPackageRoot } from "../src/version.js";

const cliPackageJsonPath = join(fileURLToPath(new URL("..", import.meta.url)), "package.json");

describe("CLI_PACKAGE_VERSION", () => {
	test("matches apps/cli package.json (not monorepo root)", () => {
		const pkg = JSON.parse(readFileSync(cliPackageJsonPath, "utf-8")) as {
			name: string;
			version: string;
		};
		expect(pkg.name).toBe("@nocoo/surety");
		expect(CLI_PACKAGE_VERSION).toBe(pkg.version);
	});

	test("resolves from package root adjacent to src/ (installed-layout shape)", () => {
		const root = cliPackageRoot();
		const onDisk = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as {
			name: string;
			version: string;
		};
		expect(onDisk.name).toBe("@nocoo/surety");
		expect(CLI_PACKAGE_VERSION).toBe(onDisk.version);
		expect(join(root, "src", "index.ts")).toBe(
			join(fileURLToPath(new URL("../src/index.ts", import.meta.url))),
		);
	});
});
