import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { isUrl } from "../fal.js";
import { RollOptionsSchema, rollToText } from "../random.js";
import { reply } from "./util.js";

/** What the user started from decides how the author treats the roll. */
function modeNotes(brief: string | undefined, image: string | undefined): { mode: string; notes: string } {
  const keep = brief ? `\nTHE BRIEF (every variant keeps ALL of it; where it contradicts the roll, the brief wins):\n${brief}` : "";
  if (image) {
    return {
      mode: brief ? "concept + brief" : "concept",
      notes: `Look at the concept image first: ${image}
Write down what it fixes — species and build, apparent age, face, hair, outfit, worn items and their sides, palette, mood.
Those facts join the brief: every variant looks exactly like this, and its story explains what the picture shows
(a scar needs an origin, an odd item a reason). Never invent a look that contradicts the image.
In every variant set meta.mode = "brief", meta.brief = ${brief ? "the brief verbatim" : `"Concept image"`}, meta.concept_image = ${JSON.stringify(image)}.
character_pick makes this image the winner's concept: give the designer the image path too, and do not generate a concept.${keep}`,
    };
  }
  if (brief) return { mode: "brief", notes: `In every variant set meta.mode = "brief" and meta.brief = the brief verbatim.${keep}` };
  return { mode: "random", notes: `Nothing fixed beyond the anchor: meta.mode = "random".` };
}

export function registerCreate(server: McpServer) {
  server.registerTool(
    "character_create",
    {
      title: "Start a new character",
      description:
        "The one way to start a character, from whatever the user gave: nothing (random), a text brief, a concept image, or a concept image plus a brief. Rolls coherent ENGINES (wound → lie → fear → worst trait / best trait → truth → arc) plus surprising SPARKS — by default 3 competing variants of the same concept for the variant tournament — and says how to treat the brief and the image. Same seed = same roll.",
      inputSchema: {
        ...RollOptionsSchema.shape,
        variants: RollOptionsSchema.shape.variants.describe("How many competing variants. Default 3 (the tournament); 1 only when the user asks for one quick character."),
        brief: z.string().optional().describe("The user's description of the character, verbatim, if they gave one."),
        concept: z.string().optional().describe("Path or URL of the user's own concept image, if they gave one. It becomes the winner's concept instead of a generated one."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ brief, concept, variants = 3, ...opts }) => {
      let image = concept?.trim() || undefined;
      if (image && !isUrl(image)) {
        image = path.resolve(image);
        if (!existsSync(image)) throw new Error(`Concept image not found: ${image}`);
      }
      const { mode, notes } = modeNotes(brief?.trim() || undefined, image);
      const r = rollToText({ ...opts, variants });
      return reply(`MODE: ${mode}\n${notes}\n\n${r.text}`, { ...(r.data as unknown as Record<string, unknown>), mode, brief, concept: image });
    },
  );
}
