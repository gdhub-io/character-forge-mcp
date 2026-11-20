import { type Avatar, makeAvatar } from "./avatar.js";
import { apiKey, config } from "./config.js";
import { recordCost } from "./costs.js";
import { falControlGenerate, falUpload, toImageUrl } from "./fal.js";
import {
	type BodyShape,
	type FigureStyle,
	mannequinPng,
	type PoseLayout,
} from "./pose.js";
import { bodyOf, type CharacterCard, slugify } from "./schema.js";
import {
	checkName,
	IMPORTED,
	loadCard,
	pickWinner,
	saveConcept,
	savePrompt,
	writeCard,
} from "./store.js";
import { readUserImage } from "./userimage.js";
import { askVision } from "./vision.js";

export const VIEWS = ["front", "front-back", "front-side-back"] as const;
export type Views = (typeof VIEWS)[number];
export const DEFAULT_VIEWS: Views = "front-back";

export interface ConceptOptions {
	/** Overrides visual.art_style from the card. */
	style?: string;
	views?: Views;
	/** Free-form art direction appended to the prompt, in every mode. */
	extra?: string;
	/** A picture (path, URL or data URI) whose pose the character should take instead of the A-pose. */
	poseImage?: string;
	/** Seed for reproducible results. */
	seed?: number;
	/** How our figure steers the image: gpt (default: a pose reference for GPT Image), img2img (Z-Image repaints it) or a ControlNet condition. Only gpt is in regular use; the rest are kept for experiments. */
	control?: "img2img" | "gpt" | "pose" | "depth" | "canny";
	/** img2img: how much to repaint the mannequin, 0-1 (default 0.85). */
	strength?: number;
	/** The figure drawing (see FigureStyle); default: the pose skeleton for gpt, otherwise colour blocking with volume (grey shaded without look.blocking). */
	figure?: FigureStyle;
	/** How strictly to follow the pose, 0-1 (default 0.75). */
	controlScale?: number;
	/** Also cut the avatar from the sheet (default true; free). */
	avatar?: boolean;
	/** Marks the last take lost: put first, as a binding correction (the check's one retake). */
	retake?: string[];
}

/** The body's numbers as words an image model follows; only deviations from average are named. */
export function bodyWords(b: BodyShape): string {
	const side = (v: number) => (v > 0 ? "RIGHT" : "LEFT");
	const rel = (v: number, lo: string, hi: string, step: number) =>
		v >= 1 + step ? hi : v <= 1 - step ? lo : "";
	return [
		b.head_heights <= 5
			? `big head on a short, compact body (${b.head_heights} heads)`
			: `${b.head_heights} heads tall`,
		rel(b.shoulders, "narrow shoulders", "broad shoulders", 0.15),
		rel(b.hips, "narrow hips", "wide hips", 0.15),
		rel(b.legs, "short legs", "long legs", 0.07),
		rel(b.arms, "short arms", "long arms", 0.07),
		Math.abs(b.shoulder_tilt) >= 0.15
			? `${side(b.shoulder_tilt)} shoulder ${Math.abs(b.shoulder_tilt) >= 0.6 ? "much" : "visibly"} lower`
			: "",
		Math.abs(b.head_tilt) >= 0.15
			? `head canted toward the ${side(b.head_tilt)} shoulder`
			: "",
		b.stoop >= 0.6
			? "heavy stoop, head sunk forward"
			: b.stoop >= 0.25
				? "rounded back"
				: "",
		b.knees === "knock" ? "knock-kneed" : b.knees === "bow" ? "bow-legged" : "",
	]
		.filter(Boolean)
		.join(", ");
}

/** Image models beautify by default; the card's flaws only survive if we say so. Style-neutral: no realism words. */
export const NOT_IDEALIZED =
	"Not idealized: a specific person with asymmetries, uneven features, every flaw and mark";

/**
 * Muddy sheets came from wear painted as dirt over every plane (and a grey backdrop greying it all); the card's
 * wear still shows, as shapes.
 */
export const CLEAN_COLOUR =
	"Clean, clear colour: each material one clear local colour, light and shadow as clean shapes of that colour; wear shows as shape (patches, frays, creases, worn edges), not as grime, smudges, stains or a muddy wash over the colours";

/** Sunburst drew Gennady's cape knit cable by cable and its fringe thread by thread: busy, and off the house style. */
export const FEW_DETAILS =
	"Few, large shapes: knit, weave, fringe and stitching suggested by a few planes, never drawn thread by thread; small detail only on the face, the hands and the signature item";

