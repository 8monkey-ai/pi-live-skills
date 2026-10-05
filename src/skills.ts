import {
	type Args,
	type BuildSystemPromptOptions,
	DefaultPackageManager,
	loadSkills,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";

type Environment = {
	agentDir: string;
	flags: Pick<Args, "noSkills">;
	projectTrusted: boolean;
};

export async function refreshSkills(options: BuildSystemPromptOptions, environment: Environment) {
	const { agentDir, flags, projectTrusted } = environment;
	if (flags.noSkills) return;
	const { cwd } = options;
	const settingsManager = SettingsManager.create(cwd, agentDir, { projectTrusted });
	const packageManager = new DefaultPackageManager({ cwd, agentDir, settingsManager });
	const resolved = await packageManager.resolve(async () => "skip");
	const skillPaths = [
		...(options.skills ?? []).map((skill) => skill.filePath),
		...resolved.skills.filter((skill) => skill.enabled).map((skill) => skill.path),
	];
	options.skills = loadSkills({ cwd, agentDir, includeDefaults: false, skillPaths }).skills;
}
