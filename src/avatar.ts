import { readFile } from "node:fs/promises";
import { cropRaster, decodePng, encodePng, type Raster } from "./png.js";
import { type BodyShape, type PoseLayout, place, sheetFrame } from "./pose.js";
import { bodyOf } from "./schema.js";
import {
	assetFile,
	avatarName,
	IMPORTED,
	loadCard,
	promptFile,
	promptName,
	type StoredCard,
	saveAsset,
	writeCard,
} from "./store.js";

/**
 * The avatar: a square crop of the front view's head and shoulders, cut from a concept sheet with no model call.
 * The card's skeleton says which figure is the front view, roughly where its head is and how many heads tall it is;
 * the picture says where the head really landed (GPT Image stretches the figure to ~97% of the sheet height, the
 * skeleton uses 84%, so the skeleton alone misses by a head or more).
 */

/** A square box as fractions of the sheet: x and w of its width, y of its height. */
export interface AvatarBox {
	x: number;
	y: number;
	w: number;
}
/** silhouette: found on the picture; skeleton: the picture didn't allow it, so the card's geometry; box: given by hand. */
export type AvatarMethod = "silhouette" | "skeleton" | "box";
export { avatarName };
export interface Avatar {
	file: string;
	box: AvatarBox;
	method: AvatarMethod;
}

/**
 * The frame, in head heights (crown to chin): the face's centre in the middle, so a circle cut from the square still
 * shows the whole face, with the head, the neck and the top of the shoulders around it, whatever the proportions.
 */
const SIDE = 1.6;
const FACE = 0.55;

/** Where the head is, in sheet pixels: the crown, the head's centre line and one head height. */
interface Head {
	crown: number;
	cx: number;
	head: number;
}

/** The front figure's head as the skeleton placed it, scaled to this picture. */
function skeletonHead(img: Raster, body: BodyShape): Head {
	const layout: PoseLayout = img.width > img.height ? "front-back" : "front";
	const f = sheetFrame(layout, body);
	const pts = place(f.unit, "front", f.views[0][1], f.top, f.figH);
	// The face's centre (nose and eyes) sits about half a head below the crown.
	const [fx, fy] = [0, 14, 15]
		.map((i) => pts[i])
		.reduce((a, p) => [a[0] + p[0] / 3, a[1] + p[1] / 3], [0, 0]);
	const sx = img.width / f.width;
	const sy = img.height / f.height;
	const head = (f.figH / body.head_heights) * sy;
	return { crown: fy * sy - head / 2, cx: fx * sx, head };
}

/**
 * The head as drawn: the sheet's background is plain (the prompt asks for light grey), so the front figure's crown
 * and soles are the first and last rows that differ from it. Texture counts too, or silver hair on grey is lost.
 * Undefined when the background isn't plain or nothing sensible is found.
 */