/**
 * Gennady's headset band began in the middle of his head. No example names a thing here: a named thing gets drawn.
 */
export const WHOLE_ITEMS =
	"Every piece of clothing and footwear and every worn or carried item is whole and sits on the body as it would in life; nothing starts or ends inside the head or the body, or in mid-air";

/** The sheet holds the views and nothing else: a lone signature item drawn beside them was on every sheet. */
const ONLY_FIGURES =
	"Only the character on the sheet: every item is worn or carried on the body, nothing drawn on its own beside the figures";

const BACKGROUND = "Plain, flat, very light neutral background";

type Mark = CharacterCard["look"]["marks"][number];

/**
 * Marks that change the body's shape, which image models quietly repair: Gennady's left hand with only the thumb and
 * little finger was drawn whole in every view (#61). The card's `defining` flag decides; without it, the wording.
 */
const DEFINING =
	/\b(missing|lost (\w+ )?(fingers?|hand|arm|leg|foot|eye|ear|toes?)|amputat\w*|severed|stump|prosthe\w*|artificial|(glass|false) (eye|leg|arm|hand)|eye ?patch|peg leg|only (the )?thumb|no (left|right) (hand|arm|leg|foot|eye|ear))/i;

export const definingMarks = (card: CharacterCard): Mark[] =>
	card.look.marks.filter((m) => m.defining ?? DEFINING.test(m.mark));

export const markText = (m: Mark, max = 300) =>
	`${clip(m.mark, max)} (${clip(m.location, max)})`;

/**
 * How an old loss looks: "smooth shiny scar tissue" came out as a glossy pink lump stuck on Gennady's hand, like
 * plasticine. The hand simply ends there, in its own skin.
 */
export const HEALED =
	"An old, healed loss is matte skin in the skin's own colour, with at most a faint pale seam: not pink, glossy, raw or lumpy, unless the mark says the wound is fresh.";

/** A hand hanging edge-on hides its fingers, and the model filled the gap back in; palm to the viewer it reads. */
const handShown = (ms: Mark[]) =>
	ms.some((m) =>
		/\b(hand|fingers?|thumb|palm|knuckles?)\b/i.test(`${m.mark} ${m.location}`),
	)
		? " The hand that carries it hangs a little open, palm turned slightly toward the viewer in the front view, so the gap reads in both views; the arm stays down in the A-pose."
		: "";

/**
 * Image models pull every character toward an average person: they straighten a stoop, fill in lost fingers, even
 * out proportions. Pushing what is distinct a notch past life keeps the character their own.
 */
function pushedLine(card: CharacterCard): string {
	const b = bodyOf(card);
	const body = bodyWords(b)
		.split(", ")
		.filter((w) => !/heads tall/.test(w));
	const items = [
		clip(card.look.silhouette, 160),
		// The face's own shape: without it every face came out as the model's default one.
		`face: ${clip(card.description.physical.face, 140)}`,
		...body,
		...definingMarks(card).map((m) => clip(m.mark, 80)),
	].filter(Boolean);
	return `PUSH WHAT MAKES THEM DISTINCT, a notch past life, never caricature, the face stays believable: ${items.join("; ")}.`;
}

/** The defining marks as one binding rule, first in every picture prompt; "" when there are none. */
export function bindingMarks(card: CharacterCard, max = 300): string {
	const ms = definingMarks(card);
	return ms.length
		? `BINDING, above everything else: the body exactly as written, in every view, never repaired or drawn whole: ${ms.map((m) => markText(m, max)).join("; ")}. Count fingers and limbs exactly; the A-pose stays, and the mark shows in it.${handShown(ms)} ${HEALED}`
		: "";
}

/** The retake's correction: what the last take lost, first and binding. */
const retakeLine = (lost?: string[]) =>
	lost?.length
		? `Binding correction for this take; it overrides anything below: the last take lost ${lost.join("; ")}. Draw it exactly as written, clearly visible in every view.`
		: "";

const VIEW_TEXT: Record<Views, string> = {
	front: "one full-body front view",
	"front-back":
		"front view (left) and back view (right) of the SAME person, same scale, identical outfit and accessories in both",
	"front-side-back":
		"front, right profile and back views side by side, same scale",
};

/**
 * Shortens a prose field to its first clauses within `max` characters, cutting at a clause boundary.
 * The text encoder reads ~512 tokens (~2000 characters) at most, so every field must stay terse.
 */
