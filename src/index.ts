import { existsSync, readFileSync } from "node:fs";
import {
	type ExtensionAPI,
	getAgentDir,
	parseArgs,
	type Skill,
} from "@earendil-works/pi-coding-agent";
import { refreshPromptFiles } from "./prompt-files.ts";
import { refreshSkillContent } from "./refresh-skill-content.ts";
import { refreshSkills } from "./skills.ts";

export default function (pi: ExtensionAPI) {
	const flags = parseArgs(process.argv.slice(2));
	let skills: Skill[] = [];

	pi.on("before_agent_start", (event, ctx) => {
		const options = event.systemPromptOptions;
		const agentDir = getAgentDir();
		refreshPromptFiles(options, {
			agentDir,
			flags,
			projectTrusted: ctx.isProjectTrusted(),
			readFile: readTextFile,
		});
		refreshSkills(options, agentDir, flags);
		skills = options.skills;
	});

	pi.on("context", (event, ctx) => ({
		messages: refreshSkillContent(event.messages, ctx.cwd, skills, readTextFile),
	}));
}

function readTextFile(path: string) {
	return existsSync(path) ? readFileSync(path, "utf-8") : undefined;
}
