import {
	type Args,
	type BuildSystemPromptOptions,
	loadSkills,
} from "@earendil-works/pi-coding-agent";

export function refreshSkills(
	options: BuildSystemPromptOptions,
	agentDir: string,
	flags: Pick<Args, "noSkills">,
) {
	if (flags.noSkills) return;
	const skillPaths = (options.skills ?? []).map((skill) => skill.filePath);
	options.skills = loadSkills({
		cwd: options.cwd,
		agentDir,
		includeDefaults: false,
		skillPaths,
	}).skills;
}