export function clip(text: string, max: number): string {
	const t = text.trim().replace(/\s+/g, " ");
	if (t.length <= max) return t.replace(/[.!?…,;:\s]+$/, "");
	const cut = t.slice(0, max);
	// A sentence end beats any clause break after it: "… on the belt. FRONT:" must not leave a stray "FRONT".
	const sentence = cut.lastIndexOf(". ");
	const clause = Math.max(
		cut.lastIndexOf(";"),
		cut.lastIndexOf(" — "),
		cut.lastIndexOf(","),
		cut.lastIndexOf(":"),
		cut.lastIndexOf(" ("),
	);
	const at = sentence > max * 0.4 && clause - sentence < 12 ? sentence : clause;
	const head =
		at > max * 0.4 ? cut.slice(0, at) : cut.slice(0, cut.lastIndexOf(" "));
	// Drop a parenthesis the cut left open, then any dangling article or preposition ("a pocket for a").
	const open = head.lastIndexOf("(");
	const closed =
		open >= 0 && head.indexOf(")", open) < 0 ? head.slice(0, open) : head;
	return closed
		.replace(/(\s+(a|an|the|for|of|and|with|to|on|in|at|by))+\s*$/i, "")
		.replace(/[.,;:\s—-]+$/, "");
}

/**
 * One house style for every concept and scene, so a library reads as one project. Pass `style` to see the same
 * character in another look (`"card"` = the designer's suggestion in look.art_style); those sheets are saved next to
 * concept.png.
 */
export const DEFAULT_ART_STYLE =
	"Stylized 3D game character render, hand-painted textures, slightly exaggerated proportions, soft studio light";

/** The library's house style: CHARACTER_FORGE_ART_STYLE (read on every call, like models.json), else the default. */
export function houseStyle(): string {
	return process.env.CHARACTER_FORGE_ART_STYLE?.trim() || DEFAULT_ART_STYLE;
}

export function resolveStyle(card: CharacterCard, style?: string): string {
	return !style ? houseStyle() : style === "card" ? card.look.art_style : style;
}

/** The user's own art direction, last in every concept prompt. */
const alsoLine = (extra?: string) =>
	extra?.trim() ? `Also: ${extra.trim()}` : "";

/** "34-year-old"; a free-text age ("Looks about 27; is 1,000 years old") is given as it is. */
const ageWords = (age: string | number) =>
	/^\d+$/.test(String(age).trim())
		? `${String(age).trim()}-year-old`
		: `(age: ${String(age)
				.trim()
				.replace(/[.\s]+$/, "")})`;

/** Possessive pronoun from the card's free-text gender: "her", "his" or "their". */
export const pronoun = (gender: string) =>
	/^(w|f|girl)/i.test(gender)
		? "her"
		: /^(m|boy)/i.test(gender)
			? "his"
			: "their";

/** Where a character's own side appears on the sheet, spelled out (models read "left" as the image's left). */
function sideNote(p: string): string {
	return `"Left" and "right" always mean ${p} own sides: ${p} LEFT side is on the viewer's RIGHT in the front view and on the viewer's LEFT in the back view.`;
}

/** A rough colour word for a hex value: models follow "black boot" better than "#141414 boot". */
export function colourName(hex: string): string {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	const l = (max + min) / 510;
	if (max - min < 24)
		return l < 0.15
			? "black"
			: l < 0.4
				? "dark grey"
				: l < 0.75
					? "grey"
					: "white";
	const h = (() => {
		const d = max - min;
		const raw =
			max === r
				? ((g - b) / d) % 6
				: max === g
					? (b - r) / d + 2
					: (r - g) / d + 4;
		return (raw * 60 + 360) % 360;
	})();
	const dark = l < 0.3 ? "dark " : "";
	if (h < 15 || h >= 345) return `${dark}red`;
	if (h < 45) return l < 0.45 ? "brown" : "orange";
	if (h < 70) return l < 0.4 ? "olive" : "yellow";
	if (h < 170) return `${dark}green`;
	if (h < 200) return `${dark}teal`;
	if (h < 255) return l < 0.25 ? "navy" : "blue";
	if (h < 290) return `${dark}purple`;
	return `${dark}pink`;
}

/**
 * Every left/right asymmetry translated into where it appears for the viewer in each view.
 * Models follow "on the viewer's right in the front view" far more reliably than "her left".
 */