function drawnHead(img: Raster, guess: Head, heads: number): Head | undefined {
	const { width: w, height: h, channels: ch, data } = img;
	const bg = background(img);
	if (!bg) return;
	const at = (x: number, y: number) => (y * w + x) * ch;
	const diff = (p: number, q: number[] | number) => {
		let d = 0;
		for (let c = 0; c < 3; c++)
			d += Math.abs(data[p + c] - (typeof q === "number" ? data[q + c] : q[c]));
		return d;
	};
	const figure = (x: number, y: number) => {
		const p = at(x, y);
		if (ch === 4 && data[p + 3] < 128) return false;
		return (
			diff(p, bg) > 24 ||
			(x + 2 < w && diff(p, at(x + 2, y)) > 24) ||
			(y + 2 < h && diff(p, at(x, y + 2)) > 24)
		);
	};
	/** One row of the figure between two x's: how many pixels, their sum of x, and the outermost two. */
	const scan = (y: number, from: number, to: number) => {
		const r = { n: 0, sum: 0, left: -1, right: -1 };
		for (
			let x = Math.max(0, Math.round(from));
			x < Math.min(w, Math.round(to));
			x++
		)
			if (figure(x, y)) {
				r.n++;
				r.sum += x;
				if (r.left < 0) r.left = x;
				r.right = x;
			}
		return r;
	};
	const busy = (y: number, from: number, to: number) =>
		scan(y, from, to).n >= 4;
	let crown = 0;
	while (
		crown < h / 2 &&
		!busy(crown, guess.cx - 1.2 * guess.head, guess.cx + 1.2 * guess.head)
	)
		crown++;
	// The front figure is the left half of a front-and-back sheet.
	let soles = h - 1;
	while (soles > crown && !busy(soles, 0, w > h ? w / 2 : w)) soles--;
	// Only a first estimate: models draw bodies in their own proportions (a child came out ~1.4 heads too tall).
	const head = (soles - crown) / heads;
	if (crown >= h / 2 || head < h / 40) return;
	// The head's centre line: the middle of the figure just below the crown, settled twice from the skeleton's guess.
	let cx = guess.cx;
	for (let pass = 0; pass < 2; pass++) {
		let sum = 0;
		let n = 0;
		for (let y = crown; y < Math.min(h, crown + head); y++) {
			const r = scan(y, cx - 0.8 * head, cx + 0.8 * head);
			sum += r.sum;
			n += r.n;
		}
		if (!n) return;
		cx = sum / n;
	}
	// The head as drawn ends at the neck: the narrowest row below the widest one (the top of the head is narrow too).
	const widths: number[] = [];
	for (let y = crown; y < Math.min(h, crown + 2 * head); y++) {
		const r = scan(y, cx - 1.5 * head, cx + 1.5 * head);
		widths.push(r.n ? r.right - r.left : 0);
	}
	const top = widths.slice(0, Math.round(head));
	const widest = top.indexOf(Math.max(...top));
	let neck = widest;
	for (let i = widest; i < Math.min(widths.length, widest + head); i++)
		if (widths[i] > 0 && widths[i] < widths[neck]) neck = i;
	return {
		crown,
		cx,
		head: neck > 0.6 * head && neck < 1.6 * head ? neck : head,
	};
}

/** The square around a head, as fractions of the sheet; it may reach past the top edge (filled when cropped). */
function frame(img: Raster, { crown, cx, head }: Head): AvatarBox {
	const side = Math.min(SIDE * head, img.width, img.height);
	const round = (v: number) => Math.round(v * 10000) / 10000;
	return {
		x: round((cx - side / 2) / img.width),
		y: round((crown + FACE * head - side / 2) / img.height),
		w: round(side / img.width),
	};
}

/** The avatar box for a forge-made sheet of this body, found on the picture, or from the skeleton if it can't be. */
export function findAvatarBox(
	img: Raster,
	body: BodyShape,
): { box: AvatarBox; method: AvatarMethod } {
	const guess = skeletonHead(img, body);
	const drawn = drawnHead(img, guess, body.head_heights);
	return drawn
		? { box: frame(img, drawn), method: "silhouette" }
		: { box: frame(img, guess), method: "skeleton" };
}

/** The sheet's plain background colour: the mean of a small patch in each corner; undefined if the corners differ. */
function background(img: Raster): number[] | undefined {
	const patches = [
		[0, 0],
		[img.width - 8, 0],
		[0, img.height - 8],
		[img.width - 8, img.height - 8],
	].map(([cx, cy]) => {
		const sum = [0, 0, 0, 0];
		let n = 0;
		for (let y = Math.max(0, cy); y < Math.min(img.height, cy + 8); y++)
			for (let x = Math.max(0, cx); x < Math.min(img.width, cx + 8); x++) {
				const o = (y * img.width + x) * img.channels;
				for (let c = 0; c < img.channels; c++) sum[c] += img.data[o + c];
				n++;
			}
		return sum.map((v) => v / Math.max(1, n));
	});
	const spread = (p: number[]) =>
		[0, 1, 2].reduce((d, c) => d + Math.abs(p[c] - patches[0][c]), 0);
	if (patches.some((p) => spread(p) > 30)) return;
	return [0, 1, 2, 3].map((c) =>
		Math.round(patches.reduce((a, p) => a + p[c], 0) / 4),
	);
}

