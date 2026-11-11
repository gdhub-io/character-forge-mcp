import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { CharacterCardSchema, SlugSchema, slugify, type CharacterCard } from "./schema.js";
import { renderHtml, renderMarkdown } from "./render.js";

const CONCEPT_FILE = "concept.png";

export function outputDir(): string {
  const dir = process.env.CHARACTER_FORGE_DIR ?? path.join(os.homedir(), "character-forge");
  return path.resolve(dir.replace(/^~(?=$|\/)/, os.homedir()));
}

export function characterDir(slug: string): string {
  if (!SlugSchema.safeParse(slug).success) throw new Error(`Invalid character id: ${slug}`);
  return path.join(outputDir(), slug);
}

const exists = (p: string) => access(p).then(() => true, () => false);

/** A card that lives in the library: its id is known. */
export type StoredCard = CharacterCard & { meta: { slug: string } };

export type ValidationResult = { ok: true; card: CharacterCard } | { ok: false; issues: string };

export function validateCard(input: unknown): ValidationResult {
  const parsed = CharacterCardSchema.safeParse(input);
  return parsed.success ? { ok: true, card: parsed.data } : { ok: false, issues: z.prettifyError(parsed.error) };
}

/** Reads and validates a card.json from any path. Throws with readable issues. */
export async function loadCardFile(file: string): Promise<CharacterCard> {
  const result = validateCard(JSON.parse(await readFile(file, "utf8")));
  if (!result.ok) throw new Error(`Invalid card ${file}:\n${result.issues}`);
  return result.card;
}

export async function loadCard(slug: string): Promise<StoredCard> {
  const file = path.join(characterDir(slug), "card.json");
  if (!(await exists(file))) throw new Error(`Character "${slug}" not found in ${outputDir()}`);
  const card = await loadCardFile(file);
  return { ...card, meta: { ...card.meta, slug } };
}

/** The concept image file name relative to the card, if it has been generated. */
async function conceptFileOf(slug: string): Promise<string | undefined> {
  return (await exists(path.join(characterDir(slug), CONCEPT_FILE))) ? CONCEPT_FILE : undefined;
}

/** Markdown of a saved card, without touching disk beyond one existence check. */
export async function cardMarkdown(card: StoredCard): Promise<string> {
  return renderMarkdown(card, { conceptFile: await conceptFileOf(card.meta.slug) });
}

export interface SavedCharacter {
  slug: string;
  dir: string;
  files: { json: string; markdown: string; html: string; concept?: string };
}

/** Saves a card under a new id (name, name-2, ...) or, with overwrite, under its own id. */
export async function saveCard(card: CharacterCard, opts: { overwrite?: boolean } = {}): Promise<SavedCharacter> {
  const base = card.meta.slug ?? slugify(card.meta.name);
  let slug = base;
  if (!opts.overwrite) {
    const taken = new Set(await readdir(outputDir()).catch(() => [] as string[]));
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  }
  const saved = { ...card, meta: { ...card.meta, slug } };
  await mkdir(characterDir(slug), { recursive: true });
  return writeCard(saved);
}

/** Writes card.json, card.md and card.html for a card that already has its id. */
export async function writeCard(card: StoredCard): Promise<SavedCharacter> {
  const slug = card.meta.slug;
  const dir = characterDir(slug);
  const conceptFile = await conceptFileOf(slug);
  const files = {
    json: path.join(dir, "card.json"),
    markdown: path.join(dir, "card.md"),
    html: path.join(dir, "card.html"),
    ...(conceptFile ? { concept: path.join(dir, conceptFile) } : {}),
  };
  await Promise.all([
    writeFile(files.json, `${JSON.stringify(card, null, 2)}\n`),
    writeFile(files.markdown, renderMarkdown(card, { conceptFile })),
    writeFile(files.html, renderHtml(card, { conceptFile })),
  ]);
  return { slug, dir, files };
}

export async function saveConcept(slug: string, bytes: Buffer, prompt: string, fileName = CONCEPT_FILE): Promise<string> {
  const dir = characterDir(slug);
  const file = path.join(dir, fileName);
  const promptFile = path.join(dir, `${path.parse(fileName).name}-prompt.txt`);
  await Promise.all([writeFile(file, bytes), writeFile(promptFile, `${prompt}\n`)]);
  return file;
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
          const [raw, info, hasConcept] = await Promise.all([readFile(json, "utf8"), stat(json), exists(path.join(root, e.name, CONCEPT_FILE))]);
          const { meta } = JSON.parse(raw) as Partial<CharacterCard>;
          return {
            slug: e.name,
            name: meta?.name ?? e.name,
            logline: meta?.logline ?? "",
            hasConcept,
            updated: info.mtime,
            group: meta?.group,
            variant: meta?.variant,
            verdict: meta?.verdict && `${meta.verdict.status} ${meta.verdict.score}`,
          };
        } catch {
          return null; // not a card folder, or unreadable
        }
      }),
  );
  return cards.filter((c): c is ListedCard => c !== null).sort((a, b) => b.updated.getTime() - a.updated.getTime());
}

export function listToText(items: ListedCard[]): string {
  const body = items.map((i) => {
    const tag = [i.group && `group ${i.group}${i.variant ? `/${i.variant}` : ""}`, i.verdict, i.hasConcept && "concept"].filter(Boolean).join(", ");
    return `- ${i.slug} — ${i.name}${tag ? ` [${tag}]` : ""}\n  ${i.logline}`;
  });
  return `Library: ${outputDir()}\n\n${body.length ? body.join("\n") : "No characters yet."}`;
}
