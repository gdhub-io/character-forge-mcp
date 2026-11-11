import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { METHOD_GUIDE, referenceLists } from "../methodology.js";
import { TOURNAMENT_PROTOCOL } from "../tournament.js";
import { text } from "./util.js";

const CARD_FORMAT = `CARD FORMAT: character_save's input schema is the card: sections meta, core, goals, identification, psychology, description, fears, uniqueness, backstory, traits, destiny, visual — with every field and its minimum/exact counts. The VISUAL section feeds the T-pose concept: describe body, face, hair, outfit layers with materials, palette and silhouette concretely enough for a concept artist.`;

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
    async () => ({ content: [text([METHOD_GUIDE, CARD_FORMAT, TOURNAMENT_PROTOCOL, referenceLists()].join("\n\n"))] }),
  );
}
