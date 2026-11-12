import { existsSync } from "node:fs";
import { config } from "./config.js";
import { assetFile, isDraft, translationFile } from "./store.js";
import {
	OTHER_VOICE_LANGUAGES,
	PROFILE,
	referenceFile,
	VOICE_LANGUAGES,
} from "./voice.js";

/**
 * What can be made next for a character, following "How a character is made" (docs/reference.md): concept → location →
 * idle video → voice (spoken in the video's moment, every language); music after the location; translations any
 * time after the edit. Only steps whose inputs exist are offered; paid ones carry their price.
 */
export interface NextStep {
	step: string;
	tool: string;
	why: string;
	usd?: number;
}

/** A voice monologue runs about this long; voices are priced per 1000 characters. */
const TYPICAL_SCRIPT_CHARS = 300;
const VIDEO_SECONDS = 8;

export function nextSteps(id: string): { done: string[]; next: NextStep[] } {
	if (isDraft(id)) {
		return {
			done: ["card (tournament draft)"],
			next: [
				{
					step: "Finish the tournament",
					tool: "character_pick",
					why: "Judge the variants, then keep the winner; drafts get no media.",
				},
			],
		};
	}
	const has = (asset: string) => existsSync(assetFile(id, asset));
	const { pricing: p, models } = config();
	const voiceUsd = (TYPICAL_SCRIPT_CHARS / 1000) * p.voice.adult.per1000Chars;
	const langs = OTHER_VOICE_LANGUAGES.map((l) => ({
		l,
		name: VOICE_LANGUAGES[l],
	}));
	const done = ["card"];
	const next: NextStep[] = [];
	const offer = (s: NextStep) => next.push(s);

	if (!has("concept.png"))
		offer({
			step: "Concept (A-pose sheet)",
			tool: "character_concept",
			why: "Every visual step starts from it.",
			usd: p.concept.image,
		});
	else if ((done.push("concept"), !has("scene.png")))
		offer({
			step: "Location (the character in their own place)",
			tool: "character_scene",
			why: "Needed for the video and the music.",
			usd: p.scene.image,
		});
	else {
		done.push("location");
		if (!has("idle.mp4")) {
			offer({
				step: `Idle video (${VIDEO_SECONDS} s loop)`,
				tool: "character_video",
				why: "The voice comes after it.",
				usd: p.video[models.video.default].second * VIDEO_SECONDS,
			});
		} else if ((done.push("video"), !has(PROFILE))) {
			offer({
				step: `Voice (English${langs.length ? ` + ${langs.map((x) => x.name).join(", ")}` : ""})`,
				tool: "character_prompt kind voice → character_voice",
				why: "The monologue is spoken in the moment the video shows; each language is its own performance.",
				usd: voiceUsd * (1 + langs.length),
			});
		} else {
			done.push("voice");
			for (const { l, name } of langs)
				if (!has(referenceFile(l)))
					offer({
						step: `Voice in ${name}`,
						tool: "character_voice_translation",
						why: "The voice prompt translated by meaning, generated fresh.",
						usd: voiceUsd,
					});
		}
		if (!has("theme.mp3"))
			offer({
				step: "Theme music (≈30 s)",
				tool: "character_prompt kind theme → character_theme",
				why: "Needs only the location.",
				usd: p.music.startedMinute,
			});
		else done.push("music");
	}
	for (const { l, name } of langs)
		if (!existsSync(translationFile(id, l)))
			offer({
				step: `Card in ${name}`,
				tool: "translate-character skill → character_translate",
				why: "Free; the site shows it in that language.",
			});
	return { done, next };
}

const price = (n: NextStep) =>
	n.usd !== undefined ? ` (≈$${n.usd.toFixed(2)})` : "";

export function nextToText(id: string): string {
	const { done, next } = nextSteps(id);
	if (!next.length)
		return `${id}: everything is made (${done.join(", ")}). Nothing left in the pipeline.`;
	return [
		`${id}: done — ${done.join(", ")}.`,
		"You can make next:",
		...next.map(
			(n) => `- ${n.step}${price(n) || " (free)"} — ${n.tool}. ${n.why}`,
		),
	].join("\n");
}

/** One line to end a generation tool's reply with. */
export function nextHint(id: string): string {
	const { next } = nextSteps(id);
	return next.length
		? `\n\nNext: ${next.map((n) => n.step + price(n)).join(" · ")}`
		: "\n\nNext: everything is made.";
}
