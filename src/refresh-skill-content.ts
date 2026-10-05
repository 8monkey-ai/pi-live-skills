import { homedir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import {
	type ContextEvent,
	parseSkillBlock,
	type Skill,
	stripFrontmatter,
} from "@earendil-works/pi-coding-agent";

type Messages = ContextEvent["messages"];
type Skills = readonly Pick<Skill, "filePath" | "baseDir">[];
type ReadFile = (path: string) => string | undefined;

const missingSkillText = "This skill file no longer exists.";

export function refreshSkillContent(
	messages: Messages,
	cwd: string,
	skills: Skills,
	readFile: ReadFile,
): Messages {
	const fullReadPaths = findFullReadPaths(messages, cwd);
	return messages.map((message) => {
		if (message.role === "user") return refreshSkillBlocks(message, skills, readFile);
		if (message.role !== "toolResult" || message.toolName !== "read" || message.isError) {
			return message;
		}
		const path = fullReadPaths.get(message.toolCallId);
		if (path === undefined || isTruncated(message.details) || !isSkillFile(path, skills)) {
			return message;
		}
		const text = readFile(path) ?? missingSkillText;
		const [part, ...rest] = message.content;
		if (part?.type === "text" && part.text === text && rest.length === 0) return message;
		return { ...message, content: [{ type: "text", text }] };
	});
}

function findFullReadPaths(messages: Messages, cwd: string) {
	const paths = new Map<string, string>();
	for (const message of messages) {
		if (message.role !== "assistant") continue;
		for (const block of message.content) {
			if (block.type !== "toolCall" || block.name !== "read") continue;
			const { path, offset, limit } = block.arguments;
			if (typeof path !== "string" || offset !== undefined || limit !== undefined) continue;
			const expanded = path.replace(/^@/, "").replace(/^~(?=\/|$)/, () => homedir());
			paths.set(block.id, resolve(cwd, expanded));
		}
	}
	return paths;
}

function isTruncated(details: unknown) {
	return typeof details === "object" && details !== null && "truncation" in details;
}

function isSkillFile(path: string, skills: Skills) {
	return basename(path) === "SKILL.md" || skills.some((skill) => skill.filePath === path);
}

function refreshSkillBlocks(
	message: Extract<Messages[number], { role: "user" }>,
	skills: Skills,
	readFile: ReadFile,
) {
	if (typeof message.content === "string") {
		const content = refreshSkillBlock(message.content, skills, readFile);
		return content === message.content ? message : { ...message, content };
	}
	const content = message.content.map((part) => {
		if (part.type !== "text") return part;
		const text = refreshSkillBlock(part.text, skills, readFile);
		return text === part.text ? part : { ...part, text };
	});
	const unchanged = content.every((part, index) => part === message.content[index]);
	return unchanged ? message : { ...message, content };
}

function refreshSkillBlock(text: string, skills: Skills, readFile: ReadFile) {
	const block = parseSkillBlock(text);
	if (!block) return text;
	const fileText = readFile(block.location);
	const body = fileText === undefined ? missingSkillText : stripFrontmatter(fileText).trim();
	const baseDir =
		skills.find((skill) => skill.filePath === block.location)?.baseDir ?? dirname(block.location);
	const wrapper = `<skill name="${block.name}" location="${block.location}">\nReferences are relative to ${baseDir}.\n\n${body}\n</skill>`;
	return block.userMessage ? `${wrapper}\n\n${block.userMessage}` : wrapper;
}
