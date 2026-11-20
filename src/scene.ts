import { readFile, rm, writeFile } from "node:fs/promises";
import { clip, houseStyle, pronoun } from "./concept.js";
import { apiKey, config } from "./config.js";
import { recordCost, videoUsd } from "./costs.js";
import { falQueue, falQueueJson, falUpload, isUrl } from "./fal.js";
import { eachFrame, run, transform, transformMany } from "./ffmpeg.js";
import type { CharacterCard } from "./schema.js";
import {
	assetFile,
	loadCard,
	promptFile,
	saveAsset,
	savePrompt,
} from "./store.js";
import { assertPublicUrl, readUserImage } from "./userimage.js";

/**
 * A living portrait: the character in their own place, doing what they usually do (an "idle" moment),
 * first as a still (GPT Image edit, using concept.png as the character reference), then as a looping
 * idle clip built from that same still (Kling or Veo).
 */

/**
 * Idle videos are silent: the voice and music are made on their own. Video families (endpoints in models.json; Veo is the default):
 * Kling O1 Standard (≈$0.084/s, first+last frame, 3–10 s),
 * Kling 3.0 Standard (first+last frame, 3–15 s, $0.084/s, takes a negative prompt) and
 * Veo 3.1 Fast (720p, $0.10/s silent; 4, 6 or 8 s). Seedance was dropped: its partner moderation
 * rejects any realistic face it didn't generate itself, which is every scene we make; 2.0 also costs ~3× more.
 */
export const VIDEO_FAMILIES = ["kling", "kling3", "veo"] as const;
export type VideoModel = (typeof VIDEO_FAMILIES)[number];

/** Everything the scene needs comes from the card: place, idle pose, habit, look, worn items and their sides. */
export function defaultScenePrompt(c: CharacterCard): string {
	const lk = c.look;
	const d = c.description;
	const own = (where: string) => where.replace("_", " ");
	const worn = (lk.blocking?.accessories ?? [])
		.filter((a) => a.item)
		.map((a) => `${a.item} on the ${own(a.where)}`);
	// Marks that only exist at a story moment ("Wave-night state only") don't belong in the everyday idle scene.
	// ("LEFT shin only" is a side, not a moment, so only "<moment> only" / "only during …" counts.)
	const marks = lk.marks.filter(
		(m) =>
			!/\b(state|night|scene|moment) only\b|\bonly (during|at|on|in|when)\b/i.test(
				m.location,
			),
	);
	return [
		`A cinematic still of ${c.meta.name} (${d.age}, ${d.gender.toLowerCase()}) — the character from the reference sheet — in their own place: ${c.backstory.key_locations[0]}.`,
		`An ordinary idle moment: ${lk.movement.idle_pose} Doing what they usually do: ${c.backstory.daily_life}`,
		// The idle text mentions occasional habits ("every hour she taps it"); drawn literally they invent props and
		// hand contact (Marta's second take grew a wall barometer under her hand). Show the plain pose only.
		"Show only the plain idle pose itself: the occasional habits and gestures mentioned above are character notes, not to be drawn; no extra objects are added for them, and the hands rest on the character's own body or clothing.",
		`Same face, hair, outfit (${lk.outfit.map((o) => o.piece).join("; ")}) and marks (${marks.map((m) => `${m.mark}, ${m.location}`).join("; ")}) as in the reference.`,
		// A body far from average (Pike: 2.35 m at ten) vanishes in a scene with nothing to measure it against.
		`Scale: ${d.physical.height_build.split(/[.;:]/)[0]}. Show it against the place: doorways, ceilings, railings and everyday objects at their normal size around the character.`,
		worn.length
			? `Worn items, on the character's own sides: ${worn.join("; ")}.`
			: "",
		// GPT hung Marta's rope coil over her crossed arms, so the forearm sank into it — and the video inherited it.
		"Physical sense: every worn item hangs freely and clear of the arms and hands (a coil on a shoulder hangs behind or beside the arm, never over the chest where the arms rest); nothing passes through a limb or the body.",
		`Signature item visible: ${lk.signature_item.item.replace(/\.$/, "")}.`,
		"Restraint: show the character's craft or obsession through one or two details, not by filling the frame with it; the place is lived-in and ordinary, full of things that have nothing to do with their main motif.",
		"Composition for a full-screen website background: 16:9 wide shot, the character placed in the RIGHT third of the frame, whole figure visible and small enough to leave air around it: the figure takes about 60% of the frame height, with clear empty space above the head (about a fifth of the frame, the ceiling or sky visible) and below the feet (about a tenth, the floor or ground visible); the head and the feet never touch the top or bottom edge, where page headers and bars will sit. The LEFT 60% is a calm continuation of the same place — low detail, soft focus, no bright spots, no large or glowing objects (no big lenses, lit lanterns or lamps), no faces or text — where menus and info cards will sit.",
		`Static camera at eye level. Light motivated by the place itself. Style: ${houseStyle().replace(/,\s*soft studio light/i, "")}. One single image, no text.`,
	]
		.filter(Boolean)
		.join("\n");
}

/**
 * Motion for a seamless idle loop. It names nothing in the place, in either direction: Kling drew every thing a
 * prompt named, as motion ("a flame there flickers") or as a ban ("no smoke"), so Marenka's clips grew smoke and
 * burning streaks. What moves comes from the first frame itself (`motion`, see sceneMotion); the rest are rules
 * that hold for any place.
 */
