import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { ContextEvent } from "@earendil-works/pi-coding-agent";
import { refreshSkillContent } from "../src/refresh-skill-content.ts";

type Messages = ContextEvent["messages"];
type Skills = Parameters<typeof refreshSkillContent>[2];

const skillPath = "/skills/demo/SKILL.md";
const blockPath = "/skills/block/SKILL.md";
const homeSkill = join(homedir(), "skills/home/SKILL.md");
const files: Record<string, string> = {
	[skillPath]: "new text",
	[homeSkill]: "home text",
	"/notes.md": "new notes",
	"/skills/flat.md": "flat text",
	[blockPath]: "---\nname: block\ndescription: d\n---\n\nnew body\n",
};
const readFile = (path: string) => files[path];
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

function refresh(messages: Messages, cwd = "/", skills: Skills = []) {
	return refreshSkillContent(messages, cwd, skills, readFile);
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

function userMessage(content: string): Messages[number] {
	return { role: "user", content, timestamp: 0 };
}

function userText(messages: Messages) {
	const message = messages[0];
	assert.equal(message?.role, "user");
	return message.content;
}

function skillBlock(body: string) {
	return `<skill name="block" location="${blockPath}">\nReferences are relative to /old.\n\n${body}\n</skill>`;
}

const freshBlock = `<skill name="block" location="${blockPath}">\nReferences are relative to /skills/block.\n\nnew body\n</skill>`;

test("a skill block gets the new body and keeps the arguments", () => {
	const messages = refresh([userMessage(`${skillBlock("old body")}\n\nmy arguments`)]);
	assert.equal(userText(messages), `${freshBlock}\n\nmy arguments`);
});

test("a skill block in a text part gets the new body", () => {
	const message: Messages[number] = {
		role: "user",
		content: [{ type: "text", text: skillBlock("old body") }],
		timestamp: 0,
	};
	assert.deepEqual(userText(refresh([message])), [{ type: "text", text: freshBlock }]);
});

test("a skill block of a deleted file keeps the wrapper with the notice", () => {
	const location = "/skills/gone/SKILL.md";
	const block = `<skill name="gone" location="${location}">\nReferences are relative to /skills/gone.\n\nold body\n</skill>\n\nargs`;
	assert.equal(
		userText(refresh([userMessage(block)])),
		`<skill name="gone" location="${location}">\nReferences are relative to /skills/gone.\n\nThis skill file no longer exists.\n</skill>\n\nargs`,
	);
});

test("a user message without a skill block keeps its message object", () => {
	const message = userMessage("hello");
	assert.equal(refresh([message])[0], message);
});

test("a skill block that matches the disk keeps its message object", () => {
	const message = userMessage(freshBlock);
	assert.equal(refresh([message])[0], message);
});

test("a read of a loaded skill file with another name gets the disk text", () => {
	const skills = [{ filePath: "/skills/flat.md", baseDir: "/skills" }];
	const messages = refresh(readExchange({ path: "/skills/flat.md" }), "/", skills);
	assert.deepEqual(resultText(messages), [{ type: "text", text: "flat text" }]);
});

test("a skill block of a loaded skill uses the base folder of the skill", () => {
	const skills = [{ filePath: blockPath, baseDir: "/skills" }];
	const messages = refresh([userMessage(skillBlock("old body"))], "/", skills);
	assert.equal(
		userText(messages),
		`<skill name="block" location="${blockPath}">\nReferences are relative to /skills.\n\nnew body\n</skill>`,
	);
});
