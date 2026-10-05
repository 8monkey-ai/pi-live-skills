import { join } from "node:path";
import {
	type Args,
	type BuildSystemPromptOptions,
	CONFIG_DIR_NAME,
	loadProjectContextFiles,
} from "@earendil-works/pi-coding-agent";

type Environment = {
	agentDir: string;
	flags: Pick<Args, "noContextFiles" | "systemPrompt" | "appendSystemPrompt">;
	projectTrusted: boolean;
	readFile: (path: string) => string | undefined;
};

export function refreshPromptFiles(options: BuildSystemPromptOptions, environment: Environment) {
	const { agentDir, flags } = environment;
	if (!flags.noContextFiles) {
		options.contextFiles = loadProjectContextFiles({ cwd: options.cwd, agentDir });
	}
	if (flags.systemPrompt === undefined) {
		options.customPrompt = readPromptFile("SYSTEM.md", options.cwd, environment);
	}
	if (flags.appendSystemPrompt === undefined) {
		options.appendSystemPrompt = readPromptFile("APPEND_SYSTEM.md", options.cwd, environment) ?? "";
	}
}

function readPromptFile(name: string, cwd: string, environment: Environment) {
	const { agentDir, projectTrusted, readFile } = environment;
	const projectText = projectTrusted ? readFile(join(cwd, CONFIG_DIR_NAME, name)) : undefined;
	return (projectText ?? readFile(join(agentDir, name)))?.replace(/^\uFEFF/, "");
}