export function defaultLoopPrompt(
	c: CharacterCard,
	loop: LoopMode = "chain",
	model: VideoModel = "veo",
	motion?: string,
): string {
	const mv = c.look.movement;
	const his = pronoun(c.description.gender);
	return [
		{
			chain:
				"One piece of a seamless idle loop, static locked-off camera, no cuts. Given an end frame, it arrives there by carrying motion forward, never by undoing it.",
			frame:
				"Seamless idle loop, static locked-off camera, no cuts. The clip starts and ends on the exact first frame.",
			crossfade: "Idle loop, static locked-off camera, no cuts.",
			off: "Calm idle moment, static locked-off camera, no cuts.",
		}[loop],
		"The character stays in the right third at the same size, with the same space above the head and below the feet, and never walks.",
		"The first frame shows everything there is: nothing is added at any moment, nothing turns into something else.",
		"The place lives for the whole clip, not only the character, never frozen; large things stay still, only small things move.",
		// Marenka's first piece dimmed at its end; the second started dark, stayed 35% darker and jumped back to the
		// bright scene at the seam.
		"The light stays exactly as in the first frame for the whole clip: the same brightness and colours, never dimming or brightening. Only the lights the first frame shows give light, and they stay lit; no new light appears.",
		motion?.trim()
			? `What moves, as seen in the first frame (nothing else moves): ${motion.trim().replace(/[.;]*$/, ".")}`
			: "Whatever in the first frame naturally moves keeps moving the way it naturally does.",
		// Measured on Marenka (#50): a lens that spun up at frame 1 and slowed at the seam jerked even after a full turn;
		// a second piece that undid a turn to reach the end frame read as reversed.
		"Every motion already runs at full, even speed in the first frame and keeps it to the last: nothing starts up, slows down or stops.",
		"Anything that turns or travels goes one way at a constant speed and makes whole cycles, ending where it began; anything that can't stays still. Nothing moves backward.",
		// Marenka, a sad elderly robot keeper, turned younger and cheerful mid-clip: the person must stay, feelings may move.
		"The same person throughout: same face, age, body and outfit. Feelings may show in the character's own way, true to the first frame's mood, back to the first-frame expression by the end.",
		// Veo turned Marenka's metal robot hands into human hands mid-clip and back: say what the body is made of.
		natureHeld(c, model),
		postureHeld(c.look.body, his),
		`The character breathes, blinks and shifts weight slightly, in the spirit of ${his} idle habit (${mv.idle_pose})`,
		`Once in the middle, one small, clear beat of the head, shoulders or an arm, then back to the first-frame pose. ${his[0].toUpperCase() + his.slice(1)} hands stay away from ${his} face and touch nothing new.`,
		// Video moderation has rejected stylized characters as "likenesses of real people"; say it plainly.
		"The character is entirely fictional, an original stylized game character; any resemblance to a real person is coincidental.",
	]
		.filter(Boolean)
		.join(" ");
}

/**
 * Only what repeats goes into the prompt. A thing named even as "stays still" gets drawn: Marenka's reading said
 * "clouds drift outside, stays still", and Kling rolled clouds of smoke across her floor.
 */
export const movingOnly = (reading: string) =>
	/^\W*nothing\b/i.test(reading)
		? undefined
		: reading
				.split(";")
				.map((l) => l.trim())
				.filter((l) => l && !/stays? still\W*$/i.test(l))
				.map((l) => l.replace(/[,;\s]*repeats\W*$/i, ""))
				.join("; ") || undefined;

/**
 * What the character is and what their body is made of, from the DNA: it holds in every part, hands included. Veo
 * takes a long prompt, so it also gets the face, whole; Kling's 2500 characters keep it short.
 */
function natureHeld(c: CharacterCard, model: VideoModel): string {
	const d = c.core.dna;
	if (!d?.species) return "";
	const what = [d.species, d.covering, model === "veo" ? d.face : undefined]
		.filter((x): x is string => Boolean(x))
		.map((x) => x.replace(/[.;]+$/, ""))
		.join("; ");
	return `The same nature in every part of the body, hands and face included: ${model === "veo" ? what : clip(what, 170)}.`;
}

/**
 * The card's posture as the body's own shape, kept through every move (standing, sitting, lying or floating, the
 * character still moves). Marenka's head is canted toward her good ear on the concept and the scene, and Kling
 * straightened it within seconds: the video prompt never said it was hers.
 */
function postureHeld(b: CharacterCard["look"]["body"], his: string): string {
	const parts = postureParts(b, his);
	return parts.length
		? `${his[0].toUpperCase() + his.slice(1)} body keeps its own shape through every move: ${parts.join(", ")}; however ${his} head and arms move, this never straightens.`
		: "";
}

/**
 * The idle prompt for Veo, written the way Google's Veo guides ask for image-to-video: describe the motion only (the
 * frame already gives the subject, place, light and style), call the character "the subject", one focused moment,
 * a static shot, positive wording ("no" and "never" are not recommended: unwanted things go to the negative prompt
 * as plain nouns, see videoNegative), and no sound sentences for a silent clip. It names nothing in the place but
 * what the scene reading found moving. Built from any card; tested on a blanked one.
 */