export function perViewPlacement(card: CharacterCard): string {
	const lk = card.look;
	const b = lk.body;
	const p = pronoun(card.description.gender);
	// A character's own side → the viewer's side: front view mirrors it, back view keeps it.
	const front = (own: "left" | "right") =>
		own === "left" ? "viewer's RIGHT" : "viewer's LEFT";
	const back = (own: "left" | "right") =>
		own === "left" ? "viewer's LEFT" : "viewer's RIGHT";
	const items: [string, "left" | "right"][] = [];
	if (lk.blocking && lk.blocking.footwear_left !== lk.blocking.footwear_right) {
		items.push(
			[
				`the ${colourName(lk.blocking.footwear_left)} boot (${p} left foot)`,
				"left",
			],
			[
				`the ${colourName(lk.blocking.footwear_right)} boot (${p} right foot)`,
				"right",
			],
		);
	}
	for (const a of lk.blocking?.accessories ?? []) {
		const m = /^(left|right)_(\w+)$/.exec(a.where);
		if (m)
			items.push([
				`${a.item ?? "the item"} on ${p} ${m[1]} ${m[2]}`,
				m[1] as "left" | "right",
			]);
	}
	if (Math.abs(b.shoulder_tilt) >= 0.15)
		items.push([
			`the LOWER shoulder (${p} ${b.shoulder_tilt > 0 ? "right" : "left"})`,
			b.shoulder_tilt > 0 ? "right" : "left",
		]);
	if (Math.abs(b.head_tilt) >= 0.15)
		items.push([
			`the side the head tilts toward (${p} ${b.head_tilt > 0 ? "right" : "left"})`,
			b.head_tilt > 0 ? "right" : "left",
		]);
	if (!items.length) return "";
	return [
		"PLACEMENT PER VIEW (exact):",
		`- FRONT view (left figure): ${items.map(([what, own]) => `${what} → ${front(own)}`).join("; ")}.`,
		`- BACK view (right figure): ${items.map(([what, own]) => `${what} → ${back(own)}`).join("; ")}.`,
	].join("\n");
}

/**
 * Full character description for GPT Image (no 512-token encoder limit): nothing clipped, sides unambiguous,
 * worn items and asymmetries listed one by one so both views carry them.
 */
export function gptCharacterPrompt(
	card: CharacterCard,
	style: string,
	extra?: string,
): string {
	const d = card.description;
	const lk = card.look;
	const b = bodyOf(card);
	const born = card.core.dna.born_differences ?? [];
	const p = pronoun(d.gender);
	const own = (v: number) => (v > 0 ? "right" : "left");
	const bl = lk.blocking;
	return [
		`CHARACTER: ${card.meta.name}, ${ageWords(d.age)} ${d.gender.toLowerCase()}, ${card.core.dna.species.toLowerCase()}. ${d.physical.height_build}`,
		`BODY: ${bodyWords(b)}.${Math.abs(b.shoulder_tilt) >= 0.15 ? ` The shoulder line slopes: ${p} ${own(b.shoulder_tilt)} shoulder sits clearly lower than the other, in both views.` : ""}${Math.abs(b.head_tilt) >= 0.15 ? ` ${p[0].toUpperCase() + p.slice(1)} head is canted toward ${p} ${own(b.head_tilt)} shoulder.` : ""} ${b.why}`,
		born.length ? `BORN WITH: ${born.join("; ")}.` : "",
		`FACE: ${d.physical.face}`,
		`HAIR: ${d.physical.hair}`,
		`OUTFIT (inner to outer): ${lk.outfit.map((o) => o.piece).join("; ")}.`,
		bl && bl.footwear_left !== bl.footwear_right
			? `FOOTWEAR: mismatched — ${colourName(bl.footwear_left)} on ${p} left foot, ${colourName(bl.footwear_right)} on ${p} right foot (see the outfit for materials).`
			: "",
		bl?.accessories?.length
			? `WORN ITEMS: ${bl.accessories.map((a) => `${a.item ?? "item"} on ${p} ${a.where.replace("_", " ")}`).join("; ")}.`
			: "",
		`MARKS: ${lk.marks.map((m) => `${m.mark} — ${m.location}`).join("; ")}.`,
		`SIGNATURE ITEM, worn or carried on the body: ${lk.signature_item.item}.`,
		`WEAR AND CARE: ${lk.perfection}`,
		// What a stranger must read in 3 seconds steers the face and stance (a villain must look dangerous, not pitiable).
		`READS AT A GLANCE (show it in the face, gaze and stance): ${lk.story_reads.join(" ")}`,
		pushedLine(card),
		`COLOURS: ${lk.palette.map((c) => `${c.name} ${c.hex}`).join(", ")}. ${CLEAN_COLOUR}.`,
		`MUST KEEP: ${lk.turnaround_notes}`,
		sideNote(p),
		perViewPlacement(card),
		`STYLE: ${style}. Not photorealistic unless the style says so. ${FEW_DETAILS}. ${WHOLE_ITEMS}. ${NOT_IDEALIZED}. ${ONLY_FIGURES}. ${BACKGROUND}, no text, no labels.`,
		alsoLine(extra),
	]
		.filter(Boolean)
		.join("\n");
}

