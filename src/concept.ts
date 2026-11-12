import { apiKey, config } from "./config.js";
import { recordCost } from "./costs.js";
import { falControlGenerate, falUpload, toImageUrl } from "./fal.js";
import { type FigureStyle, mannequinPng } from "./pose.js";
import { type CharacterCard, slugify } from "./schema.js";
import { loadCard, pickWinner, saveConcept, writeCard } from "./store.js";
import { readUserImage } from "./userimage.js";

export const VIEWS = ["front", "front-back", "front-side-back"] as const;
export type Views = (typeof VIEWS)[number];
export const DEFAULT_VIEWS: Views = "front-back";

export interface ConceptOptions {
	/** Overrides visual.art_style from the card. */
	style?: string;
	views?: Views;
	/** Free-form additions appended to the prompt. */
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
}

/** The body's numbers as words an image model follows; only deviations from average are named. */
export function bodyWords(b: CharacterCard["look"]["body"]): string {
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

/** Image models beautify by default; the card's flaws only survive if we say so. */
export const NOT_IDEALIZED =
	"Not idealized: a real, specific person with asymmetries, uneven features, real skin texture, every flaw and mark";

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
 * One house style for every concept, so a library reads as one project. Pass `style` to see the same character in
 * another look (`"card"` = the designer's suggestion in look.art_style); those sheets are saved next to concept.png.
 */
export const DEFAULT_ART_STYLE =
	"Stylized 3D game character render, hand-painted textures, slightly exaggerated proportions, soft studio light";

export function resolveStyle(card: CharacterCard, style?: string): string {
	return !style
		? DEFAULT_ART_STYLE
		: style === "card"
			? card.look.art_style
			: style;
}

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
export function gptCharacterPrompt(card: CharacterCard, style: string): string {
	const d = card.description;
	const lk = card.look;
	const b = lk.body;
	const p = pronoun(d.gender);
	const own = (v: number) => (v > 0 ? "right" : "left");
	const bl = lk.blocking;
	return [
		`CHARACTER: ${card.meta.name}, ${d.age}-year-old ${d.gender.toLowerCase()}, ${d.species.toLowerCase()}. ${d.physical.height_build}`,
		`BODY: ${bodyWords(b)}.${Math.abs(b.shoulder_tilt) >= 0.15 ? ` The shoulder line slopes: ${p} ${own(b.shoulder_tilt)} shoulder sits clearly lower than the other, in both views.` : ""}${Math.abs(b.head_tilt) >= 0.15 ? ` ${p[0].toUpperCase() + p.slice(1)} head is canted toward ${p} ${own(b.head_tilt)} shoulder.` : ""} ${b.why}`,
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
		`SIGNATURE ITEM, also drawn on its own beside the figures: ${lk.signature_item.item}.`,
		`WEAR AND CARE: ${lk.perfection}`,
		// What a stranger must read in 3 seconds steers the face and stance (a villain must look dangerous, not pitiable).
		`READS AT A GLANCE (show it in the face, gaze and stance): ${lk.story_reads.join(" ")}`,
		`COLOURS: ${lk.palette.map((c) => `${c.name} ${c.hex}`).join(", ")}.`,
		`MUST KEEP: ${lk.turnaround_notes}`,
		sideNote(p),
		perViewPlacement(card),
		`STYLE: ${style}. Not photorealistic unless the style says so. ${NOT_IDEALIZED}. Plain light-grey background, no text, no labels.`,
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
		`Character model sheet, ${layout}. Style: ${clip(resolveStyle(c, opts.style), 100)}.`,
		`${c.meta.name}, ${d.age}-year-old ${d.gender.toLowerCase()}, ${d.species.toLowerCase()}: ${clip(d.physical.height_build, 70)}; ${bodyWords(lk.body)}.`,
		`Must keep: ${clip(lk.turnaround_notes, 200)}.`,
		`Face: ${clip(d.physical.face, 100)}. Hair: ${clip(d.physical.hair, 90)}.`,
		`Marks: ${lk.marks.map((m) => `${clip(m.mark, 55)} (${clip(m.location, 35)})`).join("; ")}.`,
		`Wear and care: ${clip(lk.perfection, 90)}.`,
		`Wearing: ${lk.outfit.map((o) => clip(o.piece, 60)).join("; ")}.`,
		`Signature item: ${clip(lk.signature_item.item, 80)}${opts.poseImage ? "" : ", also drawn beside the figure"}.`,
		`Colours: ${lk.palette.map((p) => p.name).join(", ")}.`,
		`${NOT_IDEALIZED}. Plain light-grey background, no text.`,
		opts.extra ? `Also: ${opts.extra.trim()}` : "",
	]
		.filter(Boolean)
		.join("\n");
}

export type ConceptResult =
	| { generated: false; prompt: string; reason: string }
	| {
			generated: true;
			prompt: string;
			file: string;
			card: string;
			image: GeneratedImage;
	  };

/** The whole concept pipeline, shared by the MCP tool and the CLI. */
export async function generateConcept(
	id: string,
	opts: ConceptOptions & { dryRun?: boolean } = {},
): Promise<ConceptResult> {
	const card = await loadCard(id);
	const prompt = buildTposePrompt(card, opts);
	if (opts.dryRun || !apiKey()) {
		return {
			generated: false,
			prompt,
			reason: opts.dryRun
				? "Dry run."
				: "No fal API key is set, so only the prompt was built.",
		};
	}
	const image = await generateImage(
		prompt,
		card,
		opts.views ?? DEFAULT_VIEWS,
		opts,
	);
	await recordCost(id, {
		kind: "concept",
		model: image.model,
		detail: "model sheet",
		usd: config().pricing.concept.image,
	});
	// The A-pose sheet is the card's concept; a custom pose is an extra sheet next to it.
	const styleSlug = opts.style
		? `-${slugify(opts.style === "card" ? "card-style" : opts.style).slice(0, 40)}`
		: "";
	const file = await saveConcept(
		id,
		image.bytes,
		image.prompt,
		opts.poseImage
			? `concept-pose${styleSlug}.png`
			: styleSlug
				? `concept${styleSlug}.png`
				: undefined,
	);
	const saved = await writeCard(card);
	return {
		generated: true,
		prompt: image.prompt,
		file,
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
	prompt: string,
	card: CharacterCard,
	views: Views,
	opts: ConceptOptions,
): Promise<GeneratedImage> {
	let control: {
		imageUrl: string;
		width: number;
		height: number;
		preprocess: "pose" | "depth" | "canny" | "img2img" | "gpt";
	};
	if (opts.poseImage) {
		control = {
			imageUrl: await toImageUrl(opts.poseImage),
			width: 1024,
			height: 1536,
			preprocess: "pose",
		};
	} else {
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
		const mq = mannequinPng(views, card.look.body, figure, card.look.blocking);
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
	const style = resolveStyle(card, opts.style);
	const layout =
		"Character model sheet: two full-body views of the SAME person side by side, same scale, A-pose with arms angled down — LEFT figure = front view, face looking straight at the camera, eyes forward; RIGHT figure = seen squarely from behind. Identical outfit, items and asymmetries in both views.";
	// The GPT editor takes the reference as a guide, so it gets an explicit instruction about what to keep.
	const finalPrompt =
		control.preprocess === "gpt"
			? (opts.figure ?? "skeleton") === "skeleton"
				? `The reference image is an OpenPose skeleton (coloured stick figures on black): use it for the exact poses, positions and proportions. Do not draw the skeleton itself. ${layout}\n${gptCharacterPrompt(card, style)}`
				: gptBlockInPrompt(card, prompt, style)
			: prompt;
	const r = await falControlGenerate({
		prompt: finalPrompt,
		...control,
		seed: opts.seed,
		controlScale: opts.controlScale,
		strength: opts.strength,
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
	const file = await saveConcept(id, bytes, `IMPORTED from ${image}`);
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