export function veoLoopPrompt(
	c: CharacterCard,
	loop: LoopMode = "frame",
	motion?: string,
): string {
	const he = subjectPronoun(c.description.gender);
	const his = pronoun(c.description.gender);
	const shape = postureParts(c.look.body, his);
	const d = c.core.dna;
	const nature = [d?.species, d?.covering, d?.face]
		.filter((x): x is string => Boolean(x))
		.map((x) => x.replace(/[.;]+$/, ""))
		.join("; ");
	return [
		"Static shot: the camera remains completely still for the whole clip.",
		{
			frame:
				"A calm idle moment that begins and ends on this same frame, so it plays as a seamless loop.",
			chain:
				"One part of a calm, continuous idle loop; every motion carries forward from where it is.",
			crossfade: "A calm idle moment.",
			off: "A calm idle moment.",
		}[loop],
		`The subject keeps the pose of the frame${shape.length ? `, ${shape.join(", ")},` : ""} and breathes slowly and blinks. Once, in the middle, ${he} makes one small gesture in the spirit of ${his} habit (${c.look.movement.idle_pose.replace(/[.\s]+$/, "")}), then settles back into the same pose, with the same expression ${he} has now.`,
		motion?.trim()
			? `Around the subject, only this moves, gently and evenly from the first moment to the last: ${motion.trim().replace(/[.;]*$/, ".")} Everything else in the place stays still, in the same steady light.`
			: "Everything in the place stays still, in the same steady light.",
		nature
			? `The subject stays exactly what ${he} is in the frame, in every part of the body, hands and face included: ${nature}.`
			: "",
		// Video moderation has rejected stylized characters as "likenesses of real people"; say it plainly.
		"The subject is entirely fictional, an original stylized game character.",
	]
		.filter(Boolean)
		.join(" ");
}

const subjectPronoun = (gender: string) => {
	const p = pronoun(gender);
	return p === "her" ? "she" : p === "his" ? "he" : "they";
};

/**
 * Things a model adds to an idle clip on its own, each with what in a scene means it is already there: a scene that
 * holds one keeps it (a lantern keeps its fire).
 */
const ADDED_THINGS: [string, RegExp][] = [
	["smoke", /smok|chimney|incense|pipe|cigar/],
	["fog", /fog|haze/],
	["mist", /mist|spray|waterfall/],
	["steam", /steam|kettle|bath|spring/],
	["fire", /fire|flame|candle|lantern|lamp|torch|hearth|forge|campfire|ember/],
	["sparks", /spark|forge|weld|ember|fire/],
	["dust", /dust|sand|desert/],
	["particles", /particle|snow|ash|pollen|magic/],
];

/**
 * The negative prompt: plain nouns, as Google's guide asks. What a model adds on its own is listed only if the scene
 * doesn't hold it (a campfire scene keeps its fire), and a character who isn't human gets human skin and hands
 * listed, since Veo turned Marenka's metal robot hands into human ones mid-clip.
 */
export function videoNegative(c: CharacterCard, motion?: string): string {
	const scene =
		`${c.backstory.key_locations[0] ?? ""} ${motion ?? ""}`.toLowerCase();
	const added = ADDED_THINGS.filter(([, there]) => !there.test(scene)).map(
		([w]) => w,
	);
	const species = (c.core.dna?.species ?? "").toLowerCase();
	const human = !species || /\bhuman\b/.test(species);
	return [
		VIDEO_NEGATIVE,
		...added,
		...(human ? [] : ["human skin", "human hands", "human face"]),
	].join(", ");
}

/** The card's posture in words: "her head canted toward her left shoulder", "her back rounded". */
function postureParts(b: CharacterCard["look"]["body"], his: string): string[] {
	const side = (v: number) => (v > 0 ? "right" : "left");
	return [
		Math.abs(b.head_tilt) >= 0.15
			? `${his} head canted toward ${his} ${side(b.head_tilt)} shoulder`
			: "",
		Math.abs(b.shoulder_tilt) >= 0.15
			? `${his} ${side(b.shoulder_tilt)} shoulder lower`
			: "",
		b.stoop >= 0.25 ? `${his} back rounded` : "",
	].filter(Boolean);
}

/** Where sceneMotion keeps its answer, until the scene is redrawn. */
export const MOTION_FILE = "motion.md";

const MOTION_QUESTION =
	"This picture is the first frame of a short looping video. Apart from the main character's body, list the small things you can actually see in it that would naturally move during a calm moment, and how. Leave out anything large (bigger than the character's head): it stays still. Leave out thin or tiny details too (wires, threads, small hanging things): the video model grows whatever is named. Name only what is clearly visible at a glance. One line each, under twelve words, at most two lines. End each line with 'repeats' if its motion can go round in place and come back (turning, swaying, flickering, rippling), or 'stays still' if it could only change one way. If nothing would move, answer 'nothing'. List only what is in the picture.";

/** What sceneMotion kept for this scene, if it has read it. */
export const keptMotion = async (id: string) =>
	(
		await readFile(promptFile(id, MOTION_FILE), "utf8").catch(() => "")
	).trim() || undefined;

/**
 * What in the scene moves and how, read once from scene.png by a vision model (about $0.002) and kept in
 * prompts/motion.md until the scene is redrawn. Undefined without a fal key, or if the reading fails: the video
 * then gets the general line, it doesn't fail for want of an extra.
 */
export async function sceneMotion(
	id: string,
	sceneUrl: () => Promise<string>,
): Promise<string | undefined> {
	const kept = await keptMotion(id);
	if (kept || !apiKey()) return kept;
	return readMotion(id, sceneUrl).catch((e) => {
		console.error(
			`Reading what moves in ${id}'s scene failed: ${(e as Error).message}`,
		);
		return undefined;
	});
}

