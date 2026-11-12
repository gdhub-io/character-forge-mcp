import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	designVoice,
	OTHER_VOICE_LANGUAGES,
	speakLine,
	speakReference,
} from "../voice.js";
import { shown } from "./util.js";

/** Languages other than the English original. */

/** The voice description for another language: translated by meaning, falling back to the English one. */
const TRANSLATED_DESCRIPTION = z
	.string()
	.min(20)
	.max(1000)
	.optional()
	.describe(
		"The voice description in that language, translated by meaning. Defaults to the English one.",
	);

export function registerVoice(server: McpServer) {
	server.registerTool(
		"character_voice",
		{
			title: "Design the character's voice (on request, paid)",
			description:
				"ONLY on request; confirm the cost first. Creates the character's own voice from a description and an English reference script (write both with character_prompt kind 'voice'), plus any other languages listed in translations, each performed from the same description. Adults: ElevenLabs Voice Design, a saved voice and its reference take. Under 18: Qwen 3 Voice Design, deepened by pitch_semitones and cloned into a speaker embedding. Saves assets/voice/.",
			annotations: {
				openWorldHint: true,
				destructiveHint: false,
				idempotentHint: false,
			},
			inputSchema: {
				id: z.string(),
				description: z
					.string()
					.min(20)
					.max(1000)
					.describe(
						"Who they are and how they sound: history, how they talk and to whom, then age, gender, timbre, pace, recording.",
					),
				text: z
					.string()
					.min(100)
					.max(1000)
					.describe(
						"Reference script: their inner monologue in the moment the scene shows, thoughts to themselves, never addressed to the listener; natural voice, not a whisper. Eleven v3 tags like [sighs] are allowed; they are dropped for minors.",
					),
				pitch_semitones: z
					.number()
					.min(-6)
					.max(6)
					.optional()
					.describe(
						"Minors only: deepen (negative) or lighten the designed voice. Default -2.",
					),
				translations: z
					.array(
						z.object({
							lang: z.enum(OTHER_VOICE_LANGUAGES),
							text: z
								.string()
								.min(20)
								.max(1000)
								.describe(
									"The same monologue, written natively in that language for the same moment.",
								),
							description: TRANSLATED_DESCRIPTION,
						}),
					)
					.optional()
					.describe(
						"Other languages to record in the same call, each performed fresh from the description (not a copy of the English take) → voice/reference.<lang>.mp3.",
					),
			},
		},
		async ({
			id,
			description,
			text: script,
			pitch_semitones,
			translations,
		}) => {
			const r = await designVoice(id, {
				description,
				text: script,
				pitchSemitones: pitch_semitones,
				translations,
			});
			return shown(
				id,
				`Voice designed (${r.engine}):\n${r.files.join("\n")}`,
				r.files.filter((f) => f.endsWith(".mp3")),
				"For a different voice, call character_voice again with a revised description or script; to redo one language only, character_voice_translation.",
				{ ...r },
			);
		},
	);

	server.registerTool(
		"character_voice_translation",
		{
			title: "The voice monologue in another language (paid)",
			description:
				"ONLY on request, after character_voice: a new voice in another language, generated from the voice prompt translated by meaning (description + monologue), so the delivery follows the card → voice/reference.<lang>.mp3, which the site plays in that language. Same price as a line.",
			annotations: {
				openWorldHint: true,
				destructiveHint: false,
				idempotentHint: false,
			},
			inputSchema: {
				id: z.string(),
				lang: z.enum(OTHER_VOICE_LANGUAGES),
				text: z
					.string()
					.min(20)
					.max(1000)
					.describe(
						"The reference monologue translated, keeping its meaning, rhythm, pauses and the character's voice.",
					),
				description: TRANSLATED_DESCRIPTION,
			},
		},
		async ({ id, lang, text: line, description }) => {
			const file = await speakReference(id, line, lang, description);
			return shown(
				id,
				`Saved: ${file}`,
				[file],
				"For a fix, call character_voice_translation again with a revised text or description.",
				{ file },
			);
		},
	);

	server.registerTool(
		"character_voice_line",
		{
			title: "Speak one line in the character's voice (paid)",
			description:
				"ONLY on request, after character_voice; one line per call, confirm the cost (priced per character, see models.json). Saves assets/voice/lines/<name>.mp3.",
			annotations: {
				openWorldHint: true,
				destructiveHint: false,
				idempotentHint: false,
			},
			inputSchema: {
				id: z.string(),
				text: z
					.string()
					.min(1)
					.max(600)
					.describe(
						"The line. Adults: Eleven v3 delivery tags like [whispering], [nervous laugh]. Minors: shape delivery with punctuation (… — !).",
					),
				name: z.string().min(1).describe("File name, e.g. '01-to-the-radio'."),
			},
		},
		async ({ id, text: line, name }) => {
			const file = await speakLine(id, { text: line, name });
			return shown(
				id,
				`Line saved: ${file}`,
				[file],
				"For a fix, call character_voice_line again with the same name and a revised line (delivery tags or punctuation).",
				{ file },
			);
		},
	);
}
