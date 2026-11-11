import { z } from "zod";
import * as M from "./methodology.js";
import { OCCUPATIONS, VISIBLE_MARKS, WOUNDS } from "./engine.js";

/** Small deterministic PRNG so a seed always reproduces the same roll. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Shared by the MCP tool (input schema) and the CLI (flag parsing). */
export const RollOptionsSchema = z.object({
  variants: z.coerce.number().int().min(1).max(5).optional().describe("How many competing variants. 1 = single character (default), 3 = tournament."),
  anchor: z.string().optional().describe("Role every variant shares, e.g. 'fisherman', 'court jester', 'mascot for a bakery'."),
  seed: z.coerce.number().int().min(0).optional().describe("Reproduce a previous roll."),
  medium: z.enum(M.MEDIUMS).optional().describe("Fix the medium instead of rolling it."),
  genre: z.string().optional().describe("Fix the genre instead of rolling it."),
  setting: z.string().optional().describe("Fix the setting instead of rolling it."),
  allow_nonhuman: z.boolean().optional().describe("Allow non-human species. Default true."),
});
export type RollOptions = Omit<z.infer<typeof RollOptionsSchema>, "variants">;

/**
 * A roll = one coherent ENGINE (wound → lie → fear → defense/gift → truth → arc)
 * plus independent SPARKS that make the result unpredictable.
 */
export interface CharacterSeed {
  seed: number;
  engine: {
    wound: string;
    lie: string;
    truth: string;
    fear: string;
    worst_trait: string;
    best_trait: string;
    arc_goal: string;
  };
  sparks: {
    medium: string;
    genre: string;
    setting: string;
    species: string;
    age_band: string;
    archetype: string;
    occupation: string;
    visible_mark: string;
  };
}

export function roll(opts: RollOptions = {}): CharacterSeed {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = mulberry32(seed);
  // Every field is always rolled in a fixed order, so a seed reproduces exactly regardless of overrides.
  const w = pick(rng, WOUNDS);
  const engine = {
    wound: w.wound,
    lie: w.lie,
    truth: w.truth,
    fear: pick(rng, w.fears),
    worst_trait: pick(rng, w.defenses),
    best_trait: pick(rng, w.gifts),
    arc_goal: pick(rng, w.arcs),
  };
  const rolled = {
    medium: pick(rng, M.MEDIUMS),
    genre: pick(rng, M.GENRES),
    setting: pick(rng, M.SETTINGS),
    species: pick(rng, M.SPECIES),
    age_band: pick(rng, M.AGE_BANDS),
    archetype: pick(rng, M.ARCHETYPES),
    occupation: pick(rng, OCCUPATIONS),
    visible_mark: pick(rng, VISIBLE_MARKS),
  };
  return {
    seed,
    engine,
    sparks: {
      ...rolled,
      medium: opts.medium ?? rolled.medium,
      genre: opts.genre ?? rolled.genre,
      setting: opts.setting ?? rolled.setting,
      species: opts.allow_nonhuman === false ? "human" : rolled.species,
      occupation: opts.anchor ?? rolled.occupation,
    },
  };
}

/**
 * N variants of the SAME character concept: they share the world (medium, genre, setting, species,
 * occupation/anchor) but each has a different engine (distinct wound), age, archetype and visible mark.
 * "All fishermen, but different fishermen."
 */
const SHARED_KEYS = ["medium", "genre", "setting", "species", "occupation"] as const;

export interface VariantSet {
  seed: number;
  shared: Pick<CharacterSeed["sparks"], (typeof SHARED_KEYS)[number]>;
  variants: (CharacterSeed & { label: string })[];
}

export function rollVariants(opts: RollOptions = {}, n = 3): VariantSet {
  const base = roll(opts);
  const shared = Object.fromEntries(SHARED_KEYS.map((k) => [k, base.sparks[k]])) as VariantSet["shared"];
  const used = new Set<string>();
  const variants: VariantSet["variants"] = [];
  let k = 0;
  while (variants.length < n && k < 500) {
    const v = k === 0 ? base : roll({ seed: (base.seed + k * 7919) % 2 ** 31 });
    k++;
    // Variants must be different people: distinct wound, archetype and age band.
    const keys = [`w:${v.engine.wound}`, `a:${v.sparks.archetype}`, `g:${v.sparks.age_band}`];
    if (keys.some((x) => used.has(x))) continue;
    keys.forEach((x) => used.add(x));
    variants.push({ ...v, sparks: { ...v.sparks, ...shared }, label: String.fromCharCode(65 + variants.length) });
  }
  return { seed: base.seed, shared, variants };
}