async function readMotion(
	id: string,
	sceneUrl: () => Promise<string>,
): Promise<string> {
	const text = await askVision(
		id,
		MOTION_QUESTION,
		await sceneUrl(),
		"what moves in scene.png",
		200,
	);
	await savePrompt(id, MOTION_FILE, text);
	return text;
}

/** One question about one picture to the vision model; the answer as one line, its cost in the ledger. */
async function askVision(
	id: string,
	question: string,
	imageUrl: string,
	what: string,
	max: number,
): Promise<string> {
	const vision = config().models.vision;
	const out = await falQueueJson<{
		output?: string;
		usage?: { cost?: number };
	}>(vision.model, {
		model: vision.llm,
		prompt: question,
		image_urls: [imageUrl],
		// The router's default model refuses requests with reasoning off ("Reasoning is mandatory").
		reasoning: true,
		max_tokens: 2000,
		temperature: 0,
	});
	const text = (out.output ?? "")
		.split("\n")
		.map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
		.filter(Boolean)
		.join("; ")
		.slice(0, max);
	if (!text) throw new Error(`The vision model said nothing (${what}).`);
	await recordCost(id, {
		kind: "video",
		model: `${vision.model} (${vision.llm})`,
		detail: what,
		usd: out.usage?.cost ?? config().pricing.vision.call,
	});
	return text;
}

const CARRY_QUESTION =
	"These four pictures are frames of one short clip, in order: top left, top right, bottom left, bottom right. Apart from the main character, say how each thing that moved across them moved: which way as the viewer sees it (for a turning thing, whether its front moves left or right), and how fast (for example a tenth of a turn over the clip). One line each, under twenty words, at most four lines. Leave out the light, and leave out anything that is not already in the first picture (top left): it should not be there. If nothing moved, answer 'nothing'.";

/**
 * How the chain's first piece moved, read from four of its frames, so the second piece carries on at the same
 * speed and direction instead of starting its own motion (Marenka's first piece barely moved; the second spun the
 * lens 30× faster). The light is left out: if the first piece drifted, the second must not follow it. Undefined if
 * the reading fails.
 */
async function pieceMotion(
	id: string,
	piece: Buffer,
	max: number,
): Promise<string | undefined> {
	if (max < 60) return;
	try {
		const sheet = await frameSheet(piece);
		const url = await falUpload(sheet, "image/png", "piece-1-frames.png");
		const text = await askVision(
			id,
			CARRY_QUESTION,
			url,
			"how loop piece 1 moved",
			max,
		);
		return /^nothing\b/i.test(text) ? undefined : text;
	} catch (e) {
		console.error(
			`Reading how ${id}'s first piece moved failed: ${(e as Error).message}`,
		);
		return undefined;
	}
}

/** The line the second piece gets about the first, and its longest possible length. */
// Kling meets an end frame by the shortest way, so a turning thing ran backward in Marenka's second piece.
const carryLine = (motion: string) =>
	`This piece continues a clip that moved like this; everything keeps the same speed and direction and never turns back, not even to meet the last frame: ${motion.replace(/[.;]*$/, ".")}`;
const CARRY_MAX = 300;

/** Four frames of a clip, evenly spread from first to last, in a 2×2 sheet. */
export const frameSheet = (video: Buffer) =>
	transform(video, "mp4", "png", async (src, dst) => {
		const info = JSON.parse(
			await run("ffprobe", [
				"-v",
				"error",
				"-count_frames",
				"-select_streams",
				"v:0",
				"-show_entries",
				"stream=nb_read_frames",
				"-of",
				"json",
				src,
			]),
		) as { streams: { nb_read_frames?: string }[] };
		const n = Number(info.streams[0]?.nb_read_frames);
		if (!(n >= 4)) throw new Error("The piece is too short to read.");
		const picks = [0, 1, 2, 3].map((k) => Math.round((k * (n - 1)) / 3));
		await run("ffmpeg", [
			"-v",
			"error",
			"-y",
			"-i",
			src,
			"-vf",
			`select='${picks.map((f) => `eq(n\\,${f})`).join("+")}',scale=640:-2,tile=2x2`,
			"-frames:v",
			"1",
			dst,
		]);
	});

/**
 * The user's corrections for this one take, no code change needed. Appended last they lost to the default text
 * ("No smoke" still got smoke), so they come first as binding rules, with a reminder at the end.
 */
export const withNotes = (prompt: string, notes?: string) => {
	const n = notes?.trim();
	return n
		? `Binding corrections for this take; they override anything below that conflicts with them: ${n}\n${prompt}\n(The corrections at the top win.)`
		: prompt;
};

export interface SceneResult {
	file: string;
	prompt: string;
}

