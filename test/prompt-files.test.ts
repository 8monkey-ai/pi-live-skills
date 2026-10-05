import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { BuildSystemPromptOptions } from "@earendil-works/pi-coding-agent";
import { refreshPromptFiles } from "../src/prompt-files.ts";

function makeDirs() {
	const root = mkdtempSync(join(tmpdir(), "prompt-files-"));
	const cwd = join(root, "project");
	const agentDir = join(root, "agent");
	mkdirSync(cwd);
	mkdirSync(agentDir);
	return { cwd, agentDir };
}

function refresh(
	options: BuildSystemPromptOptions,
	agentDir: string,
	environment: Partial<Parameters<typeof refreshPromptFiles>[1]> = {},
) {
	refreshPromptFiles(options, {
		agentDir,
		flags: {},
		projectTrusted: true,
		readFile: () => undefined,
		...environment,
	});
	return options;
}

test("each prompt flag keeps only its own prompt", () => {
	const { cwd, agentDir } = makeDirs();
	const files: Record<string, string> = {
		[join(agentDir, "SYSTEM.md")]: "disk system",
		[join(agentDir, "APPEND_SYSTEM.md")]: "disk append",
	};
	const readFile = (path: string) => files[path];
	const startup = { cwd, customPrompt: "cli system", appendSystemPrompt: "cli append" };

	const systemStart = refresh({ ...startup }, agentDir, {
		flags: { systemPrompt: "cli system" },
		readFile,
	});
	assert.equal(systemStart.customPrompt, "cli system");
	assert.equal(systemStart.appendSystemPrompt, "disk append");

	const appendStart = refresh({ ...startup }, agentDir, {
		flags: { appendSystemPrompt: ["cli append"] },
		readFile,
	});
	assert.equal(appendStart.customPrompt, "disk system");
	assert.equal(appendStart.appendSystemPrompt, "cli append");
});

test("a -nc start keeps its context files", () => {
	const { cwd, agentDir } = makeDirs();
	writeFileSync(join(cwd, "AGENTS.md"), "rules");
	const options = refresh({ cwd, contextFiles: [] }, agentDir, { flags: { noContextFiles: true } });
	assert.deepEqual(options.contextFiles, []);
});

test("a trusted project uses .pi/SYSTEM.md and an untrusted project ignores it", () => {
	const { cwd, agentDir } = makeDirs();
	const files: Record<string, string> = {
		[join(cwd, ".pi", "SYSTEM.md")]: "project system",
		[join(agentDir, "SYSTEM.md")]: "\uFEFFglobal system",
	};
	const readFile = (path: string) => files[path];
	assert.equal(refresh({ cwd }, agentDir, { readFile }).customPrompt, "project system");
	assert.equal(
		refresh({ cwd }, agentDir, { readFile, projectTrusted: false }).customPrompt,
		"global system",
	);
});

test("a deleted APPEND_SYSTEM.md gives an empty append prompt", () => {
	const { cwd, agentDir } = makeDirs();
	const options = refresh({ cwd, customPrompt: "old", appendSystemPrompt: "old" }, agentDir);
	assert.equal(options.customPrompt, undefined);
	assert.equal(options.appendSystemPrompt, "");
});

test("a new AGENTS.md appears in the context files", () => {
	const { cwd, agentDir } = makeDirs();
	writeFileSync(join(cwd, "AGENTS.md"), "rules");
	const options = refresh({ cwd, contextFiles: [] }, agentDir);
	assert.deepEqual(options.contextFiles, [{ path: join(cwd, "AGENTS.md"), content: "rules" }]);
});
