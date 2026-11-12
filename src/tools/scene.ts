import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateIdleVideo, generateScene, VIDEO_FAMILIES } from "../scene.js";
import { nextHint } from "../next.js";
import { reply } from "./util.js";

// Corrections for one take, in plain words, on top of the default prompt: no code change and no restart.
const NOTES = z
  .string()
  .optional()
  .describe("Corrections on top of the default prompt for this take, in plain words (e.g. 'his height must read against the ceiling', 'hands stay off the barometer'). Use this to fix a result instead of rewriting the whole prompt.");

export function registerScene(server: McpServer) {
  server.registerTool(
    "character_scene",
    {
      title: "Character in their environment (still)",
      description:
        "ONLY on request. Draws the character in their own place doing what they usually do (an idle moment), using concept.png as the character reference (GPT Image 2.6 edit, ≈$0.05 at medium). Saves scene.png — the first and last frame for character_video. Write a specific prompt from the card (location, idle pose, light) or omit it for a default.",
      inputSchema: {
        id: z.string(),
        prompt: z.string().optional().describe("The scene: place, what they are doing, pose, light, framing. Keep the character exactly as in the reference."),
        quality: z.enum(["low", "medium", "high"]).optional().describe("Default medium."),
        notes: NOTES,
      },
    },
    async ({ id, prompt, notes, quality }) => {
      const r = await generateScene(id, { prompt, notes, quality });
      return reply(`Scene saved: ${r.file}${nextHint(id)}`, { ...r });
    },
  );

  server.registerTool(
    "character_video",
    {
      title: "Looping idle video",
      description:
        "ONLY on request, after character_scene. Animates scene.png into a looping idle clip (default Kling O1 Standard ≈ $0.084/s, silent; veo ≈ $0.15/s with sound). See loop for how the clip is closed into a loop. Confirm the cost with the user first.",
      inputSchema: {
        id: z.string(),
        prompt: z.string().optional().describe("Small cyclical motions only: breathing, blinking, a habitual gesture, ambient motion; static camera; returns to the start pose."),
        notes: NOTES,
        seconds: z.number().int().min(4).max(30).optional().describe("Default 8: room for one characteristic gesture and a return to the first-frame pose."),
        loop: z.enum(["frame", "crossfade", "off"]).optional().describe("frame (Kling default): last frame = first frame, but the background tends to freeze and the motion can jerk at the seam. crossfade (Veo default; Veo also keeps the first = last frame): the last second is blended into the first, picture and sound, so the seam never jerks. off: plain clip."),
        audio: z.boolean().optional().describe("Veo only: default true ($0.15/s; $0.10/s without). Kling has no sound."),
        model: z.enum(VIDEO_FAMILIES).optional().describe("Default from models.json. kling (Kling O1 Standard ≈$0.084/s, no sound) · veo (Veo 3.1 Fast 720p, native sound $0.15/s or silent $0.10/s, 4/6/8 s)."),
      },
    },
    async ({ id, prompt, notes, seconds, loop, audio, model }) => {
      const r = await generateIdleVideo(id, { prompt, notes, seconds, loop, audio, model });
      return reply(`Video saved: ${r.file} (${r.seconds}s)${nextHint(id)}`, { ...r });
    },
  );
}
