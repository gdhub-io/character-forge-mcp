import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	addEvent,
	addTurn,
	attitudePaths,
	DEFAULT_ROUNDS,
	MEET_PROTOCOL,
	nextSpeaker,
	packetFor,
	type Scene,
	sceneDir,
	stance,
	startScene,
	TurnSchema,
} from "../meet.js";
import { SlugSchema } from "../schema.js";
import { fileContent, reply } from "./util.js";

/** The director's next step: who acts and their packet, or the finished scene. */
async function next(s: Scene, file: string) {
	const speaker = nextSpeaker(s);
	const data = { scene: s.id, round: s.round, folder: sceneDir(s.id) };
	if (!speaker) {
		const r = reply(
			`The scene has ended (${s.done}). Saved: ${file}\n\nFollow step 5 of the protocol: show scene.md, then retell it for the user in their language.`,
			{
				...data,
				done: s.done,
				attitudes: attitudePaths(s).map((p) => ({
					...p,
					ends: stance(p.path[p.path.length - 1].valence),
				})),
			},
		);
		return { ...r, content: [...r.content, await fileContent(file)] };
	}
	return reply(
		`Next: ${speaker} (round ${s.round}). Hand them this packet exactly as it is, nothing added:\n\n---\n${packetFor(s, speaker)}`,
		{ ...data, speaker },
	);
}

export function registerMeet(server: McpServer) {
	server.registerTool(
		"character_meet",
		{
			title: "Characters meet (experimental)",
			description:
				"Experimental. Puts 2-5 saved characters into one situation as strangers and starts a scene. Each round every character, in turn, thinks (feelings toward each other, what they want to say, hide or ask) and then speaks, acts or stays silent. Returns the director's protocol, the first speaker and their packet; record each turn with character_meet_turn.",
			inputSchema: {
				characters: z
					.array(SlugSchema)
					.min(2)
					.max(5)
					.describe("Ids of saved characters, in the order they enter."),
				situation: z
					.string()
					.trim()
					.min(1)
					.describe(
						"The user's situation, in English: a place, and any details they gave (time, roles, what is going on).",
					),
				max_rounds: z
					.number()
					.int()
					.min(1)
					.max(12)
					.default(DEFAULT_ROUNDS)
					.describe("When the scene stops at the latest."),
				tasks: z
					.array(
						z.object({
							character: SlugSchema,
							task: z
								.string()
								.trim()
								.min(1)
								.describe(
									"Why they are here right now and what they need, in English. Only this character learns it.",
								),
						}),
					)
					.default([])
					.describe(
						"One task per character: the user's, or written by you from the card's want to fit the situation.",
					),
				events: z
					.array(
						z.object({
							round: z.number().int().min(1),
							what: z
								.string()
								.trim()
								.min(1)
								.describe("What suddenly happens, in English."),
						}),
					)
					.default([])
					.describe(
						"Planned sudden changes everyone perceives, each at the start of its round.",
					),
			},
		},
		async (setup) => {
			const s = await startScene(setup);
			const first = await next(s, `${sceneDir(s.id)}/scene.md`);
			return {
				...first,
				content: [
					{ type: "text" as const, text: MEET_PROTOCOL },
					...first.content,
				],
			};
		},
	);

	server.registerTool(
		"character_meet_turn",
		{
			title: "Record a character's turn (experimental)",
			description:
				"Records one character's turn in a scene started by character_meet, exactly as the character returned it. Returns the next speaker and their packet, or the finished scene.",
			inputSchema: {
				scene: SlugSchema.describe("Scene id from character_meet."),
				speaker: SlugSchema.describe("Id of the character whose turn this is."),
				turn: TurnSchema,
			},
		},
		async ({ scene, speaker, turn }) => {
			const r = await addTurn(scene, speaker, turn);
			return next(r.scene, r.file);
		},
	);

	server.registerTool(
		"character_meet_event",
		{
			title: "Something suddenly happens (experimental)",
			description:
				"Adds a sudden change to a running scene (the cable snaps, a voice in the shaft, the door opens): everyone present perceives it before the next character acts. Use when the user asks for a twist mid-scene.",
			inputSchema: {
				scene: SlugSchema.describe("Scene id from character_meet."),
				what: z.string().trim().min(1).describe("What happens, in English."),
			},
		},
		async ({ scene, what }) => {
			const r = await addEvent(scene, what);
			return next(r.scene, r.file);
		},
	);
}
