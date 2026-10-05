import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ContextEvent } from "@earendil-works/pi-coding-agent";

type Messages = ContextEvent["messages"];

export function refreshSkillContent(
	messages: Messages,
	cwd: string,
	isSkillFile: (path: string) => boolean,
	readFile: (path: string) => string | undefined,
): Messages {
	const fullReadPaths = findFullReadPaths(messages, cwd);
	return messages.map((message) => {
		if (message.role !== "toolResult" || message.toolName !== "read" || message.isError) {
			return message;
		}
		const path = fullReadPaths.get(message.toolCallId);
		if (path === undefined || isTruncated(message.details) || !isSkillFile(path)) return message;
		const text = readFile(path) ?? "This skill file no longer exists.";
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