/** Instruction for the GPT editor when the reference is our colour block-in. */
function gptBlockInPrompt(
	card: CharacterCard,
	prompt: string,
	style: string,
): string {
	const b = card.look.body;
	const own = (v: number) => (v > 0 ? "right" : "left");
	const blobs = (card.look.blocking?.accessories ?? [])
		.filter((a) => a.item)
		.map((a) => `${a.where.replace("_", " ")} = ${a.item}`);
	return [
		"Repaint this colour block-in into a finished character model sheet. Keep exactly: the pose, proportions, the two figures' positions, each colour zone, and every accessory in the same place on the body in both views.",
		Math.abs(b.shoulder_tilt) >= 0.15
			? `Keep the sloping shoulder line: the character's ${own(b.shoulder_tilt)} shoulder sits clearly lower than the other, in both views.`
			: "",
		blobs.length ? `Blobs in the block-in are: ${blobs.join("; ")}.` : "",
		`Match the art style exactly: ${style}. Not photorealistic unless that style says so.`,
		`Replace the mannequin with the character described:\n${prompt}`,
	]
		.filter(Boolean)
		.join("\n");
}

/**
 * Builds a compact image prompt for an A-pose model sheet. Z-Image reads at most 512 tokens and silently
 * drops the rest, so the budget is ~1700 characters and the order is by importance: what gets cut last
 * matters least. Pose and proportions are already in the skeleton, so the text spends nothing on them
 * beyond the asymmetries the skeleton can't show.
 */
export function buildTposePrompt(
	c: CharacterCard,
	opts: ConceptOptions = {},
): string {
	const d = c.description;
	const lk = c.look;
	const views = opts.views ?? DEFAULT_VIEWS;
	const facing =
		views === "front"
			? "Face straight to camera, eyes forward"
			: "Front: face straight to camera, eyes forward; back: seen squarely from behind";
	const layout = opts.poseImage
		? "one full-body figure in exactly the pose of the control image"
		: `${VIEW_TEXT[views]}, A-pose, arms angled down. ${facing}. Left/right mean ${pronoun(d.gender)} own sides`;
	return [
		bindingMarks(c, 90),
		`Character model sheet, ${layout}. Style: ${clip(resolveStyle(c, opts.style), 100)}.`,
		`${c.meta.name}, ${ageWords(d.age)} ${d.gender.toLowerCase()}, ${c.core.dna.species.toLowerCase()}: ${clip(d.physical.height_build, 70)}; ${bodyWords(bodyOf(c))}.`,
		`Must keep: ${clip(lk.turnaround_notes, 200)}.`,
		`Face: ${clip(d.physical.face, 100)}. Hair: ${clip(d.physical.hair, 90)}.`,
		`Marks: ${lk.marks.map((m) => `${clip(m.mark, 55)} (${clip(m.location, 35)})`).join("; ")}.`,
		`Wear and care: ${clip(lk.perfection, 90)}.`,
		`Wearing: ${lk.outfit.map((o) => clip(o.piece, 60)).join("; ")}.`,
		`Signature item, worn or carried: ${clip(lk.signature_item.item, 80)}.`,
		`Colours: ${lk.palette.map((p) => p.name).join(", ")}; clean, clear colour, wear as shape, not grime.`,
		`${NOT_IDEALIZED}. ${ONLY_FIGURES}. ${BACKGROUND}, no text.`,
		alsoLine(opts.extra),
	]
		.filter(Boolean)
		.join("\n");
}