export function variantsToText(r: VariantSet): string {
  const s = r.shared;
  return [
    `Variant set #${r.seed} — ${r.variants.length} variants of the same concept.`,
    `SHARED by all: ${s.occupation} · ${s.species} · ${s.medium} · ${s.genre} · ${s.setting}`,
    `They must read as the same kind of character, but different people with different cores.`,
    ``,
    ...r.variants.flatMap((v) => [
      `VARIANT ${v.label} (seed ${v.seed})`,
      `  Wound: ${v.engine.wound}`,
      `  Lie: "${v.engine.lie}" · Truth: "${v.engine.truth}"`,
      `  Fear: ${v.engine.fear} · Worst: ${v.engine.worst_trait} · Best: ${v.engine.best_trait}`,
      `  Arc: ${v.engine.arc_goal}`,
      `  Age: ${v.sparks.age_band} · Archetype: ${v.sparks.archetype} · Visible mark: ${v.sparks.visible_mark}`,
      ``,
    ]),
    `Write every variant as a full card with meta.group = "${r.seed}", meta.variant = its letter, meta.seed = its seed.`,
    `Give each variant a full, honest effort — the tournament only works if all of them are real contenders.`,
  ].join("\n");
}

export const BUILD_STEPS = `
HOW TO BUILD A STRONG CHARACTER FROM THIS ROLL
1. The ENGINE is the spine and is already coherent: wound → lie they believe → fear → defense (worst trait)
   and the gift the same wound forged (best trait) → the truth they must learn (need) → arc.
   You may sharpen the wording, but keep the causal chain intact.
2. SPARKS are deliberately unrelated to the engine. Your job is to make each one serve it:
   why does someone with THIS wound end up in THIS job, in THIS world, as THIS archetype?
   The most surprising answer that still feels inevitable wins. The archetype must be twisted by the wound.
   You may swap at most ONE spark if it cannot be made to serve the engine — say which and why.
3. Before writing the card, sketch 3 one-line concepts that differ sharply, then pick the most
   characterful: the one with the clearest want-vs-need conflict, the most visual identity and the most
   playable scenes. Briefly tell the user which you chose.
4. Derive everything else FROM the core: flaws express the defense; quirks and habits are scars of the
   wound or rituals that protect the lie; the backstory dramatises the wound; secondary characters
   pressure the lie; the climax forces a choice between the lie and the truth.
5. Call character_check with the draft, fix every weak link, then character_save.
`.trim();

export function seedToText(s: CharacterSeed): string {
  const e = s.engine;
  const k = s.sparks;
  return [
    `Seed #${s.seed}`,
    ``,
    `ENGINE (coherent core)`,
    `  Wound: ${e.wound}`,
    `  Lie they believe: "${e.lie}"`,
    `  Core fear: ${e.fear}`,
    `  Defense → worst trait: ${e.worst_trait}`,
    `  Gift → best trait: ${e.best_trait}`,
    `  Truth to learn (need): "${e.truth}"`,
    `  Arc: ${e.arc_goal}`,
    ``,
    `SPARKS (make them serve the engine)`,
    `  ${k.medium} · ${k.genre} · ${k.setting}`,
    `  ${k.species}, ${k.age_band}`,
    `  Archetype: ${k.archetype} · Occupation: ${k.occupation}`,
    `  Visible mark: ${k.visible_mark}`,
    ``,
    BUILD_STEPS,
  ].join("\n");
}

/** One entry point for both callers: a single roll or a variant set, plus its text. */
export function rollToText({ variants = 1, ...opts }: z.infer<typeof RollOptionsSchema>): { data: CharacterSeed | VariantSet; text: string } {
  if (variants > 1) {
    const r = rollVariants(opts, variants);
    return { data: r, text: variantsToText(r) };
  }
  const s = roll(opts);
  return { data: s, text: `${seedToText(s)}\n\nUse meta.mode = "random" and meta.seed = ${s.seed}.` };
}
