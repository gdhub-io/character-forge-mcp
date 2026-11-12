import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MEDIA_KINDS, mediaBriefFor, saveMedia } from "../media.js";
import { loadCard } from "../store.js";
import { copyable, reply, SHOW_PROMPT } from "./util.js";

const KIND = z
	.enum(MEDIA_KINDS)
	.describe(
		"concept = A-pose sheet · illustration = key-art scene · voice = TTS voice design · video = image-to-video clip (Kling, Veo and similar) · song = Suno · theme = instrumental leitmotif (ElevenLabs Music composition plan)",
	);

export function registerMedia(server: McpServer) {
	server.registerTool(
		"character_prompt",
		{
			title: "Generation prompt brief (on request)",
			description:
				"ONLY when the user asks for a specific prompt. Returns the rules and card material for writing ONE generation prompt for a saved character — concept, illustration, voice, video, song or theme. Write it, then call character_prompt_save. Prompts only; no generator is called. Never run this as part of creating a character.",
			inputSchema: { id: z.string().describe("Character id."), kind: KIND },
			annotations: { readOnlyHint: true },
		},
		async ({ id, kind }) => reply(await mediaBriefFor(id, kind)),
	);

	server.registerTool(
		"character_prompt_save",
		{
			title: "Save a generation prompt",
			description:
				"Saves one written generation prompt into the character's prompts/ folder as <kind>.md (overwrites the previous one of that kind).",
			inputSchema: {
				id: z.string().describe("Character id."),
				kind: KIND,
				sections: z
					.array(
						z.object({ label: z.string().min(1), text: z.string().min(1) }),
					)
					.min(1)
					.describe("Named sections, as listed in the brief."),
			},
		},
		async ({ id, kind, sections }) => {
			const card = await loadCard(id);
			const file = await saveMedia(id, card.meta.name, { kind, sections });
			// Text in the message, not an attachment: the user copies it into another tool.
			return reply(
				`Saved ${kind} prompt: ${file}\n\n${SHOW_PROMPT} Then offer changes: revise it and call character_prompt_save again.\n\n${copyable(sections)}`,
				{ file },
			);
		},
	);
}