export async function generateScene(
	id: string,
	opts: {
		prompt?: string;
		notes?: string;
		quality?: "low" | "medium" | "high";
	} = {},
): Promise<SceneResult> {
	const card = await loadCard(id);
	const concept = await readFile(assetFile(id, "concept.png")).catch(() => {
		throw new Error(
			`No concept.png for "${id}" yet: generate the concept first, it is the character reference.`,
		);
	});
	const prompt = withNotes(opts.prompt ?? defaultScenePrompt(card), opts.notes);
	const ref = await falUpload(concept, "image/png", "concept.png");
	const sceneModel = config().models.scene;
	const out = await falQueue(sceneModel.model, {
		prompt,
		image_urls: [ref],
		image_size: { width: 1536, height: 864 }, // 16:9, for full-screen backgrounds
		quality: opts.quality ?? sceneModel.quality, // the first and last frame of the video: worth a bit more than "low"
		reasoning_effort: "low",
		output_format: "png",
	});
	const file = await saveAsset(id, "scene.png", out.bytes, prompt);
	// What moves was read from the old scene.
	await rm(promptFile(id, MOTION_FILE), { force: true });
	await recordCost(id, {
		kind: "scene",
		model: sceneModel.model,
		detail: `scene still, ${opts.quality ?? sceneModel.quality}`,
		usd: config().pricing.scene.image,
	});
	return { file, prompt };
}

/**
 * How the clip loops (see defaultLoop: frame for Veo, chain for Kling). "chain": a free piece from scene.png, then a piece from its last frame back to
 * scene.png, joined without the duplicated frames; with an end frame alone every model froze the place (#50).
 * "frame": one piece that ends on its first frame. "crossfade": ffmpeg blends the last second into the first
 * (picture and sound); the seam shows. "off": a plain clip.
 */
export const LOOP_MODES = ["chain", "frame", "crossfade", "off"] as const;
export type LoopMode = (typeof LOOP_MODES)[number];

/**
 * The loop each model closes best. Veo: one piece that ends on its first frame; it keeps the character moving
 * there (Marenka, 8 s). Kling froze everything in that mode (0.06), so it gets the two-piece chain.
 */
export const defaultLoop = (model: VideoModel): LoopMode =>
	model === "veo" ? "frame" : "chain";
const CROSSFADE_S = 1;

/** One model call of an idle video: its length, and whether it is given an end frame. */
export interface VideoPiece {
	seconds: number;
	end: boolean;
}

/** The lengths each model takes. Kling O1: 3–10 s with an end frame, only 5 or 10 from a start frame alone. */
function pieceSeconds(model: VideoModel, asked: number, end: boolean): number {
	const clamp = (lo: number, hi: number) =>
		Math.min(hi, Math.max(lo, Math.round(asked)));
	if (model === "veo") return asked >= 7 ? 8 : asked >= 5 ? 6 : 4;
	if (model === "kling3") return clamp(3, 15);
	return end ? clamp(3, 10) : asked > 7 ? 10 : 5;
}

/** The model calls an idle video of about `seconds` takes: two for a chain, one otherwise. */
export function videoPlan(
	model: VideoModel,
	loop: LoopMode,
	seconds: number,
): VideoPiece[] {
	if (loop === "chain")
		return [
			{ seconds: pieceSeconds(model, seconds / 2, false), end: false },
			{ seconds: pieceSeconds(model, seconds / 2, true), end: true },
		];
	// Veo matches the first and last frame but not the motion through them, so its crossfade gets both too.
	const end = loop === "frame" || (loop === "crossfade" && model === "veo");
	return [{ seconds: pieceSeconds(model, seconds, end), end }];
}

/** What an idle video costs: every piece is billed. */
export const idleVideoUsd = (
	model: VideoModel,
	loop: LoopMode,
	seconds: number,
) =>
	videoPlan(model, loop, seconds).reduce(
		(sum, p) => sum + videoUsd(model, p.seconds),
		0,
	);

/** The chain's first piece and its last frame, on disk while the second piece renders. */
const PIECE_1 = "idle-piece-1.mp4";
const PIECE_1_LAST = "idle-piece-1-last.png";

export interface VideoResult {
	/** Undefined on a dry run. */
	file?: string;
	/** Dry run: what moves will be read from the scene first (priced in usd). */
	motionPending?: boolean;
	prompt: string;
	seconds: number;
	pieces: VideoPiece[];
	usd: number;
	/** What moves in the scene, as the prompt was told; undefined if it wasn't known. */
	motion?: string;
}

/**
 * For models that take one: what is never right in an idle clip, in general words (a named thing gets drawn).
 */
export const VIDEO_NEGATIVE =
	"new people, new objects, a different face, a younger or older face, camera movement, zoom, cuts, blur, distortion, low quality";
/** Kling's prompt limit (fal schema); Veo takes 20 000. */
const KLING_PROMPT_MAX = 2500;

/** One model call: a clip from `start`, ending on `end` if given. */
async function renderPiece(
	model: VideoModel,
	piece: {
		prompt: string;
		start: string;
		end?: string;
		seconds: number;
		negative: string;
	},
): Promise<{ bytes: Buffer; endpoint: string }> {
	const video = config().models.video;
	const { prompt, start, end, seconds, negative } = piece;
	const endFrame = end ? { end_image_url: end } : {};
	const body =
		model === "kling"
			? {
					prompt,
					start_image_url: start,
					...endFrame,
					duration: String(seconds),
				}
			: model === "kling3"
				? {
						prompt,
						start_image_url: start,
						...endFrame,
						duration: String(seconds),
						generate_audio: false,
						negative_prompt: negative,
					}
				: {
						prompt,
						negative_prompt: negative,
						...(end
							? { first_frame_url: start, last_frame_url: end }
							: { image_url: start }),
						duration: `${seconds}s`,
						aspect_ratio: "16:9",
						resolution: "720p",
						generate_audio: false,
					};
	const endpoint = model === "veo" && !end ? video.veoStartOnly : video[model];
	const out = await falQueue(endpoint, body, "video", 10 * 60_000); // video renders take minutes
	return { bytes: out.bytes, endpoint };
}