// Hands empty and still: Gennady's sheet raised a hand to show its mark and held a controller from his story.
const GPT_SKELETON_LAYOUT =
	"The reference image is an OpenPose skeleton (coloured stick figures on black): use it for the exact poses, positions and proportions. Do not draw the skeleton itself. Character model sheet: two full-body views of the SAME person side by side, same scale, A-pose with both arms angled down and away from the body, hands empty, open and relaxed, fingers slightly apart so each one reads; nothing held, no gesture — LEFT figure = front view, face looking straight at the camera, eyes forward; RIGHT figure = seen squarely from behind. Identical outfit, items and asymmetries in both views.";

/**
 * The exact text the image model gets for these options. The real run and the dry run both use it, so a dry run
 * shows what will be sent. GPT Image (the default) gets the full description; the other modes the compact prompt.
 */
export function conceptPrompt(
	card: CharacterCard,
	opts: ConceptOptions = {},
	plan = conceptPlan(card, opts),
): string {
	const style = resolveStyle(card, opts.style);
	// The compact prompt opens with the binding marks itself; the GPT prompts get them first, before the layout.
	const prompt =
		"poseImage" in plan || plan.mode !== "gpt"
			? buildTposePrompt(card, opts)
			: [
					bindingMarks(card),
					// The GPT editor takes the reference as a guide, so it gets an explicit instruction about what to keep.
					plan.figure === "skeleton"
						? `${GPT_SKELETON_LAYOUT}\n${gptCharacterPrompt(card, style, opts.extra)}`
						: gptBlockInPrompt(card, buildTposePrompt(card, opts), style),
				]
					.filter(Boolean)
					.join("\n");
	return [retakeLine(opts.retake), prompt].filter(Boolean).join("\n");
}

/** Which pipeline and figure these options pick; the prompt and the real run both read it, so they never disagree. */
type ConceptPlan =
	| { poseImage: string }
	| {
			views: PoseLayout;
			mode: NonNullable<ConceptOptions["control"]>;
			figure: FigureStyle;
	  };

function conceptPlan(card: CharacterCard, opts: ConceptOptions): ConceptPlan {
	if (opts.poseImage) return { poseImage: opts.poseImage };
	const views = opts.views ?? DEFAULT_VIEWS;
	if (views === "front-side-back")
		throw new Error(
			"Pose-controlled sheets support views 'front' or 'front-back'.",
		);
	// Default (best in tests): our skeleton as the pose reference for GPT Image + the full, unclipped description.
	const mode = opts.control ?? "gpt";
	const figure =
		opts.figure ??
		(mode === "gpt"
			? "skeleton"
			: card.look.blocking
				? "blocking-lit"
				: "shaded");
	return { views, mode, figure };
}

/** One thing the card says the sheet must show, and whether the vision model saw it. */
export interface CheckedItem {
	item: string;
	/** A defining mark (see definingMarks): missing, it costs one retake. */
	defining: boolean;
	visible: boolean;
	/** What the vision model saw there, in a few words. */
	seen: string;
}

/** The sheet checked against its card (#61): saved as prompts/<sheet>-check.json, read by character_next. */
export interface ConceptCheck {
	items: CheckedItem[];
	/** What the kept sheet doesn't show, defining marks first; empty when everything is there. */
	missing: string[];
	/** True when a defining mark was missing, so a second sheet was made and the better one kept. */
	retaken: boolean;
}

/** What to look for: the defining marks first, then the other marks, then each MUST KEEP sentence. */
export function checkItems(
	card: CharacterCard,
): Omit<CheckedItem, "visible" | "seen">[] {
	const defining = definingMarks(card);
	return [
		...defining.map((m) => ({ item: markText(m), defining: true })),
		...card.look.marks
			.filter((m) => !defining.includes(m))
			.map((m) => ({ item: markText(m), defining: false })),
		// Not from the card: a glitch any sheet can have, reported like a missing mark.
		{ item: `${WHOLE_ITEMS}.`, defining: false },
		...card.look.turnaround_notes
			.split(/(?<=[.!?])\s+/)
			.map((t) => t.trim())
			.filter(Boolean)
			.map((item) => ({ item, defining: false })),
	];
}

export const checkQuestion = (items: { item: string }[]) =>
	[
		"This picture is a character model sheet: a front view and a back view of one character. For each numbered item below, does the picture show it as written?",
		"Answer one line per item, in order: the number, then yes or no, then at most twelve words on what you actually see there. Judge the main fact of each item, not its finish: a loss counts as shown when the part clearly lacks what the item says is gone, even if the exact count or a described shine or scar texture is hard to read; a hand drawn whole, with all five fingers, where the item says some are missing is a no. If an item needs a view the sheet doesn't have, or is hidden by design (under clothing), answer yes.",
		...items.map((x, i) => `${i + 1}. ${x.item}`),
	].join("\n");

