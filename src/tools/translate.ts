import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CharacterCardSchema } from "../schema.js";
import { saveTranslation } from "../store.js";
import { shown } from "./util.js";

export function registerTranslate(server: McpServer) {
	server.registerTool(
		"character_translate",
		{
			title: "Save a translation of the card",
			description:
				"When the user asked for other languages: saves the card translated (e.g. lang 'ru') as card.<lang>.json next to the English original, which stays the source. Translate every free-text field in the character's own voice, as the editor would write it in that language; keep the structure, list lengths, numbers, ids, enums and colours exactly.",
			inputSchema: {
				id: z.string(),
				lang: z
					.string()
					.regex(/^[a-z]{2}$/)
					.describe("Language code, e.g. 'ru'."),
				card: CharacterCardSchema,
			},
		},
		async ({ id, lang, card }) => {
			const file = await saveTranslation(id, lang, card);
			return shown(
				id,
				`Translation saved: ${file}`,
				[file],
				"For changes, fix the translated card and call character_translate again.",
				{ file },
			);
		},
	);
}
