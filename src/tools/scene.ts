import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateIdleVideo, generateScene, VIDEO_FAMILIES } from "../scene.js";
import { shown } from "./util.js";

// Corrections for one take, in plain words, on top of the default prompt: no code change and no restart.
const NOTES = z
	.string()
	.optional()
	.describe(
		"Corrections for this take, in plain words (e.g. 'his height must read against the ceiling', 'hands stay off the barometer', 'no smoke'). They go first as binding rules and win over the default prompt. Use this to fix a result instead of rewriting the whole prompt.",
	);

export function registerScene(server: McpServer) {
	server.registerTool(
		"character_scene",
		{
			title: "Character in their environment (still)",
			description:
				"ONLY on request. Draws the character in their own place doing what they usually do (an idle moment), using concept.png as the character reference. Saves scene.png — the first and last frame for character_video. Write a specific prompt from the card (location, idle pose, light) or omit it for a default.",
			annotations: {
				openWorldHint: true,
				destructiveHint: false,
				idempotentHint: false,
			},
			inputSchema: {
				id: z.string(),
				prompt: z
					.string()
					.optional()
					.describe(
						"The scene: place, what they are doing, pose, light, framing. Keep the character exactly as in the reference.",
					),
				quality: z
					.enum(["low", "medium", "high"])
					.optional()
					.describe("Default medium."),
				notes: NOTES,
			},
		},
		async ({ id, prompt, notes, quality }) => {
			const r = await generateScene(id, { prompt, notes, quality });
			return shown(
				id,
				`Scene saved: ${r.file}`,
				[r.file],
				"For a fix, call character_scene again with notes saying what to change; for a different scene, a new prompt.",
				{ ...r },
			);
		},
	);

	server.registerTool(
		"character_video",
		{
			title: "Looping idle video",
			description:
				"ONLY on request, after character_scene. Animates scene.png into a looping idle clip (Kling O1 by default, silent; Kling 3.0 and Veo can add sound). See loop for how the clip is closed into a loop. Paid: tell the user the price from character_next and wait for a yes.",
			annotations: {
				openWorldHint: true,
				destructiveHint: false,
				idempotentHint: false,
			},
			inputSchema: {
				id: z.string(),
				prompt: z
					.string()
					.optional()
					.describe(
						"Small cyclical motions only: breathing, blinking, a habitual gesture, motion of things already in the scene (nothing new appears); the same person throughout (feelings may show, true to the scene's mood); static camera; returns to the start pose.",
					),
				notes: NOTES,
				seconds: z
					.number()
					.int()
					.min(3)
					.max(15)
					.optional()
					.describe(
						"Default 8: room for one characteristic gesture and a return to the first-frame pose. Kling O1 takes 3–10 (5 or 10 without the end frame), Kling 3.0 3–15, Veo 4, 6 or 8; other values are rounded into range.",
					),
				loop: z
					.enum(["frame", "crossfade", "off"])
					.optional()
					.describe(
						"frame (Kling default): last frame = first frame, but the background tends to freeze and the motion can jerk at the seam. crossfade (Veo default; Veo also keeps the first = last frame): the last second is blended into the first, picture and sound, so the seam never jerks. off: plain clip.",
					),
				audio: z
					.boolean()
					.optional()
					.describe(
						"Veo: default true (sound costs more). Kling 3.0: default false ($0.126/s with sound instead of $0.084). Kling O1 has no sound.",
					),
				model: z
					.enum(VIDEO_FAMILIES)
					.optional()
					.describe(
						"Default from models.json. kling: Kling O1 (no sound; 3–10 s) · kling3: Kling 3.0 (optional sound; 3–15 s; also told what must never appear) · veo: Veo 3.1 Fast (optional native sound; 4/6/8 s).",
					),
			},
		},
		async ({ id, prompt, notes, seconds, loop, audio, model }) => {
			const r = await generateIdleVideo(id, {
				prompt,
				notes,
				seconds,
				loop,
				audio,
				model,
			});
			return shown(
				id,
				`Video saved: ${r.file} (${r.seconds}s)`,
				[r.file],
				"For a fix or a new take, call character_video again with notes saying what to change.",
				{ ...r },
			);
		},
	);
}