/** The vision model's lines matched back to the items; an item it skipped counts as seen (only a clear no is missing). */
export function parseCheck(
	answer: string,
	items: Omit<CheckedItem, "visible" | "seen">[],
): CheckedItem[] {
	const said = new Map<number, { yes: boolean; seen: string }>();
	for (const line of answer.split("\n")) {
		const m = /^\W*(\d+)\W+(yes|no)\b\W*(.*)$/i.exec(line);
		if (m)
			said.set(Number(m[1]) - 1, {
				yes: m[2].toLowerCase() === "yes",
				seen: m[3].trim(),
			});
	}
	return items.map((x, i) => ({
		...x,
		visible: said.get(i)?.yes ?? true,
		seen: said.get(i)?.seen ?? "",
	}));
}

const lostDefining = (c: CheckedItem[]) =>
	c.filter((x) => x.defining && !x.visible);
const lost = (c: CheckedItem[]) => c.filter((x) => !x.visible);

/** One vision request: the sheet against the card. Its cost goes to the ledger as part of the concept. */
async function checkSheet(
	id: string,
	card: CharacterCard,
	bytes: Buffer,
): Promise<CheckedItem[]> {
	const items = checkItems(card);
	const url = await falUpload(bytes, "image/png", "concept-check.png");
	const answer = await askVision(
		id,
		checkQuestion(items),
		url,
		"concept checked against the card",
		"concept",
	);
	return parseCheck(answer, items);
}

/** The check in one line for the tool and the CLI: a missing mark is said plainly, never passed over. */
export function checkText(check: ConceptCheck | { reason: string }): string {
	if (!("items" in check)) return check.reason;
	const after = check.retaken ? ", after one retake for a lost mark" : "";
	return check.missing.length
		? `Checked against the card${after}: the sheet does NOT show ${check.missing.join("; ")}. Tell the user; fix it with another take (extra saying what to change) or by hand.`
		: `Checked against the card${after}: every mark and must-keep item is there.`;
}

export type ConceptResult =
	| { generated: false; prompt: string; reason: string }
	| {
			generated: true;
			prompt: string;
			file: string;
			/** The sheet checked against the card, or why it couldn't be. */
			check: ConceptCheck | { reason: string };
			/** The head-and-shoulders crop made from the sheet, or why there is none. */
			avatar: Avatar | { reason: string };
			card: string;
			image: GeneratedImage;
	  };

/**
 * The sheet's file in assets/: concept.png is the card's concept; another style or a custom pose is an extra sheet
 * next to it (concept-<style>.png, concept-pose[-<style>].png).
 */
export function conceptFileName(style?: string, pose = false): string {
	// A style named "pose…" must not take the pose sheet's name.
	const slug = style
		? `-${slugify(style === "card" ? "card-style" : style)
				.replace(/^pose/, "style-pose")
				.slice(0, 40)}`
		: "";
	return `concept${pose ? "-pose" : ""}${slug}.png`;
}

