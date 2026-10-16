#!/usr/bin/env bun
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineCommand, readVersion, runMain } from "@nocoo/base-cli";
import { assetsCommand } from "./commands/assets.js";
import { authCommand } from "./commands/auth.js";
import { doctorsCommand } from "./commands/doctors.js";
import { hospitalsCommand } from "./commands/hospitals.js";
import { insurersCommand } from "./commands/insurers.js";
import { medicalVisitsCommand } from "./commands/medical-visits.js";
import { membersCommand } from "./commands/members.js";
import { policiesCommand } from "./commands/policies.js";
import { coverageCommand, dashboardCommand, renewalsCommand } from "./commands/readonly.js";
import { skillCommand } from "./commands/skill.js";
import { buildAgentSkillDocument } from "./skill/document.js";

const cliVersion = readVersion(join(dirname(fileURLToPath(import.meta.url)), "../../.."));

const main = defineCommand({
	meta: {
		name: "surety",
		version: cliVersion,
		description: "Surety CLI — AI-facing interface for household policies",
	},
	args: {
		skill: {
			type: "boolean",
			description: "Print agent-oriented usage documentation and exit",
			default: false,
		},
	},
	async setup({ args }) {
		if (args.skill) {
			process.stdout.write(`${buildAgentSkillDocument()}\n`);
			process.exit(0);
		}
	},
	subCommands: {
		skill: skillCommand,
		login: authCommand.login,
		logout: authCommand.logout,
		whoami: authCommand.whoami,
		members: membersCommand,
		insurers: insurersCommand,
		assets: assetsCommand,
		hospitals: hospitalsCommand,
		doctors: doctorsCommand,
		"medical-visits": medicalVisitsCommand,
		policies: policiesCommand,
		coverage: coverageCommand,
		renewals: renewalsCommand,
		dashboard: dashboardCommand,
	},
});

runMain(main);
