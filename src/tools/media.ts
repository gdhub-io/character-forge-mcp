import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MEDIA_KINDS, mediaBrief, saveMedia } from "../media.js";
import { loadCard } from "../store.js";
import { text } from "./util.js";

const KIND = z
  .enum(MEDIA_KINDS)
  .describe("concept = T-pose sheet · illustration = key-art scene · voice = TTS voice design · video = Seedance-style clip · song = Suno");

export function registerMedia(server: McpServer) {
  server.registerTool(
    "character_prompt",
    {
      title: "Generation prompt brief (on request)",
      description:
        "ONLY when the user asks for a specific prompt. Returns the rules and card material for writing ONE generation prompt for a saved character — concept, illustration, voice, video or song. Write it, then call character_prompt_save. Prompts only; no generator is called. Never run this as part of creating a character.",
      inputSchema: { id: z.string().describe("Character id."), kind: KIND },
      annotations: { readOnlyHint: true },
    },
    async ({ id, kind }) => ({ content: [text(mediaBrief(await loadCard(id), kind))] }),
  );

  server.registerTool(
    "character_prompt_save",
    {
      title: "Save a generation prompt",
      description: "Saves one written generation prompt into the character's media/ folder as <kind>.md (overwrites the previous one of that kind).",
      inputSchema: {
        id: z.string().describe("Character id."),
        kind: KIND,
        sections: z.array(z.object({ label: z.string().min(1), text: z.string().min(1) })).min(1).describe("Named sections, as listed in the brief."),
      },
    },
    async ({ id, kind, sections }) => {
      const card = await loadCard(id);
      const file = await saveMedia(id, card.meta.name, { kind, sections });
      return { content: [text(`Saved ${kind} prompt: ${file}`)], structuredContent: { file } };
    },
  );
}
