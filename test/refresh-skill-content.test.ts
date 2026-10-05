import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { ContextEvent } from "@earendil-works/pi-coding-agent";
import { refreshSkillContent } from "../src/refresh-skill-content.ts";

type Messages = ContextEvent["messages"];

const skillPath = "/skills/demo/SKILL.md";
const homeSkill = join(homedir(), "skills/home/SKILL.md");
const files: Record<string, string> = {
	[skillPath]: "new text",
	[homeSkill]: "home text",
	"/notes.md": "new notes",
};
const readFile = (path: string) => files[path];
const isSkillFile = (path: string) => path.endsWith("SKILL.md");

function readCall(id: string, args: Record<string, string | number>): Messages[number] {
	return {
		role: "assistant",
		content: [{ type: "toolCall", id, name: "read", arguments: args }],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "test",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "toolUse",
		timestamp: 0,
	};
}

type ResultOptions = { isError?: boolean; truncated?: boolean };

function readResult(id: string, options: ResultOptions) {
	return {
		role: "toolResult",
		toolCallId: id,
		toolName: "read",
		content: [{ type: "text", text: "old text" }],
		details: options.truncated ? { truncation: {} } : undefined,
		isError: options.isError ?? false,
		timestamp: 0,
	} satisfies Messages[number];
}

function readExchange(
	args: Record<string, string | number>,
	options: ResultOptions = {},
): Messages {
	return [readCall("call-1", args), readResult("call-1", options)];
}

function resultText(messages: Messages) {
	const result = messages[1];
	assert.equal(result?.role, "toolResult");
	return result.content;
}

function refresh(messages: Messages, cwd = "/") {
	return refreshSkillContent(messages, cwd, isSkillFile, readFile);
}

test("a full read of a skill file gets the disk text", () => {
	const messages = refresh(readExchange({ path: skillPath }));
	assert.deepEqual(resultText(messages), [{ type: "text", text: "new text" }]);
});

test("partial reads stay as they are", () => {
	const partialArgs: Record<string, string | number>[] = [
		{ path: skillPath, limit: 10 },
		{ path: skillPath, offset: 2 },
	];
	for (const args of partialArgs) {
		assert.deepEqual(resultText(refresh(readExchange(args))), [{ type: "text", text: "old text" }]);
	}
});

test("a truncated read stays as it is", () => {
	const messages = refresh(readExchange({ path: skillPath }, { truncated: true }));
	assert.deepEqual(resultText(messages), [{ type: "text", text: "old text" }]);
});

test("a failed read stays as it is", () => {
	const messages = refresh(readExchange({ path: skillPath }, { isError: true }));
	assert.deepEqual(resultText(messages), [{ type: "text", text: "old text" }]);
});

test("a read of a file that is not a skill stays as it is", () => {
	const messages = refresh(readExchange({ path: "/notes.md" }));
	assert.deepEqual(resultText(messages), [{ type: "text", text: "old text" }]);
});

test("a read that matches the disk keeps its message object", () => {
	const messages = readExchange({ path: skillPath });
	const current = {
		...readResult("call-1", {}),
		content: [{ type: "text" as const, text: "new text" }],
	};
	messages[1] = current;
	assert.equal(refresh(messages)[1], current);
});

test("a deleted skill file gives the notice", () => {
	const messages = refresh(readExchange({ path: "/skills/gone/SKILL.md" }));
	assert.deepEqual(resultText(messages), [
		{ type: "text", text: "This skill file no longer exists." },
	]);
});

test("relative, @ and ~ paths resolve", () => {
	const cases = [
		{ path: "demo/SKILL.md", cwd: "/skills", text: "new text" },
		{ path: "@demo/SKILL.md", cwd: "/skills", text: "new text" },
		{ path: "~/skills/home/SKILL.md", cwd: "/", text: "home text" },
	];
	for (const { path, cwd, text } of cases) {
		assert.deepEqual(resultText(refresh(readExchange({ path }), cwd)), [{ type: "text", text }]);
	}
});

test("the result is a new array and the input stays as it is", () => {
	const messages = readExchange({ path: skillPath });
	const refreshed = refresh(messages);
	assert.notEqual(refreshed, messages);
	assert.deepEqual(resultText(messages), [{ type: "text", text: "old text" }]);
});