/** A first frame other than scene.png: a file in the character's assets/ folder, or a public https URL. */
async function startImage(id: string, start: string): Promise<string> {
	if (isUrl(start)) return (await assertPublicUrl(start)).href;
	if (!/^[\w.-]+\.(png|jpe?g|webp)$/i.test(start))
		throw new Error(
			`start must be a file name in ${id}'s assets folder (png, jpg or webp) or an https URL, got "${start}".`,
		);
	// Checked like any picture the user names: a real PNG, JPEG or WebP of a usable size, before it goes to fal.
	const { bytes, mimeType } = await readUserImage(assetFile(id, start));
	return falUpload(bytes, mimeType, start);
}

/**
 * Silent idle clip from scene.png (Kling O1 or 3.0 ≈$0.084/s, Veo 3.1 Fast $0.10/s), looped per
 * LoopMode. A dry run returns the exact prompt and the price without calling the video model (reading what moves
 * in the scene may still cost about $0.002, once per scene).
 */
export async function generateIdleVideo(
	id: string,
	opts: {
		prompt?: string;
		notes?: string;
		seconds?: number;
		loop?: LoopMode;
		model?: VideoModel;
		/** What moves in the scene and how, in the caller's own words: replaces the vision model's reading. */
		motion?: string;
		/** First frame instead of scene.png, for a single piece. */
		start?: string;
		dryRun?: boolean;
	} = {},
): Promise<VideoResult> {
	const card = await loadCard(id);
	const scene = await readFile(assetFile(id, "scene.png")).catch(() => {
		throw new Error(`No scene.png for "${id}" yet: generate the scene first.`);
	});
	const video = config().models.video;
	const model = opts.model ?? video.default;
	if (!VIDEO_FAMILIES.includes(model))
		throw new Error(
			`Unknown video model "${model}": use ${VIDEO_FAMILIES.join(", ")}.`,
		);
	const loop = opts.loop ?? (opts.start ? "frame" : defaultLoop(model));
	if (!LOOP_MODES.includes(loop))
		throw new Error(`Unknown loop "${loop}": use ${LOOP_MODES.join(", ")}.`);
	if (opts.start && loop === "chain")
		throw new Error(
			"start is for a single piece (loop frame, crossfade or off); a chain always starts and ends on scene.png.",
		);
	const asked = opts.seconds ?? 10;
	if (!Number.isFinite(asked))
		throw new Error(`seconds must be a number, got ${opts.seconds}.`);
	const pieces = videoPlan(model, loop, asked);
	// A chain also reads how its first piece moved, for the second (one vision call).
	const usd =
		pieces.reduce((s, p) => s + videoUsd(model, p.seconds), 0) +
		(loop === "chain" && !opts.prompt ? config().pricing.vision.call : 0);
	const seconds = pieces.reduce((s, p) => s + p.seconds, 0);

	let sceneUrl: Promise<string> | undefined;
	const sceneOnFal = () => {
		sceneUrl ??= falUpload(scene, "image/png", "scene.png");
		return sceneUrl;
	};
	// What moves is read from scene.png: not for another first frame, and a dry run only uses what is kept.
	const readsScene = !opts.prompt && !opts.motion?.trim() && !opts.start;
	const kept = readsScene ? await keptMotion(id) : undefined;
	const reading = readsScene && kept === undefined;
	const motion = opts.prompt
		? undefined
		: opts.motion?.trim() ||
			(!readsScene
				? undefined
				: opts.dryRun
					? kept && movingOnly(kept)
					: await sceneMotion(id, sceneOnFal).then((m) => m && movingOnly(m)));
	// The scene reading is part of this video's price, the first time.
	const visionUsd = reading ? config().pricing.vision.call : 0;
	const prompt = withNotes(
		opts.prompt ??
			(model === "veo"
				? veoLoopPrompt(card, loop, motion)
				: defaultLoopPrompt(card, loop, model, motion)),
		opts.notes,
	);
	const negative = videoNegative(card, motion);
	// Checked before the video model is paid for.
	if (model !== "veo" && prompt.length > KLING_PROMPT_MAX)
		throw new Error(
			`The video prompt is ${prompt.length} characters; Kling takes at most ${KLING_PROMPT_MAX}. Shorten the notes or the prompt, or use model veo.`,
		);
	if (opts.dryRun)
		return {
			prompt,
			seconds,
			pieces,
			// The real run reads the scene first if it hasn't been read.
			usd: usd + visionUsd,
			motion,
			motionPending: reading,
		};

	const first = opts.start
		? await startImage(id, opts.start)
		: await sceneOnFal();
	const record = (endpoint: string, s: number, what: string) =>
		recordCost(id, {
			kind: "video",
			model: endpoint,
			detail: `${what}${s} s`,
			usd: videoUsd(model, s),
		});
	let bytes: Buffer;
	if (loop === "chain") {
		const [a, b] = pieces;
		const one = await renderPiece(model, {
			prompt,
			start: first,
			seconds: a.seconds,
			negative,
		});
		await record(one.endpoint, a.seconds, "loop piece 1 of 2, ");
		// Cut before the light drifts, so the second piece starts and ends in the scene's own light.
		const steady = await lastSteadyFrame(one.bytes);
		one.bytes = await firstFrames(one.bytes, steady + 1);
		// Paid for: kept until the loop is done, so a failed second piece doesn't lose it.
		const lastPng = await lastFrame(one.bytes);
		await saveAsset(id, PIECE_1, one.bytes);
		await saveAsset(id, PIECE_1_LAST, lastPng);
		try {
			const last = await falUpload(lastPng, "image/png", PIECE_1_LAST);
			// A custom prompt is sent as written; otherwise the second piece hears how the first one moved.
			const room =
				model === "veo"
					? CARRY_MAX
					: Math.min(
							CARRY_MAX,
							KLING_PROMPT_MAX - prompt.length - carryLine("").length - 1,
						);
			const carried = opts.prompt
				? undefined
				: await pieceMotion(id, one.bytes, room);
			const prompt2 = carried ? `${prompt}\n${carryLine(carried)}` : prompt;
			await savePrompt(id, "idle-piece-2.txt", prompt2);
			const two = await renderPiece(model, {
				prompt: prompt2,
				start: last,
				end: await sceneOnFal(),
				seconds: b.seconds,
				negative,
			});
			await record(two.endpoint, b.seconds, "loop piece 2 of 2, ");
			bytes = await joinLoop(one.bytes, two.bytes);
		} catch (e) {
			throw new Error(
				`${(e as Error).message} The first piece is saved as assets/${PIECE_1}; its last frame, assets/${PIECE_1_LAST}, can start the second piece (start: "${PIECE_1_LAST}", loop: "frame").`,
			);
		}
	} else {
		const [p] = pieces;
		const out = await renderPiece(model, {
			prompt,
			start: first,
			end: p.end ? await sceneOnFal() : undefined,
			seconds: p.seconds,
			negative,
		});
		await record(out.endpoint, p.seconds, "");
		bytes =
			loop === "crossfade"
				? await crossfadeLoop(out.bytes, CROSSFADE_S)
				: out.bytes;
	}
	// Models drift the light whatever the prompt says: every loop is held to its first frame's.
	// Paid for: a failed light hold must not lose the clip, it is saved as made.
	bytes = await lockExposure(bytes).catch((e) => {
		console.error(
			`Holding the light of ${id}'s video failed: ${(e as Error).message}`,
		);
		return bytes;
	});
	const file = await saveAsset(id, "idle.mp4", bytes, prompt);
	if (loop === "chain")
		await Promise.all(
			[PIECE_1, PIECE_1_LAST].map((f) => rm(assetFile(id, f), { force: true })),
		);
	return {
		file,
		prompt,
		seconds: await clipSeconds(bytes),
		pieces,
		usd: usd + visionUsd,
		motion,
	};
}

