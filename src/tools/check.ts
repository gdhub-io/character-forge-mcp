import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { checkCard, checkToText } from "../check.js";
import { loadCard, validateCard } from "../store.js";
import { text } from "./util.js";

export function registerCheck(server: McpServer) {
  server.registerTool(
    "character_check",
    {
      title: "Check character coherence",
      description:
        "Checks a card for coherence: schema completeness, mechanical red flags (generic filler, repeats, want = need, thin core) and a coherence interview built from the card's own content that tests every causal link back to the core. Pass either a draft card (same shape as character_save's card) or the id of a saved one.",
      inputSchema: {
        // Loose on purpose: the full card schema is already published by character_save, and
        // validating here lets drafts get one readable list of every missing field.
        card: z.record(z.string(), z.unknown()).optional().describe("A complete draft card, same shape as character_save's card."),
        id: z.string().optional().describe("Or: id of a saved character."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ card, id }) => {
      let parsed;
      if (card) {
        const result = validateCard(card);
        if (!result.ok) return { isError: true, content: [text(`Card is incomplete:\n${result.issues}`)] };
        parsed = result.card;
      } else if (id) {
        parsed = await loadCard(id);
      } else {
        return { isError: true, content: [text("Pass either card or id.")] };
      }
      const r = checkCard(parsed);
      return { content: [text(checkToText(r))], structuredContent: { warnings: r.warnings, questions: r.questions } };
    },
  );
}
