import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { METHOD_GUIDE, referenceLists } from "../methodology.js";
import { TOURNAMENT_PROTOCOL } from "../tournament.js";
import { text } from "./util.js";

const CARD_FORMAT = `CARD FORMAT: character_save's input schema is the card: sections meta, core, goals, identification, psychology, description, fears, uniqueness, backstory, traits, destiny, look — with every field and its minimum/exact counts. description.physical holds only body, face and hair; LOOK (written by the designer from the finished story) holds everything visual else: shape language, silhouette, the body's proportions, colour blocking, signature item, marks with origins, movement, outfit with reasons, palette with meanings and what reads in three seconds. Every visual output (the A-pose concept, scenes, prompts) is built from it.`;

export function registerMethod(server: McpServer) {
	server.registerTool(
		"character_method",
		{
			title: "Character method",
			description:
				"Returns the character-development method (core + 9 sections), the card format, the variant-tournament protocol and the reference lists (arcs, flaws, fears, traits, archetypes, uniqueness questions). Call once before writing a character.",
			inputSchema: {},
			annotations: { readOnlyHint: true },
		},
		async () => ({
			content: [
				text(
					[
						METHOD_GUIDE,
						CARD_FORMAT,
						TOURNAMENT_PROTOCOL,
						referenceLists(),
					].join("\n\n"),
				),
			],
		}),
	);
}
