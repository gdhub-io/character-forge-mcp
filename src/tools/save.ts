import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CharacterCardSchema } from "../schema.js";
import { saveCard } from "../store.js";
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
        overwrite: z.boolean().optional().describe("Overwrite the character with the same id instead of creating name-2."),
      },
    },
    async ({ card, overwrite }) => {
      const saved = await saveCard(card, { overwrite });
      return reply(`Saved "${card.meta.name}" as id "${saved.slug}".\n${card.meta.logline}\nFiles:\n- ${saved.files.markdown}\n- ${saved.files.json}`, {
        id: saved.slug,
        dir: saved.dir,
        files: saved.files,
      });
    },
  );
}