/**
 * Crops a box (fractions; square in pixels) out of a picture. The box may reach past the edges, which get the
 * background colour; a box whose centre is off the picture is refused, not guessed.
 */
export function cropAvatar(img: Raster, box: AvatarBox): Buffer {
	const { x, y, w } = box;
	const side = w * img.width;
	const [cx, cy] = [x + w / 2, y + side / img.height / 2];
	if (
		![x, y, w].every(Number.isFinite) ||
		w <= 0 ||
		w > 1 ||
		cx < 0 ||
		cx > 1 ||
		cy < 0 ||
		cy > 1
	)
		throw new Error(
			`The box ${JSON.stringify(box)} doesn't fit the ${img.width}×${img.height} sheet: x, y, w are fractions (x and w of the width, y of the height), w at most 1, and the square's centre must be on the sheet.`,
		);
	return encodePng(
		cropRaster(
			img,
			x * img.width,
			y * img.height,
			side,
			side,
			background(img) ?? [255, 255, 255, 255],
		),
	);
}

/** Why a sheet has no figure of ours to find the head by, if it has none. */
async function noFigure(
	id: string,
	conceptFile: string,
): Promise<string | undefined> {
	if (conceptFile.startsWith("concept-pose"))
		return "This sheet takes its pose from a picture, not from the card's figure, so the head can't be found automatically.";
	const prompt = await readFile(
		promptFile(id, promptName(conceptFile)),
		"utf8",
	).catch(() => "");
	if (prompt.startsWith(IMPORTED))
		return "This concept was imported, not drawn on the card's figure, so the head can't be found automatically.";
}

/**
 * Makes (or remakes) the avatar for one of a character's concept sheets, free: found on a forge-made sheet, or the
 * given box. Saved as assets/avatar.png, or avatar-<style>.png next to concept-<style>.png, and card.md is re-rendered.
 * The concept pipeline passes the sheet it just made and its card, and re-renders the card itself.
 */
export async function makeAvatar(
	id: string,
	conceptFile = "concept.png",
	opts: { box?: AvatarBox; sheet?: Buffer; card?: StoredCard } = {},
): Promise<Avatar> {
	// Loading the card first also moves an old flat-layout folder into assets/ and prompts/.
	const card = opts.card ?? (await loadCard(id));
	const { box } = opts;
	const [sheet, why] = await Promise.all([
		opts.sheet ??
			readFile(assetFile(id, conceptFile)).catch(() => {
				throw new Error(`No ${conceptFile} for "${id}" yet.`);
			}),
		box ? undefined : noFigure(id, conceptFile),
	]);
	if (why) throw new Error(`${why} Pass a box { x, y, w } to crop it.`);
	let img: Raster;
	try {
		img = decodePng(sheet);
	} catch (e) {
		throw new Error(
			`${conceptFile} can't be cropped: ${(e as Error).message} (an imported picture may be a JPEG or WebP).`,
		);
	}
	const found = box
		? { box, method: "box" as const }
		: findAvatarBox(img, bodyOf(card));
	const file = await saveAsset(
		id,
		avatarName(conceptFile),
		cropAvatar(img, found.box),
	);
	if (!opts.card) await writeCard(card);
	return { file, ...found };
}

/** One line on the avatar a concept came with, or why it has none. */
export const avatarText = (a: Avatar | { reason: string }) =>
	"reason" in a
		? `No avatar: ${a.reason}`
		: `Avatar (free, ${a.method}): ${a.file}, box ${JSON.stringify(a.box)}`;