/** The whole concept pipeline, shared by the MCP tool and the CLI. */
export async function generateConcept(
	id: string,
	opts: ConceptOptions & { dryRun?: boolean } = {},
): Promise<ConceptResult> {
	const card = await loadCard(id);
	if (opts.dryRun)
		return {
			generated: false,
			prompt: conceptPrompt(card, opts),
			reason:
				"Dry run: this is the exact prompt the real run would send. It goes with a pose reference image built from the card (not uploaded in a dry run), so it is for checking, not for another generator.",
		};
	if (!apiKey())
		return {
			generated: false,
			prompt: buildTposePrompt(card, opts),
			reason:
				"No fal API key is set, so only the prompt was built: the A-pose prompt for any image model.",
		};
	const draw = async (o: ConceptOptions) => {
		const image = await generateImage(card, o);
		await recordCost(id, {
			kind: "concept",
			model: image.model,
			detail: o.retake ? "model sheet, retake for a lost mark" : "model sheet",
			usd: config().pricing.concept.image,
		});
		// A failed check never fails the paid sheet.
		const checked = await checkSheet(id, card, image.bytes).catch(
			(e: Error) => ({ reason: e.message }),
		);
		return { image, checked };
	};
	let { image, checked } = await draw(opts);
	let retaken = false;
	if (Array.isArray(checked) && lostDefining(checked).length) {
		// One retake, with what was lost first and binding; the better sheet is kept.
		const again = await draw({
			...opts,
			retake: lostDefining(checked).map((x) => x.item),
		});
		retaken = true;
		const score = (c: typeof checked) =>
			Array.isArray(c)
				? lostDefining(c).length * 100 + lost(c).length
				: Number.POSITIVE_INFINITY;
		if (score(again.checked) <= score(checked)) ({ image, checked } = again);
	}
	const check: ConceptCheck | { reason: string } = Array.isArray(checked)
		? {
				items: checked,
				missing: [
					...lostDefining(checked),
					...lost(checked).filter((x) => !x.defining),
				].map((x) => x.item),
				retaken,
			}
		: {
				reason: `The sheet wasn't checked against the card: ${checked.reason}`,
			};
	const name = conceptFileName(opts.style, Boolean(opts.poseImage));
	const file = await saveConcept(id, image.bytes, image.prompt, name);
	if ("items" in check)
		await savePrompt(id, checkName(name), JSON.stringify(check, null, 2));
	// The avatar is free and never fails the paid sheet.
	const avatar =
		opts.avatar === false
			? { reason: "not asked for (avatar: false)." }
			: await makeAvatar(id, name, { sheet: image.bytes, card }).catch(
					(e: Error) => ({ reason: e.message }),
				);
	const saved = await writeCard(card);
	return {
		generated: true,
		prompt: image.prompt,
		file,
		check,
		avatar,
		card: saved.files.markdown,
		image,
	};
}

export interface GeneratedImage {
	bytes: Buffer;
	mimeType: string;
	provider: string;
	model: string;
	seed?: number;
	/** The prompt actually sent to the model (the GPT path uses the full description, not the compact one). */
	prompt: string;
}

/** Our own A-pose figure as the reference (GPT Image by default), or the pose taken from a picture the user gives. */
async function generateImage(
	card: CharacterCard,
	opts: ConceptOptions,
): Promise<GeneratedImage> {
	const plan = conceptPlan(card, opts);
	let control: {
		imageUrl: string;
		width: number;
		height: number;
		preprocess: "pose" | "depth" | "canny" | "img2img" | "gpt";
	};
	if ("poseImage" in plan) {
		control = {
			imageUrl: await toImageUrl(plan.poseImage),
			width: 1024,
			height: 1536,
			preprocess: "pose",
		};
	} else {
		const { views, mode, figure } = plan;
		const mq = mannequinPng(views, bodyOf(card), figure, card.look.blocking);
		const imageUrl = await falUpload(
			mq.png,
			"image/png",
			`mannequin-${figure}-${views}.png`,
		);
		control = {
			imageUrl,
			width: mq.width,
			height: mq.height,
			preprocess: mode,
		};
	}
	const finalPrompt = conceptPrompt(card, opts, plan);
	const r = await falControlGenerate({
		prompt: finalPrompt,
		...control,
		seed: opts.seed,
		controlScale: opts.controlScale,
		strength: opts.strength,
		retake: Boolean(opts.retake?.length),
	});
	return {
		bytes: r.bytes,
		mimeType: r.mimeType,
		provider: "fal",
		model: r.model,
		seed: r.seed,
		prompt: finalPrompt,
	};
}

/**
 * Uses a concept the user already has (a file path or URL) as the character's concept.png instead of generating
 * one. The card's look should already describe it (the designer works from the image); the card is re-rendered.
 */
export async function importConcept(
	id: string,
	image: string,
): Promise<{ file: string; card: string }> {
	await loadCard(id); // the character must exist
	const { bytes } = await readUserImage(image);
	const file = await saveConcept(id, bytes, `${IMPORTED}${image}`);
	const saved = await writeCard(await loadCard(id));
	return { file, card: saved.files.markdown };
}

/** Keeps the tournament winner (see pickWinner); a character started from the user's own picture gets it as its concept. */
export async function keepWinner(winner: string): Promise<{
	winner: string;
	dir: string;
	deleted: string[];
	concept?: string;
}> {
	const r = await pickWinner(winner);
	const image = (await loadCard(r.winner)).meta.concept_image;
	return image
		? { ...r, concept: (await importConcept(r.winner, image)).file }
		: r;
}
