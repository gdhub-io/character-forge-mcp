import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { costsToText, readCosts } from "../costs.js";
import { reply } from "./util.js";

export function registerCosts(server: McpServer) {
  server.registerTool(
    "character_costs",
    {
      title: "What a character has cost",
      description: "Free. Shows the character's paid generations (concept, scene, video, music, voice) with estimated USD from models.json pricing, and the total.",
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const ledger = await readCosts(id);
      return reply(costsToText(id, ledger), { ...ledger });
    },
  );
}
