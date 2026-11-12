import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MEDIUMS } from "../methodology.js";
import { text } from "../tools/util.js";

const RUN =
	"Call character_method and run the variant tournament exactly as it describes. Then show me the winner's card, why it won, one line per losing variant, and the files.";

export function registerPrompts(server: McpServer) {
	server.registerPrompt(
		"random_character",
		{
			title: "Random character",
			description:
				"A random but strong, coherent character: 3 competing variants, the strongest wins and gets a A-pose concept.",
			argsSchema: {
				medium: z.string().optional().describe(MEDIUMS.join(", ")),
				genre: z.string().optional(),
				anchor: z
					.string()
					.optional()
					.describe("Role all variants share, e.g. fisherman"),
			},
		},
		({ medium, genre, anchor }) => ({
			messages: [
				{
					role: "user",
					content: text(
						`Create a random character with character-forge. ${anchor ? `Role: ${anchor}. ` : ""}${medium ? `Medium: ${medium}. ` : ""}${genre ? `Genre: ${genre}. ` : ""}\n${RUN}`,
					),
				},
			],
		}),
	);

	server.registerPrompt(
		"character_from_brief",
		{
			title: "Character from a brief",
			description:
				"A character from what matters to you; 3 variants that all honour the brief compete, the strongest wins.",
			argsSchema: {
				brief: z
					.string()
					.describe(
						"What matters about the character: role, project, look, anything.",
					),
			},
		},
		({ brief }) => ({
			messages: [
				{
					role: "user",
					content: text(
						`Create a character with character-forge from my brief (brief mode; meta.brief = my brief verbatim).\n${RUN}\n\nBRIEF:\n${brief}`,
					),
				},
			],
		}),
	);
}
