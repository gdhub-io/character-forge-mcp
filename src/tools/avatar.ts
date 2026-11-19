import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeAvatar } from "../avatar.js";
import { conceptFileName } from "../concept.js";
import { shown } from "./util.js";

export function registerAvatar(server: McpServer) {
	server.registerTool(
		"character_avatar",
		{
			title: "Make the avatar from a concept sheet",
			description:
				"Free, no model call: crops the avatar (a square of the front view's head with the face in the centre, neck and shoulder tops around it; fits a circle) out of a saved concept sheet → avatar.png, or avatar-<style>.png for concept-<style>.png. character_concept already makes it; use this for sheets made before avatars existed, to remake one, or with box to fix a crop by hand. On a sheet forge drew, the head is found on the picture (method silhouette), or from the card's figure if it can't be (method skeleton). Imported concepts and pose sheets need a box.",
			annotations: {
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			},
			inputSchema: {
				id: z.string().describe("Character id returned by character_save."),
				style: z
					.string()
					.optional()
					.describe(
						"The sheet's style, as given to character_concept: omit for concept.png, 'card' or a style text for concept-<style>.png.",
					),
				pose: z
					.boolean()
					.optional()
					.describe(
						"The sheet made with pose_image (concept-pose.png); it needs a box.",
					),
				box: z
					.object({
						x: z.number(),
						y: z.number(),
						w: z.number().positive().max(1),
					})
					.optional()
					.describe(
						"Crop by hand: a square as fractions of the sheet, x and w of its width, y of its height. It may reach past the edges (filled with the background); its centre must be on the sheet.",
					),
			},
		},
		async ({ id, style, pose, box }) => {
			const a = await makeAvatar(id, conceptFileName(style, pose), { box });
			return shown(
				id,
				`Avatar (${a.method}): ${a.file}\nBox on the sheet: ${JSON.stringify(a.box)} (x and w of the width, y of the height; square).`,
				[a.file],
				"If the face isn't centred or the crop is too tight or loose, call character_avatar again with a corrected box.",
				{ ...a },
			);
		},
	);
}
