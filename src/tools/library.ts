import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { cardDocument } from "../resources.js";
import {
	characterDir,
	listCards,
	listToText,
	loadCard,
	outputDir,
} from "../store.js";
import { reply, text } from "./util.js";

export function registerLibrary(server: McpServer) {
	server.registerTool(
		"character_list",
		{
			title: "List saved characters",
			description:
				"Lists saved characters (newest first), with variant group and tournament verdict when present.",
			inputSchema: {
				group: z
					.string()
					.optional()
					.describe("Only show variants of this group."),
			},
			annotations: { readOnlyHint: true },
		},
		async ({ group }) => {
			const items = (await listCards()).filter(
				(i) => !group || i.group === group,
			);
			return reply(listToText(items), {
				dir: outputDir(),
				items: items.map((i) => ({ ...i, updated: i.updated.toISOString() })),
			});
		},
	);

	server.registerTool(
		"character_get",
		{
			title: "Get a saved character",
			description:
				"Returns a saved character card as a Markdown document to show the user (do so when a character is finished), or as JSON to edit and re-save with overwrite.",
			inputSchema: {
				id: z.string().describe("Character id."),
				format: z
					.enum(["markdown", "json"])
					.optional()
					.describe("Default markdown."),
			},
			annotations: { readOnlyHint: true },
		},
		async ({ id, format = "markdown" }) => {
			const card = await loadCard(id);
			if (format === "json")
				return { content: [text(JSON.stringify(card, null, 2))] };
			// A document, so apps that render documents show the card; others read the same Markdown as text.
			return {
				content: [
					text(`Card of ${card.meta.name} (files in ${characterDir(id)}):`),
					{ type: "resource" as const, resource: await cardDocument(card) },
				],
			};
		},
	);
}
