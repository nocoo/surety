import { defineCommand } from "@nocoo/base-cli";
import { buildAgentSkillDocument } from "../skill/document.js";

export const skillCommand = defineCommand({
	meta: {
		name: "skill",
		description: "Print agent-oriented usage documentation and exit",
	},
	run() {
		process.stdout.write(`${buildAgentSkillDocument()}\n`);
	},
});
