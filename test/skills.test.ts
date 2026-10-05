import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadSkills } from "@earendil-works/pi-coding-agent";
import { refreshSkills } from "../src/skills.ts";

function writeSkill(dir: string, description: string) {
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, "SKILL.md"),
		`---\nname: demo\ndescription: ${description}\n---\n\nBody\n`,
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

test("a skill with a new description on disk shows the new description", () => {
	const { options, agentDir, skillDir } = startupOptions();
	writeSkill(skillDir, "new description");
	refreshSkills(options, agentDir, {});
	assert.deepEqual(
		options.skills.map((skill) => skill.description),
		["new description"],
	);
});

test("a deleted skill drops out", () => {
	const { options, agentDir, skillDir } = startupOptions();
	rmSync(skillDir, { recursive: true });
	refreshSkills(options, agentDir, {});
	assert.deepEqual(options.skills, []);
});

test("a -ns start keeps its skills", () => {
	const { options, agentDir, skillDir } = startupOptions();
	writeSkill(skillDir, "new description");
	refreshSkills(options, agentDir, { noSkills: true });
	assert.deepEqual(
		options.skills.map((skill) => skill.description),
		["old description"],
	);
});
