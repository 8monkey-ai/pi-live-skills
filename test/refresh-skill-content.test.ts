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

function resultContent(messages: Messages) {
	const result = messages[1];
	assert.equal(result?.role, "toolResult");
	return result.content;
}

function refresh(messages: Messages, cwd = "/", skills: Skills = []) {
	return refreshSkillContent(messages, cwd, skills, readFile);
}

test("a full read of a skill file gets the disk text in a new message", () => {
	const messages = readExchange({ path: skillPath });
	assert.deepEqual(resultContent(refresh(messages)), [{ type: "text", text: "new text" }]);
	assert.deepEqual(resultContent(messages), [{ type: "text", text: "old text" }]);
});

test("each read result pairs with the read call of the same id", () => {
	const messages: Messages = [
		readCall("full", { path: skillPath }),
		readCall("partial", { path: skillPath, limit: 1 }),
		readResult("partial", {}),
		readResult("full", {}),
		readResult("orphan", {}),
	];
	const texts = refresh(messages).map((message) =>
		message.role === "toolResult" ? message.content : undefined,
	);
	assert.deepEqual(texts.slice(2), [
		[{ type: "text", text: "old text" }],
		[{ type: "text", text: "new text" }],
		[{ type: "text", text: "old text" }],
	]);
});

test("partial reads stay as they are", () => {
	const partialArgs: Record<string, string | number>[] = [
		{ path: skillPath, limit: 10 },
		{ path: skillPath, offset: 2 },
	];
	for (const args of partialArgs) {
		assert.deepEqual(resultContent(refresh(readExchange(args))), [
			{ type: "text", text: "old text" },
		]);
	}
});

test("a truncated read stays as it is", () => {
	const messages = refresh(readExchange({ path: skillPath }, { truncated: true }));
	assert.deepEqual(resultContent(messages), [{ type: "text", text: "old text" }]);
});

test("a failed read stays as it is", () => {
	const messages = refresh(readExchange({ path: skillPath }, { isError: true }));
	assert.deepEqual(resultContent(messages), [{ type: "text", text: "old text" }]);
});

test("a read of a file that is not a skill stays as it is", () => {
	const messages = refresh(readExchange({ path: "/notes.md" }));
	assert.deepEqual(resultContent(messages), [{ type: "text", text: "old text" }]);
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
	assert.deepEqual(resultContent(messages), [
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
		assert.deepEqual(resultContent(refresh(readExchange({ path }), cwd)), [{ type: "text", text }]);
	}
});

function userMessage(content: string): Messages[number] {
	return { role: "user", content, timestamp: 0 };
}

function userParts(text: string): Messages[number] {
	return { role: "user", content: [{ type: "text", text }], timestamp: 0 };
}

function userContent(messages: Messages) {
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
	assert.equal(userContent(messages), `${freshBlock}\n\nmy arguments`);
});

test("a skill block in a text part gets the new body", () => {
	const messages = refresh([userParts(skillBlock("old body"))]);
	assert.deepEqual(userContent(messages), [{ type: "text", text: freshBlock }]);
});

test("a skill block of a deleted file keeps the wrapper with the notice", () => {
	const location = "/skills/gone/SKILL.md";
	const block = `<skill name="gone" location="${location}">\nReferences are relative to /skills/gone.\n\nold body\n</skill>\n\nargs`;
	assert.equal(
		userContent(refresh([userMessage(block)])),
		`<skill name="gone" location="${location}">\nReferences are relative to /skills/gone.\n\nThis skill file no longer exists.\n</skill>\n\nargs`,
	);
});

test("a user message with no block or a block that matches the disk keeps its object", () => {
	for (const message of [
		userMessage("hello"),
		userMessage(freshBlock),
		userParts("hello"),
		userParts(freshBlock),
	]) {
		assert.equal(refresh([message])[0], message);
	}
});

test("a read of a loaded skill file with another name gets the disk text", () => {
	const skills = [{ filePath: "/skills/flat.md", baseDir: "/skills" }];
	const messages = refresh(readExchange({ path: "/skills/flat.md" }), "/", skills);
	assert.deepEqual(resultContent(messages), [{ type: "text", text: "flat text" }]);
});

test("a skill block of a loaded skill uses the base folder of the skill", () => {
	const skills = [{ filePath: blockPath, baseDir: "/skills" }];
	const messages = refresh([userMessage(skillBlock("old body"))], "/", skills);
	assert.equal(
		userContent(messages),
		`<skill name="block" location="${blockPath}">\nReferences are relative to /skills.\n\nnew body\n</skill>`,
	);
});
