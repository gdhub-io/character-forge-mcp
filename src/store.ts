import { existsSync } from "node:fs";
import {
	access,
	mkdir,
	readdir,
	readFile,
	rename,
	rm,
	rmdir,
	stat,
	writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { renderMarkdown } from "./render.js";
import {
	type CharacterCard,
	CharacterCardSchema,
	SlugSchema,
	slugify,
} from "./schema.js";

/** Generated images, video and sound live in assets/; every prompt (used or written) lives in prompts/. */
export const ASSETS_DIR = "assets";
export const PROMPTS_DIR = "prompts";
const CONCEPT_FILE = `${ASSETS_DIR}/concept.png`;

export function outputDir(): string {
	const dir =
		process.env.CHARACTER_FORGE_DIR ??
		path.join(os.homedir(), "character-forge");
	return path.resolve(dir.replace(/^~(?=$|\/)/, os.homedir()));
}

/** Tournament variants live here until the judge picks one; the losers are deleted, not kept (see pickWinner). */
export const DRAFTS_DIR = "_drafts";

/** A character's folder: in the library, or among the tournament drafts if that's where it is. */
/** A tournament variant that hasn't been picked yet. */
export const isDraft = (slug: string) =>
	characterDir(slug).startsWith(path.join(outputDir(), DRAFTS_DIR));

export function characterDir(slug: string): string {
	if (!SlugSchema.safeParse(slug).success)
		throw new Error(`Invalid character id: ${slug}`);
	const main = path.join(outputDir(), slug);
	const draft = path.join(outputDir(), DRAFTS_DIR, slug);
	return !existsSync(main) && existsSync(draft) ? draft : main;
}

const exists = (p: string) =>
	access(p).then(
		() => true,
		() => false,
	);

/** The library's one JSON format: two-space indent, trailing newline. */
export const writeJson = (file: string, data: unknown) =>
	writeFile(file, `${JSON.stringify(data, null, 2)}\n`);

export function assetFile(slug: string, name: string): string {
	return path.join(characterDir(slug), ASSETS_DIR, name);
}

export function promptFile(slug: string, name: string): string {
	return path.join(characterDir(slug), PROMPTS_DIR, name);
}

/** Writes a text prompt into prompts/ and returns its path. */
export async function savePrompt(
	slug: string,
	name: string,
	text: string,
): Promise<string> {
	const file = promptFile(slug, name);
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, text.endsWith("\n") ? text : `${text}\n`);
	return file;
}

/** Writes a generated file into assets/ and, if given, the prompt behind it as prompts/<name>.txt. */
export async function saveAsset(
	slug: string,
	fileName: string,
	bytes: Buffer,
	prompt?: string,
): Promise<string> {
	const file = assetFile(slug, fileName);
	await mkdir(path.dirname(file), { recursive: true });
	await Promise.all([
		writeFile(file, bytes),
		prompt === undefined
			? null
			: savePrompt(
					slug,
					path.join(path.dirname(fileName), `${path.parse(fileName).name}.txt`),
					prompt,
				),
	]);
	return file;
}

const ASSET_EXT = /\.(png|jpe?g|webp|gif|mp4|webm|mov|wav|mp3|ogg|m4a|flac)$/i;

/** Moves files from the old flat layout (concept.png, scene-prompt.txt, media/*.md) into assets/ and prompts/. */
const migrated = new Set<string>();
async function migrateLayout(dir: string): Promise<void> {
	// Once per folder per process: after that the layout is current, and loadCard/listCards run often.
	if (migrated.has(dir)) return;
	migrated.add(dir);
	const names = await readdir(dir).catch(() => [] as string[]);
	const moves: [string, string][] = [];
	for (const n of names) {
		if (ASSET_EXT.test(n)) moves.push([n, path.join(ASSETS_DIR, n)]);
		else if (n.endsWith("-prompt.txt"))
			moves.push([
				n,
				path.join(PROMPTS_DIR, n.replace(/-prompt\.txt$/, ".txt")),
			]);
	}
	if (names.includes("media")) {
		for (const n of await readdir(path.join(dir, "media")).catch(
			() => [] as string[],
		))
			moves.push([path.join("media", n), path.join(PROMPTS_DIR, n)]);
	}
	for (const [from, to] of moves) {
		await mkdir(path.join(dir, path.dirname(to)), { recursive: true });
		if (!(await exists(path.join(dir, to))))
			await rename(path.join(dir, from), path.join(dir, to));
	}
	if (names.includes("media"))
		await rmdir(path.join(dir, "media")).catch(() => {});
}

