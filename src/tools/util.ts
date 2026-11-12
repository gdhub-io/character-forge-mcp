import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { nextHint } from "../next.js";

export const text = (t: string) => ({ type: "text" as const, text: t });

/**
 * A tool result. Some clients (Claude Code) show the model only structuredContent when it is present, so the
 * message travels in it too; otherwise instructions written for the model (role guides, build steps) never arrive.
 */
export const reply = (message: string, data: Record<string, unknown> = {}) => ({
	content: [text(message)],
	structuredContent: { ...data, message },
});

type Block = CallToolResult["content"][number];

const MIME: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".mp3": "audio/mpeg",
	".wav": "audio/wav",
	".mp4": "video/mp4",
	".md": "text/markdown",
	".txt": "text/plain",
	".json": "application/json",
};
/**
 * Inline up to these sizes, a link above. Images are read as pictures, so a full sheet is fine; sound and text are
 * read as text by many clients, so they stay small.
 */
const INLINE_LIMIT = { image: 4_000_000, audio: 1_000_000, text: 20_000 };

/** A saved file as something the chat app can show: images and sound inline, text as a document, video as a link. */
export async function fileContent(file: string): Promise<Block> {
	const mimeType =
		MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
	const uri = pathToFileURL(file).href;
	const { size } = await stat(file);
	const link = {
		type: "resource_link" as const,
		uri,
		name: path.basename(file),
		mimeType,
	};
	if (mimeType.startsWith("text/"))
		return size <= INLINE_LIMIT.text
			? {
					type: "resource",
					resource: { uri, mimeType, text: await readFile(file, "utf8") },
				}
			: link;
	const kind = mimeType.split("/")[0];
	if ((kind === "image" || kind === "audio") && size <= INLINE_LIMIT[kind])
		return {
			type: kind,
			mimeType,
			data: (await readFile(file)).toString("base64"),
		};
	return link;
}

/**
 * The result of a step that made something: the files go back into the chat, and the model is told to show them
 * and to offer a fix or a new take (`redo` says how, with this tool's own parameters).
 */
export async function shown(
	id: string,
	message: string,
	files: string[],
	redo: string,
	data: Record<string, unknown> = {},
): Promise<CallToolResult> {
	const r = reply(
		`${message}\n\nShow this to the user and ask whether they want changes or a new take. ${redo}${nextHint(id)}`,
		{ ...data, files },
	);
	return {
		...r,
		content: [...r.content, ...(await Promise.all(files.map(fileContent)))],
	};
}

/** Prompt sections as code blocks, one per field of the generator, so each copies with one click. */
export function copyable(sections: { label: string; text: string }[]): string {
	return sections
		.map(({ label, text }) => {
			const fence = text.includes("```") ? "~~~~" : "```";
			return `**${label}**\n${fence}text\n${text.trim()}\n${fence}`;
		})
		.join("\n\n");
}

/** How the model must pass a prompt on: verbatim, in its code blocks, ready to copy. */
export const SHOW_PROMPT =
	"Show the user every section below exactly as it is, each in its own code block, so they can copy it into the generator.";