/**
 * Holds every frame's overall brightness and colour to the first frame's, by one gain per channel per frame. Kling
 * dimmed the end of Marenka's first piece in both takes, whatever the prompt said; the second piece then ran 35%
 * darker and the loop flashed at its seam. Light that moves inside the frame (a flame, a sweeping beam) is kept:
 * only the frame's average is held.
 */
export async function lockExposure(video: Buffer): Promise<Buffer> {
	return transform(video, "mp4", "mp4", async (src, dst) => {
		const info = await probe(src);
		// Pass 1: each frame's mean per channel, from a small copy.
		const means: number[][] = [];
		await eachFrame(src, 64, 36, (rgb) => {
			const m = [0, 0, 0];
			for (let i = 0; i < rgb.length; i += 3)
				for (let c = 0; c < 3; c++) m[c] += rgb[i + c];
			means.push(m.map((v) => v / (rgb.length / 3)));
			return undefined;
		});
		const target = means[0];
		const gains = means.map((m) =>
			m.map((v, c) => Math.min(2, Math.max(0.5, target[c] / Math.max(1, v)))),
		);
		// Pass 2: the full picture, each frame scaled by its gains.
		await eachFrame(
			src,
			info.width,
			info.height,
			(rgb, i) => {
				const g = gains[Math.min(i, gains.length - 1)];
				for (let p = 0; p < rgb.length; p += 3)
					for (let c = 0; c < 3; c++)
						rgb[p + c] = Math.min(255, Math.round(rgb[p + c] * g[c]));
				return rgb;
			},
			{ dst, fps: info.fps },
		);
	});
}

/**
 * Where a piece still has its first frame's light: the last frame whose average brightness is within 3% of the
 * first's, if that keeps at least half the piece; else the last frame. Kling dimmed the last second of Marenka's
 * first piece in both takes, and a second piece started from that frame stayed dark and lit a lamp that wasn't there.
 */
export async function lastSteadyFrame(video: Buffer): Promise<number> {
	return transformMany(
		[{ bytes: video, ext: "mp4" }],
		"txt",
		async ([src], dst) => {
			const lum: number[] = [];
			await eachFrame(src, 64, 36, (rgb) => {
				let sum = 0;
				for (let i = 0; i < rgb.length; i += 3)
					sum += 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2];
				lum.push(sum / (rgb.length / 3));
				return undefined;
			});
			if (!lum.length)
				throw new Error("The first piece has no frames to read.");
			let k = lum.length - 1;
			while (k > lum.length / 2 && Math.abs(lum[k] - lum[0]) > 0.03 * lum[0])
				k--;
			if (Math.abs(lum[k] - lum[0]) > 0.03 * lum[0]) k = lum.length - 1;
			await writeFile(dst, String(k));
		},
	).then((b) => Number(b.toString()));
}

