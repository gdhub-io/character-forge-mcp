import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { generateConcept, VIEWS } from "../concept.js";
import { nextHint } from "../next.js";
import { reply, text } from "./util.js";

export function registerConcept(server: McpServer) {
	server.registerTool(
		"character_concept",
		{
			title: "Generate T-pose concept sheet",
			description:
				"Builds an A-pose model-sheet prompt from a saved card's look and, with FAL_KEY set, generates it on fal.ai: a faceless figure built from look.body (the character's own proportions) is drawn front and back and given to GPT Image as the pose reference, with the full look → concept.png (the card is re-rendered with it). pose_image puts the character in the pose of any picture → concept-pose.png. Without FAL_KEY (or with dry_run) returns the prompt only. Costs ≈ $0.02 per sheet.",
			inputSchema: {
				id: z.string().describe("Character id returned by character_save."),
				style: z
					.string()
					.optional()
					.describe(
						"Omit for the house style (one look across the library). 'card' = the designer's suggestion in look.art_style; or any style text, e.g. 'anime cel-shaded'. Non-default styles are saved as concept-<style>.png next to concept.png.",
					),
				views: z
					.enum(VIEWS)
					.optional()
					.describe("Views on the sheet. Default front-back."),
				extra: z
					.string()
					.optional()
					.describe("Extra art direction appended to the prompt."),
				dry_run: z
					.boolean()
					.optional()
					.describe("Only return the prompt, do not call the image API."),
				pose_image: z
					.string()
					.optional()
					.describe(
						"Path, URL or data URI of a picture whose pose the character should take (e.g. their idle pose or signature gesture).",
					),
				seed: z
					.number()
					.int()
					.optional()
					.describe("Seed, to reproduce or vary a result."),
				mode: z
					.enum(["img2img", "gpt", "gpt2", "pose", "depth", "canny"])
					.optional()
					.describe(
						"How the figure steers the image. gpt (default, GPT Image edit ≈ $0.02): the figure is a pose reference. img2img (Z-Image ≈ $0.01): it is the starting canvas; greys colours. pose/depth/canny: ControlNet conditions (weak on this endpoint). Kept for experiments; leave unset.",
					),
				figure: z
					.enum([
						"shaded",
						"flat",
						"mask",
						"blocking",
						"blocking-lit",
						"skeleton",
					])
					.optional()
					.describe(
						"The mannequin: blocking-lit (default with look.blocking: zone colours with volume), blocking (flat 2D colour patches), shaded (grey 3D), flat, mask.",
					),
				strength: z
					.number()
					.min(0)
					.max(1)
					.optional()
					.describe(
						"img2img: how much to repaint the mannequin (default 0.85 ≈ 7 of 8 steps; lower keeps the pose harder but greys the colours, higher frees colours but loses the pose).",
					),
				control_scale: z
					.number()
					.min(0)
					.max(1)
					.optional()
					.describe(
						"ControlNet modes: how strictly to follow the condition (default 0.75).",
					),
			},
		},
		async ({
			id,
			dry_run,
			pose_image,
			control_scale,
			mode,
			...opts
		}): Promise<CallToolResult> => {
			const r = await generateConcept(id, {
				...opts,
				control: mode,
				poseImage: pose_image,
				controlScale: control_scale,
				dryRun: dry_run,
			});
			if (!r.generated) {
				return reply(
					`${r.reason} T-pose prompt — paste into any image model:\n\n${r.prompt}`,
					{ prompt: r.prompt, generated: false },
				);
			}
			const { image } = r;
			const content: CallToolResult["content"] = [
				text(
					`Concept generated with ${image.provider}/${image.model}${image.seed !== undefined ? ` (seed ${image.seed})` : ""}.\n- ${r.file}\n- ${r.card}${nextHint(id)}`,
				),
			];
			// Shown inline so the user sees the concept in chat; skipped for very large files.
			if (image.bytes.length < 4_000_000)
				content.push({
					type: "image",
					data: image.bytes.toString("base64"),
					mimeType: image.mimeType,
				});
			return {
				content,
				structuredContent: {
					message: content[0].type === "text" ? content[0].text : "",
					prompt: r.prompt,
					generated: true,
					file: r.file,
					provider: image.provider,
					model: image.model,
					seed: image.seed,
				},
			};
		},
	);
}
