import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateTheme } from "../theme.js";
import { nextHint } from "../next.js";
import { reply } from "./util.js";

export function registerTheme(server: McpServer) {
  server.registerTool(
    "character_theme",
    {
      title: "Background theme (music)",
      description:
        "ONLY on request, after a theme prompt is saved (character_prompt kind \"theme\" → character_prompt_save). Generates the instrumental leitmotif from its composition plan with ElevenLabs Music v2.5 ($0.60 per started minute: a 30 s theme costs $0.60) and saves assets/theme.mp3. Confirm the cost with the user first.",
      inputSchema: {
        id: z.string(),
        seed: z.number().int().optional().describe("Same seed + same plan gives a similar result."),
      },
    },
    async ({ id, seed }) => {
      const r = await generateTheme(id, { seed });
      return reply(`Theme saved: ${r.file} (${r.seconds}s)${nextHint(id)}`, { ...r });
    },
  );
}
