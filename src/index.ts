import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { type ExtensionAPI, getAgentDir, parseArgs } from "@earendil-works/pi-coding-agent";
import { refreshPromptFiles } from "./prompt-files.ts";
import { refreshSkillContent } from "./refresh-skill-content.ts";

export default function (pi: ExtensionAPI) {
	const flags = parseArgs(process.argv.slice(2));

	pi.on("before_agent_start", (event, ctx) => {
		refreshPromptFiles(event.systemPromptOptions, {
			agentDir: getAgentDir(),
			flags,
			projectTrusted: ctx.isProjectTrusted(),
			readFile: readTextFile,
		});
	});

	pi.on("context", (event, ctx) => ({
		messages: refreshSkillContent(
			event.messages,
			ctx.cwd,
			(path) => basename(path) === "SKILL.md",
			readTextFile,
		),
	}));
}

function readTextFile(path: string) {
	return existsSync(path) ? readFileSync(path, "utf-8") : undefined;
}
