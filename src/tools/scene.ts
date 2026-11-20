import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	generateIdleVideo,
	generateScene,
	LOOP_MODES,
	VIDEO_FAMILIES,
} from "../scene.js";
import { copyable, reply, shown } from "./util.js";

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
				"ONLY on request, after character_scene. Animates scene.png into a silent looping idle clip: Veo 3.1 Fast by default, one 8 s piece that ends on its first frame; Kling makes it from two pieces (see loop), billed as two clips. Before the first video of a scene, a vision model reads what moves in scene.png (about $0.004, kept until the scene is redrawn), unless motion is given. dry_run returns the exact prompt and the price without making the video. Paid: tell the user the price from character_next and wait for a yes.",
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
						"Replaces the default prompt. Name nothing that isn't in the scene, and nothing as a ban: the model draws whatever is named. Breathing, blinking, a habitual gesture; things in the scene move at a steady speed in whole cycles, never backward; the same person throughout; static camera.",
					),
				notes: NOTES,
				seconds: z
					.number()
					.int()
					.min(3)
					.max(15)
					.optional()
					.describe(
						"About how long the loop runs; default 10. A chain splits it into two pieces, each rounded into the model's range (Kling O1 3–10 s, 5 or 10 without an end frame; Kling 3.0 3–15; Veo 4, 6 or 8), so 10 is 5 + 5 s on Kling O1. dry_run shows the pieces and the price.",
					),
				loop: z
					.enum(LOOP_MODES)
					.optional()
					.describe(
						"frame (Veo default): one piece whose last frame = first frame; Veo keeps the character moving, Kling freezes everything. chain (Kling default): a free piece from scene.png, then a piece from its last frame back to scene.png, joined without the duplicated frames; two clips of about seconds/2 each, and the second can drift. crossfade: the last second is blended into the first; the seam shows. off: a plain clip. Default frame when start is given.",
					),
				motion: z
					.string()
					.optional()
					.describe(
						"What in scene.png moves and how, if you can see the picture: one short line per thing, only what is visible, each 'repeats' (turns, sways, flickers) or 'stays still' (could only change one way). Replaces the vision model's reading, free.",
					),
				start: z
					.string()
					.optional()
					.describe(
						"A first frame instead of scene.png, for one piece (loop frame, crossfade or off): a file name in the character's assets folder or an https URL. With loop frame the piece ends on scene.png.",
					),
				dry_run: z
					.boolean()
					.optional()
					.describe(
						"Return the exact prompt, the pieces and the price without making the video.",
					),
				model: z
					.enum(VIDEO_FAMILIES)
					.optional()
					.describe(
						"Default from models.json (veo). veo: Veo 3.1 Fast (4/6/8 s; prompt up to 20 000 characters) · kling: Kling O1 (3–10 s; prompt up to 2500) · kling3: Kling 3.0 (3–15 s; also told what must never appear). Veo and Kling 3.0 are also told what must never appear. All silent.",
					),
			},
		},
		async ({ id, dry_run, ...opts }) => {
			const r = await generateIdleVideo(id, { ...opts, dryRun: dry_run });
			const plan = `${r.pieces.map((p) => `${p.seconds} s`).join(" + ")}, about $${r.usd.toFixed(2)}`;
			if (!r.file)
				return reply(
					`Dry run: no video made. It would take ${plan}.${r.motionPending ? " What moves in the scene isn't read yet: the real run reads it first (included in the price), so the prompt below has the general line in its place." : ""}\n\n${copyable([{ label: "Prompt the real run sends", text: r.prompt }])}`,
					{ ...r },
				);
			return shown(
				id,
				`Video saved: ${r.file} (${r.seconds}s: ${plan})`,
				[r.file],
				"For a fix or a new take, call character_video again with notes saying what to change.",
				{ ...r },
			);
		},
	);
}
