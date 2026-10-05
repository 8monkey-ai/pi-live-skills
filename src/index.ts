import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { refreshSkillContent } from "./refresh-skill-content.ts";

export default function (pi: ExtensionAPI) {
	pi.on("context", (event, ctx) => ({
		messages: refreshSkillContent(
			event.messages,
			ctx.cwd,
			(path) => basename(path) === "SKILL.md",
			readTextFile,
		),
	}));
}

function readTextFile(path: string) {
	return existsSync(path) ? readFileSync(path, "utf-8") : undefined;
}
