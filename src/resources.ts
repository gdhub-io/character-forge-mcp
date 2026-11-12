import {
	type McpServer,
	ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { cardMarkdown, listCards, loadCard, type StoredCard } from "./store.js";

/** Every saved card is a Markdown document the chat app can show, open or attach. */
export const cardUri = (id: string) => `character-forge://${id}/card.md`;

export async function cardDocument(card: StoredCard) {
	return {
		uri: cardUri(card.meta.slug),
		mimeType: "text/markdown",
		text: await cardMarkdown(card),
	};
}

export function registerResources(server: McpServer) {
	server.registerResource(
		"character-card",
		new ResourceTemplate("character-forge://{id}/card.md", {
			// The library only: tournament drafts aren't characters yet.
			list: async () => ({
				resources: (await listCards()).map((c) => ({
					uri: cardUri(c.slug),
					name: c.name,
					description: c.logline,
					mimeType: "text/markdown",
				})),
			}),
		}),
		{
			title: "Character card",
			description: "A saved character's card, as Markdown.",
			mimeType: "text/markdown",
		},
		async (_uri, { id }) => ({
			contents: [await cardDocument(await loadCard(String(id)))],
		}),
	);
}