/** A card that lives in the library: its id is known. */
export type StoredCard = CharacterCard & { meta: { slug: string } };

export type ValidationResult =
	| { ok: true; card: CharacterCard }
	| { ok: false; issues: string };

export function validateCard(input: unknown): ValidationResult {
	const parsed = CharacterCardSchema.safeParse(input);
	return parsed.success
		? { ok: true, card: parsed.data }
		: { ok: false, issues: z.prettifyError(parsed.error) };
}

/** Reads and validates a card.json from any path. Throws with readable issues. */
export async function loadCardFile(file: string): Promise<CharacterCard> {
	const result = validateCard(JSON.parse(await readFile(file, "utf8")));
	if (!result.ok) throw new Error(`Invalid card ${file}:\n${result.issues}`);
	return result.card;
}

export async function loadCard(slug: string): Promise<StoredCard> {
	const file = path.join(characterDir(slug), "card.json");
	if (!(await exists(file)))
		throw new Error(`Character "${slug}" not found in ${outputDir()}`);
	await migrateLayout(characterDir(slug));
	const card = await loadCardFile(file);
	return { ...card, meta: { ...card.meta, slug } };
}

/** The concept image file name relative to the card, if it has been generated. */
async function conceptFileOf(slug: string): Promise<string | undefined> {
	return (await exists(path.join(characterDir(slug), CONCEPT_FILE)))
		? CONCEPT_FILE
		: undefined;
}

/** Markdown of a saved card, without touching disk beyond one existence check. */
export async function cardMarkdown(card: StoredCard): Promise<string> {
	return renderMarkdown(card, {
		conceptFile: await conceptFileOf(card.meta.slug),
	});
}

export interface SavedCharacter {
	slug: string;
	dir: string;
	files: { json: string; markdown: string; concept?: string };
}

/** Saves a card under a new id (name, name-2, ...) or, with overwrite, under its own id. */
export async function saveCard(
	card: CharacterCard,
	opts: { overwrite?: boolean } = {},
): Promise<SavedCharacter> {
	const base = card.meta.slug ?? slugify(card.meta.name);
	let slug = base;
	if (!opts.overwrite) {
		const taken = new Set([
			...(await readdir(outputDir()).catch(() => [] as string[])),
			...(await readdir(path.join(outputDir(), DRAFTS_DIR)).catch(
				() => [] as string[],
			)),
		]);
		for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
	}
	const saved = { ...card, meta: { ...card.meta, slug } };
	// A new tournament variant (meta.variant set) starts as a draft; everything else goes straight into the library.
	const isNew =
		!existsSync(path.join(outputDir(), slug)) &&
		!existsSync(path.join(outputDir(), DRAFTS_DIR, slug));
	await mkdir(
		isNew && card.meta.variant
			? path.join(outputDir(), DRAFTS_DIR, slug)
			: characterDir(slug),
		{ recursive: true },
	);
	return writeCard(saved);
}

/** Translated cards sit next to the English original as card.<lang>.json (the site shows them in that language). */
export const translationFile = (slug: string, lang: string) =>
	path.join(characterDir(slug), `card.${lang}.json`);

/**
 * Saves a translation of a saved card. It must have exactly the original's shape: same keys, same list lengths,
 * and the same numbers, booleans, enums, ids and colours; only free text may differ.
 */
