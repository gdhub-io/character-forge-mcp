import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateTheme } from "../theme.js";
import { shown } from "./util.js";

export function registerTheme(server: McpServer) {
	server.registerTool(
		"character_theme",
		{
			title: "Background theme (music)",
			description:
				'ONLY on request, after a theme prompt is saved (character_prompt kind "theme" → character_prompt_save). Generates the instrumental leitmotif from its composition plan with ElevenLabs Music v2.5 and saves assets/theme.mp3. Paid: tell the user the price from character_next and wait for a yes.',
			annotations: {
				openWorldHint: true,
				destructiveHint: false,
				idempotentHint: false,
			},
			inputSchema: {
				id: z.string(),
				seed: z
					.number()
					.int()
					.optional()
					.describe("Same seed + same plan gives a similar result."),
			},
		},
		async ({ id, seed }) => {
			const r = await generateTheme(id, { seed });
			return shown(
				id,
				`Theme saved: ${r.file} (${r.seconds}s)`,
				[r.file],
				"For a new take, call character_theme again with another seed; for a different piece, revise the theme prompt (character_prompt kind theme → character_prompt_save) first.",
				{ ...r },
			);
		},
	);
}
