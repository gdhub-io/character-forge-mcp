import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ROLE_GUIDES, RUBRIC } from "../tournament.js";
import { reply } from "./util.js";

const ROLES = Object.keys(ROLE_GUIDES) as [
	keyof typeof ROLE_GUIDES,
	...(keyof typeof ROLE_GUIDES)[],
];

export function registerRole(server: McpServer) {
	server.registerTool(
		"character_role",
		{
			title: "Tournament role instructions",
			description: `Returns the instructions and rubric for one role in the variant tournament (${ROLES.join(", ")}). Reviewers should call this first.`,
			inputSchema: { role: z.enum(ROLES) },
			annotations: { readOnlyHint: true },
		},
		async ({ role }) => reply(ROLE_GUIDES[role], { role, rubric: RUBRIC }),
	);
}
