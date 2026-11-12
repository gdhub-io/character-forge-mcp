import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { cardUri } from "../resources.js";
import { CharacterCardSchema } from "../schema.js";
import { isDraft, saveCard } from "../store.js";
import { reply } from "./util.js";

export function registerSave(server: McpServer) {
	server.registerTool(
		"character_save",
		{
			title: "Validate and save character card",
			description:
				"Validates a complete character card and saves it as card.json and card.md. Returns the id and file paths (use character_get to show the card). Use overwrite: true with meta.slug = id to update a saved card.",
			inputSchema: {
				card: CharacterCardSchema.describe("The complete character card."),
				overwrite: z
					.boolean()
					.optional()
					.describe(
						"Overwrite the character with the same id instead of creating name-2.",
					),
			},
		},
		async ({ card, overwrite }) => {
			const saved = await saveCard(card, { overwrite });
			const message = `Saved "${card.meta.name}" as id "${saved.slug}".\n${card.meta.logline}\nFiles:\n- ${saved.files.markdown}\n- ${saved.files.json}`;
			const data = { id: saved.slug, dir: saved.dir, files: saved.files };
			if (isDraft(saved.slug)) return reply(message, data);
			// A library card: link the document so the app can open it; character_get shows it in full.
			const result = reply(
				`${message}\nWhen the character is finished, show the card with character_get.`,
				{ ...data, card: cardUri(saved.slug) },
			);
			return {
				...result,
				content: [
					...result.content,
					{
						type: "resource_link" as const,
						uri: cardUri(saved.slug),
						name: `${card.meta.name} — card`,
						mimeType: "text/markdown",
					},
				],
			};
		},
	);
}
