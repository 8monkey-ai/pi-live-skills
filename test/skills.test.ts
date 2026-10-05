import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { loadSkills } from "@earendil-works/pi-coding-agent";
import { refreshSkills } from "../src/skills.ts";

// The package manager also finds skills under the home folder.
const home = process.env.HOME;
process.env.HOME = mkdtempSync(join(tmpdir(), "skills-home-"));
after(() => {
	process.env.HOME = home;
});

function writeSkill(dir: string, description: string, name = "demo") {
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, "SKILL.md"),
		`---\nname: ${name}\ndescription: ${description}\n---\n\nBody\n`,
	);
}

function startupOptions() {
	const root = mkdtempSync(join(tmpdir(), "skills-"));
	const cwd = join(root, "project");
	const agentDir = join(root, "agent");
	const skillDir = join(root, "skills", "demo");
	mkdirSync(cwd);
	writeSkill(skillDir, "old description");
	const skills = loadSkills({
		cwd,
		agentDir,
		includeDefaults: false,
		skillPaths: [skillDir],
	}).skills;
	return { options: { cwd, skills }, agentDir, skillDir };
}

test("a skill with a new description on disk shows the new description", async () => {
	const { options, agentDir, skillDir } = startupOptions();
	writeSkill(skillDir, "new description");
	await refreshSkills(options, { agentDir, flags: {}, projectTrusted: true });
	assert.deepEqual(
		options.skills.map((skill) => skill.description),
		["new description"],
	);
});

test("a deleted skill drops out", async () => {
	const { options, agentDir, skillDir } = startupOptions();
	rmSync(skillDir, { recursive: true });
	await refreshSkills(options, { agentDir, flags: {}, projectTrusted: true });
	assert.deepEqual(options.skills, []);
});

test("a -ns start keeps its skills", async () => {
	const { options, agentDir, skillDir } = startupOptions();
	writeSkill(skillDir, "new description");
	await refreshSkills(options, { agentDir, flags: { noSkills: true }, projectTrusted: true });
	assert.deepEqual(
		options.skills.map((skill) => skill.description),
		["old description"],
	);
});

test("a new skill folder in the agent folder appears", async () => {
	const { options, agentDir } = startupOptions();
	writeSkill(join(agentDir, "skills", "added"), "added description", "added");
	await refreshSkills(options, { agentDir, flags: {}, projectTrusted: true });
	assert.deepEqual(
		options.skills.map((skill) => skill.name),
		["demo", "added"],
	);
});

test("a new project skill appears only when the project is trusted", async () => {
	for (const [projectTrusted, names] of [
		[true, ["demo", "added"]],
		[false, ["demo"]],
	] as const) {
		const { options, agentDir } = startupOptions();
		writeSkill(join(options.cwd, ".pi", "skills", "added"), "added description", "added");
		await refreshSkills(options, { agentDir, flags: {}, projectTrusted });
		assert.deepEqual(
			options.skills.map((skill) => skill.name),
			names,
		);
	}
});