export async function saveTranslation(
	slug: string,
	lang: string,
	input: unknown,
): Promise<string> {
	if (!/^[a-z]{2}$/.test(lang) || lang === "en")
		throw new Error(`Unsupported translation language "${lang}".`);
	const original = await loadCard(slug);
	const v = validateCard(input);
	if (!v.ok) throw new Error(`Invalid translated card:\n${v.issues}`);
	const card = { ...v.card, meta: { ...v.card.meta, slug } };
	const fixed = /^(#[0-9a-fA-F]{6}|[a-z0-9_-]+)$/; // lowercase ids, slugs, enums and #colours stay as in the original
	const diffs: string[] = [];
	const walk = (a: unknown, b: unknown, at: string) => {
		if (Array.isArray(a)) {
			if (!Array.isArray(b) || a.length !== b.length)
				diffs.push(`${at}: list length differs`);
			else for (const [i, x] of a.entries()) walk(x, b[i], `${at}[${i}]`);
		} else if (a && typeof a === "object") {
			for (const k of Object.keys(a))
				walk(
					(a as Record<string, unknown>)[k],
					(b as Record<string, unknown> | undefined)?.[k],
					at ? `${at}.${k}` : k,
				);
		} else if (typeof a !== "string" || fixed.test(a)) {
			if (a !== b && !at.startsWith("meta.verdict"))
				diffs.push(`${at}: must stay ${JSON.stringify(a)}`);
		}
	};
	walk(original, card, "");
	if (diffs.length)
		throw new Error(
			`The translation must keep the original's structure and fixed values:\n${diffs.slice(0, 12).join("\n")}`,
		);
	const file = translationFile(slug, lang);
	await writeJson(file, card);
	return file;
}

/** Moves the judge's winner from the drafts into the library and deletes every other draft of its group. */
export async function pickWinner(
	winner: string,
): Promise<{ winner: string; dir: string; deleted: string[] }> {
	SlugSchema.parse(winner); // a plain id: "../x" must not move folders outside the library
	const drafts = path.join(outputDir(), DRAFTS_DIR);
	const from = path.join(drafts, winner);
	const to = path.join(outputDir(), winner);
	if (!existsSync(from)) {
		if (existsSync(to))
			throw new Error(
				`"${winner}" is already in the library, not among the drafts.`,
			);
		throw new Error(`No draft called "${winner}".`);
	}
	const { meta } = JSON.parse(
		await readFile(path.join(from, "card.json"), "utf8"),
	) as CharacterCard;
	const deleted: string[] = [];
	for (const name of await readdir(drafts)) {
		if (name === winner) continue;
		const other = JSON.parse(
			await readFile(path.join(drafts, name, "card.json"), "utf8").catch(
				() => "{}",
			),
		) as Partial<CharacterCard>;
		if (meta.group && other.meta?.group === meta.group) {
			await rm(path.join(drafts, name), { recursive: true, force: true });
			deleted.push(name);
		}
	}
	if (existsSync(to))
		throw new Error(`A character "${winner}" already exists in the library.`);
	await rename(from, to);
	return { winner, dir: to, deleted };
}

/** Writes card.json and card.md for a card that already has its id. */
export async function writeCard(card: StoredCard): Promise<SavedCharacter> {
	const slug = card.meta.slug;
	const dir = characterDir(slug);
	const conceptFile = await conceptFileOf(slug);
	const files = {
		json: path.join(dir, "card.json"),
		markdown: path.join(dir, "card.md"),
		...(conceptFile ? { concept: path.join(dir, conceptFile) } : {}),
	};
	await Promise.all([
		writeJson(files.json, card),
		writeFile(files.markdown, renderMarkdown(card, { conceptFile })),
	]);
	return { slug, dir, files };
}

export async function saveConcept(
	slug: string,
	bytes: Buffer,
	prompt: string,
	fileName = "concept.png",
): Promise<string> {
	return saveAsset(slug, fileName, bytes, prompt);
}

export interface ListedCard {
	slug: string;
	name: string;
	logline: string;
	hasConcept: boolean;
	updated: Date;
	group?: string;
	variant?: string;
	verdict?: string;
}

export async function listCards(): Promise<ListedCard[]> {
	const root = outputDir();
	const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
	const cards = await Promise.all(
		entries
			.filter((e) => e.isDirectory())
			.map(async (e): Promise<ListedCard | null> => {
				const json = path.join(root, e.name, "card.json");
				try {
					await migrateLayout(path.join(root, e.name));
					const [raw, info, hasConcept] = await Promise.all([
						readFile(json, "utf8"),
						stat(json),
						exists(path.join(root, e.name, CONCEPT_FILE)),
					]);
					const { meta } = JSON.parse(raw) as Partial<CharacterCard>;
					return {
						slug: e.name,
						name: meta?.name ?? e.name,
						logline: meta?.logline ?? "",
						hasConcept,
						updated: info.mtime,
						group: meta?.group,
						variant: meta?.variant,
						verdict:
							meta?.verdict && `${meta.verdict.status} ${meta.verdict.score}`,
					};
				} catch {
					return null; // not a card folder, or unreadable
				}
			}),
	);
	return cards
		.filter((c): c is ListedCard => c !== null)
		.sort((a, b) => b.updated.getTime() - a.updated.getTime());
}

export function listToText(items: ListedCard[]): string {
	const body = items.map((i) => {
		const tag = [
			i.group && `group ${i.group}${i.variant ? `/${i.variant}` : ""}`,
			i.verdict,
			i.hasConcept && "concept",
		]
			.filter(Boolean)
			.join(", ");
		return `- ${i.slug} — ${i.name}${tag ? ` [${tag}]` : ""}\n  ${i.logline}`;
	});
	return `Library: ${outputDir()}\n\n${body.length ? body.join("\n") : "No characters yet."}`;
}
