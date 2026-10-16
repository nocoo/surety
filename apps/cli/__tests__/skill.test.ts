import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
	buildAgentSkillDocument,
	SKILL_HEADING,
	SKILL_SECTION_MARKERS,
} from "../src/skill/document.js";

const cliEntry = join(dirname(fileURLToPath(import.meta.url)), "../src/index.ts");

function runCli(args: string[]) {
	return spawnSync("bun", [cliEntry, ...args], {
		encoding: "utf-8",
		env: {
			...process.env,
			HOME: "/tmp/surety-cli-skill-test-home",
			SURETY_API_TOKEN: "",
		},
	});
}

describe("buildAgentSkillDocument", () => {
	test("includes required agent topics", () => {
		const doc = buildAgentSkillDocument();
		expect(doc.startsWith(SKILL_HEADING)).toBe(true);
		expect(doc).toContain(SKILL_SECTION_MARKERS.auth);
		expect(doc).toContain(SKILL_SECTION_MARKERS.medicalVisits);
		expect(doc).toContain(SKILL_SECTION_MARKERS.output);
		expect(doc).toContain(SKILL_SECTION_MARKERS.envToken);
		expect(doc).toContain("surety login");
		expect(doc).toContain("apps/cli/README.md");
		expect(doc).toContain("docs/21-agent-operations.md");
		expect(doc).toContain("--data");
		expect(doc).toContain("--full");
		expect(doc).toContain("renewals");
		expect(doc).toContain("dashboard");
		expect(doc).toContain("merge-written config");
		expect(doc).not.toContain("Clear local session fields");
	});
});

describe("surety --skill", () => {
	test("exits 0 and prints the agent guide without auth", () => {
		const result = runCli(["--skill"]);
		expect(result.status).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toContain(SKILL_SECTION_MARKERS.auth);
		expect(result.stdout).toContain(SKILL_SECTION_MARKERS.medicalVisits);
	});

	test("surety skill subcommand matches --skill output", () => {
		const flag = runCli(["--skill"]);
		const sub = runCli(["skill"]);
		expect(sub.status).toBe(0);
		expect(sub.stdout).toBe(flag.stdout);
	});
});
