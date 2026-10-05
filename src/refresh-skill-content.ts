import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
	type ContextEvent,
	parseSkillBlock,
	stripFrontmatter,
} from "@earendil-works/pi-coding-agent";

type Messages = ContextEvent["messages"];
type ReadFile = (path: string) => string | undefined;

const missingSkillText = "This skill file no longer exists.";

export function refreshSkillContent(
	messages: Messages,
	cwd: string,
	isSkillFile: (path: string) => boolean,
	readFile: ReadFile,
): Messages {
	const fullReadPaths = findFullReadPaths(messages, cwd);
	return messages.map((message) => {
		if (message.role === "user") return refreshSkillBlocks(message, readFile);
		if (message.role !== "toolResult" || message.toolName !== "read" || message.isError) {
			return message;
		}
		const path = fullReadPaths.get(message.toolCallId);
		if (path === undefined || isTruncated(message.details) || !isSkillFile(path)) return message;
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
			paths.set(block.id, resolveReadPath(path, cwd));
		}
	}
	return paths;
}

function resolveReadPath(path: string, cwd: string) {
	const withoutAt = path.startsWith("@") ? path.slice(1) : path;
	if (withoutAt === "~") return homedir();
	if (withoutAt.startsWith("~/")) return join(homedir(), withoutAt.slice(2));
	return resolve(cwd, withoutAt);
}

function isTruncated(details: unknown) {
	return typeof details === "object" && details !== null && "truncation" in details;
}

function refreshSkillBlocks(
	message: Extract<Messages[number], { role: "user" }>,
	readFile: ReadFile,
) {
	if (typeof message.content === "string") {
		const content = refreshSkillBlock(message.content, readFile);
		return content === message.content ? message : { ...message, content };
	}
	const content = message.content.map((part) => {
		if (part.type !== "text") return part;
		const text = refreshSkillBlock(part.text, readFile);
		return text === part.text ? part : { ...part, text };
	});
	const unchanged = content.every((part, index) => part === message.content[index]);
	return unchanged ? message : { ...message, content };
}

function refreshSkillBlock(text: string, readFile: ReadFile) {
	const block = parseSkillBlock(text);
	if (!block) return text;
	const fileText = readFile(block.location);
	const body = fileText === undefined ? missingSkillText : stripFrontmatter(fileText).trim();
	const wrapper = `<skill name="${block.name}" location="${block.location}">\nReferences are relative to ${dirname(block.location)}.\n\n${body}\n</skill>`;
	return block.userMessage ? `${wrapper}\n\n${block.userMessage}` : wrapper;
}
