import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { keepWinner } from "../concept.js";
import { reply } from "./util.js";

export function registerPick(server: McpServer) {
  server.registerTool(
    "character_pick",
    {
      title: "Keep the tournament winner",
      description:
        "After the judge's verdict: moves the winning variant from the drafts into the library and deletes the other variants of its group (losers are not kept). If the character was started from the user's own concept image (meta.concept_image), it becomes the winner's concept. Write meta.verdict into the winner first.",
      inputSchema: { winner: z.string().describe("Id of the winning variant.") },
    },
    async ({ winner }) => {
      const r = await keepWinner(winner);
      const imported = r.concept ? `\nThe user's image is now the concept: ${r.concept} (do not generate one).` : "";
      return reply(`Kept ${r.winner} in the library; deleted ${r.deleted.join(", ") || "no other drafts"}.${imported}`, { ...r });
    },
  );
}
