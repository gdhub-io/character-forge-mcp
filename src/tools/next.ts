import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { nextSteps, nextToText } from "../next.js";
import { reply } from "./util.js";

export function registerNext(server: McpServer) {
	server.registerTool(
		"character_next",
		{
			title: "What can be made next",
			description:
				"Free. Use when the user asks what's next for a character: lists what is done and the next possible steps (concept → location → video → voice, music after the location, translations), with prices. Offer them; run paid ones only after a yes.",
			inputSchema: { id: z.string() },
			annotations: { readOnlyHint: true },
		},
		async ({ id }) => reply(nextToText(id), { ...nextSteps(id) }),
	);
}