/** The first `frames` frames of a clip. */
export const firstFrames = (video: Buffer, frames: number) =>
	transform(video, "mp4", "mp4", async (src, dst) => {
		await run("ffmpeg", [
			"-v",
			"error",
			"-y",
			"-i",
			src,
			"-vf",
			`trim=end_frame=${frames},setpts=PTS-STARTPTS`,
			"-an",
			"-c:v",
			"libx264",
			"-crf",
			"18",
			"-pix_fmt",
			"yuv420p",
			"-movflags",
			"+faststart",
			dst,
		]);
	});

/** A clip's length in seconds, from its frames: the chain's first piece may have been cut. */
const clipSeconds = (video: Buffer) =>
	transformMany([{ bytes: video, ext: "mp4" }], "txt", async ([src], dst) => {
		const { frames, fps } = await probe(src);
		await writeFile(dst, String(Math.round((frames / fps) * 10) / 10));
	}).then((b) => Number(b.toString()));

/** The last frame of a clip, as a PNG: the start of the chain's second piece. */
export const lastFrame = (video: Buffer) =>
	transform(video, "mp4", "png", async (src, dst) => {
		await run("ffmpeg", [
			"-v",
			"error",
			"-y",
			"-sseof",
			"-1",
			"-i",
			src,
			"-update",
			"1",
			dst,
		]);
	});

/** Frame count, rate and size of a clip's picture. */
async function probe(file: string) {
	const info = JSON.parse(
		await run("ffprobe", [
			"-v",
			"error",
			"-count_frames",
			"-show_entries",
			"stream=codec_type,nb_read_frames,r_frame_rate,width,height",
			"-of",
			"json",
			file,
		]),
	) as {
		streams: {
			codec_type: string;
			nb_read_frames?: string;
			r_frame_rate?: string;
			width?: number;
			height?: number;
		}[];
	};
	const v = info.streams.find((x) => x.codec_type === "video");
	if (!v) throw new Error("The clip has no picture.");
	const [num, den] = (v.r_frame_rate ?? "24/1").split("/").map(Number);
	const r = {
		frames: Number(v.nb_read_frames),
		fps: num / (den || 1),
		width: v.width ?? 0,
		height: v.height ?? 0,
	};
	if (
		!(r.frames > 0 && r.fps > 0 && r.width > 0 && r.height > 0) ||
		!Number.isFinite(r.frames + r.fps)
	)
		throw new Error(
			`Can't read the clip's frames: ${JSON.stringify(info.streams)}`,
		);
	return r;
}

/**
 * Joins the chain's two pieces into one seamless loop. The second piece starts on the first one's last frame and
 * ends on scene.png, the first one's first frame, so its first and last frames are duplicates: both are dropped.
 */
export async function joinLoop(a: Buffer, b: Buffer): Promise<Buffer> {
	return transformMany(
		[
			{ bytes: a, ext: "mp4" },
			{ bytes: b, ext: "mp4" },
		],
		"mp4",
		async ([srcA, srcB], dst) => {
			const [pa, pb] = await Promise.all([probe(srcA), probe(srcB)]);
			if (pb.frames < 3) throw new Error("The second loop piece is too short.");
			const keep = pb.frames - 1; // frames 1 … n-2 of the second piece
			const v = `[0:v]setpts=PTS-STARTPTS,setsar=1[va];[1:v]trim=start_frame=1:end_frame=${keep},setpts=PTS-STARTPTS,scale=${pa.width}:${pa.height},setsar=1[vb]`;
			await run("ffmpeg", [
				"-v",
				"error",
				"-y",
				"-i",
				srcA,
				"-i",
				srcB,
				"-filter_complex",
				`${v};[va][vb]concat=n=2:v=1:a=0[v]`,
				"-map",
				"[v]",
				"-an",
				"-c:v",
				"libx264",
				"-crf",
				"18",
				"-pix_fmt",
				"yuv420p",
				"-movflags",
				"+faststart",
				dst,
			]);
		},
	);
}

/**
 * Makes a clip loop seamlessly: output = clip[d..T] whose last d seconds dissolve into clip[0..d], so the final
 * frame is frame d — the first frame of the output.
 */
export async function crossfadeLoop(video: Buffer, d: number): Promise<Buffer> {
	return transform(video, "mp4", "mp4", async (src, dst) => {
		const info = JSON.parse(
			await run("ffprobe", [
				"-v",
				"error",
				"-show_entries",
				"format=duration",
				"-of",
				"json",
				src,
			]),
		) as { format: { duration: string } };
		const total = Number(info.format.duration);
		const v = `[0:v]split[a][b];[a]trim=start=${d},setpts=PTS-STARTPTS[tail];[b]trim=end=${d},setpts=PTS-STARTPTS[head];[tail][head]xfade=transition=fade:duration=${d}:offset=${(total - 2 * d).toFixed(3)}[v]`;
		await run("ffmpeg", [
			"-v",
			"error",
			"-y",
			"-i",
			src,
			"-filter_complex",
			v,
			"-map",
			"[v]",
			"-an",
			"-c:v",
			"libx264",
			"-crf",
			"18",
			"-pix_fmt",
			"yuv420p",
			"-movflags",
			"+faststart",
			dst,
		]);
	});
}
