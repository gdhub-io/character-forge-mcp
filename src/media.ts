import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildTposePrompt } from "./concept.js";
import type { CharacterCard } from "./schema.js";
import { characterDir } from "./store.js";

/**
 * Generation prompts for other tools (image, voice, video, music), made one at a time and only on request.
 * The server provides target-specific rules plus the card material the prompt needs; the model writes it;
 * character_prompt_save stores it. Nothing here calls those generators.
 */

export const MEDIA_KINDS = ["concept", "illustration", "voice", "video", "song"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

const join = (items: string[]) => items.join("; ");

/** Look essentials every visual prompt must repeat so the character stays consistent across images and video. */
function visualAnchors(c: CharacterCard): string {
  const d = c.description;
  const lk = c.look;
  return [
    `${d.age}, ${d.gender}, ${d.species}. ${d.physical.height_build} ${d.physical.face} ${d.physical.hair}`,
    `Marks: ${join(lk.marks.map((m) => `${m.mark} (${m.location})`))}`,
    `Signature item: ${lk.signature_item.item} — ${lk.signature_item.how_carried}`,
    `Outfit: ${join(lk.outfit.map((o) => o.piece))}`,
    `Palette: ${lk.palette.map((p) => `${p.name} ${p.hex}`).join(", ")}`,
    `Silhouette: ${lk.silhouette}`,
    `Art style: ${lk.art_style}`,
  ].join("\n");
}

function material(c: CharacterCard, kind: MediaKind): string {
  const { core, goals: g, description: d, backstory: b, destiny: ds, look: lk, psychology: p } = c;
  switch (kind) {
    case "concept":
      return buildTposePrompt(c);
    case "illustration":
      return [
        visualAnchors(c),
        `Core paradox: ${core.central_paradox}`,
        `Candidate moments: FIRST APPEARANCE — ${c.identification.first_appearance} | THRESHOLD — ${ds.threshold} | CLIMAX — ${g.goal_climax}`,
        `Locations: ${join(b.key_locations)}`,
        `World: ${b.world.who_rules} ${b.world.boundaries}`,
        `Secondary characters: ${join(b.contradictions.map((x) => x.with_whom))}`,
        `Inner state device: ${p.visual_device}`,
        `Medium / genre: ${c.meta.medium} · ${c.meta.genre}`,
      ].join("\n");
    case "voice":
      return [
        `${d.age}, ${d.gender}. Cultural background: ${d.cultural_background}`,
        `Body: ${d.physical.height_build} Marks: ${join(lk.marks.map((m) => m.mark))}`,
        `Speech manner: ${d.speech.manner}`,
        `Pet words: ${join(d.speech.pet_words)}`,
        `Sample lines: ${join(d.speech.sample_lines)}`,
        `Inner monologue: ${join(p.inner_monologue)}`,
        `Emotional baseline: ${p.emotional_baseline} · Energy: ${c.traits.energy} · Temperament: ${c.traits.temperament}`,
        `Strongest trigger: ${p.strongest_trigger}`,
      ].join("\n");
    case "video":
      return [
        visualAnchors(c),
        `Movement — gait: ${lk.movement.gait}; idle: ${lk.movement.idle_pose}; gesture: ${lk.movement.signature_gesture}; under stress: ${lk.movement.under_stress}`,
        `Candidate actions: FIRST APPEARANCE — ${c.identification.first_appearance} | SCENE GOAL — ${g.scene_goal_example} | ORDEAL — ${ds.ordeal}`,
        `Characteristic reactions: ${join(c.traits.reactions.map((r) => `${r.situation} → ${r.reaction}`))}`,
        `Locations: ${join(b.key_locations)}`,
      ].join("\n");
    case "song":
      return [
        `Name: ${c.meta.name} — ${c.meta.tagline}`,
        `Wound: ${core.wound}`,
        `Lie: "${core.lie}" · Truth: "${core.truth}"`,
        `Arc: ${ds.ordinary_world} → ${ds.threshold} → ${ds.ordeal} → ${ds.transformation} → ${ds.ending}`,
        `Signature item: ${lk.signature_item.item} (${lk.signature_item.story})`,
        `Pet words: ${join(d.speech.pet_words)}`,
        `World & culture: ${c.meta.genre}; ${d.cultural_background}; ${d.sociology.place}`,
        `Tastes: ${c.uniqueness.lifestyle.tastes}`,
      ].join("\n");
  }
}

const GUIDES: Record<MediaKind, string> = {
  concept: `CONCEPT (A-pose model sheet) — the ready-made prompt below is built from the look section.
Use it as is, or tighten wording for the target model; do not drop marks, sides, palette or the signature item.
Sections to save: "Prompt", "Negative" (text, labels, watermark, extra limbs, props held, busy background), "Settings" (aspect ratio 3:2 for front-back, 2:3 for front).`,

  illustration: `ILLUSTRATION — one key-art image that REVEALS the character: a specific moment from their story, in a
specific location, with an event happening. Model-agnostic (gpt-image, Gemini image, Flux, Midjourney).
Pick ONE moment that shows the core paradox (often the first appearance, the threshold or the climax choice).
Write natural-language sentences, 80-150 words, in this order: subject (with the visual anchors), action that
shows a trait, location, the event around them, secondary characters, composition & camera (shot size, angle,
lens), lighting & time of day, mood, art style (match look.art_style).
The character must be recognisable: repeat marks with sides, the signature item, outfit and palette.
Sections to save: "Moment" (one line: which story beat and why), "Prompt", "Negative", "Settings" (aspect ratio).`,

  voice: `VOICE — a voice-design prompt for "describe a voice" TTS tools (e.g. ElevenLabs Voice Design) plus a script to
audition it. No celebrity or actor names.
1) "Voice description", at most 600 characters: age, gender, accent/region (from cultural background), pitch, timbre,
   texture (rasp, breath, gravel), pace and rhythm, volume, emotional baseline, and recording quality (close mic, room).
   Let the body and history shape it (injuries, habits, profession).
2) "Sample script", 250-600 characters, in their own speech: pet words, manner, one emotional turn. Inline delivery
   tags in square brackets are allowed, e.g. [quietly], [pause], [dry laugh].
3) "Delivery notes": 3 bullets for a voice actor or TTS settings (stability vs. expressiveness, pace, what to avoid).`,

  video: `VIDEO — a 5-10 second clip for Seedance (also works for Kling, Veo, Runway). It shows ACTION that reveals the
character, like the illustration but in motion.
One clear action beat with a beginning and an end. Structure: subject (visual anchors) + action (use look.movement
and their reactions) + scene + camera movement + lighting + style + mood. Name the camera move explicitly (static,
slow push-in, tracking, handheld, orbit, crane). Up to 3 shots, in order, separated by "Cut to:", with rough timing.
Motion must be physically plausible; no on-screen text; no lip-synced dialogue.
Sections to save: "Action" (one line: what happens and what it reveals), "Prompt", "Negative" (text, watermark,
morphing hands or face, extra limbs, flicker), "Settings" (duration, aspect ratio, resolution, and image-to-video: use
the illustration or concept as the first frame if available).`,

  song: `SONG — for Suno. A song about the character that tells their arc. No artist names anywhere.
Sections to save:
- "Title".
- "Style", at most 200 characters: comma-separated tags for genre, subgenre or era, 2-4 instruments, vocal type and
  gender, mood, tempo or BPM. Derive them from the world, culture, genre and the character's tastes.
- "Lyrics", 150-250 words, with section tags: [Intro] [Verse 1] [Pre-Chorus] [Chorus] [Verse 2] [Bridge] [Final Chorus]
  [Outro]. Performance tags are allowed, e.g. [whispered], [instrumental break].
  - Verse 1: the ordinary world and the wound.
  - Chorus: a repeatable hook built on the lie; use a pet phrase or the signature item.
  - Verse 2: the threshold and the ordeal.
  - Bridge: the climax choice.
  - Final chorus: rewritten to land on the truth.
  First person or a ballad about them: choose. Concrete images from the card; no filler rhymes.
- "Exclude styles" (optional).`,
};

export function mediaBrief(c: CharacterCard, kind: MediaKind): string {
  return [
    `${kind.toUpperCase()} PROMPT for "${c.meta.name}". Write it in English following the rules, using only the card's facts`,
    `(don't invent a different look or story). Then call character_prompt_save with kind "${kind}" and the named sections.`,
    "",
    GUIDES[kind],
    "",
    `CARD MATERIAL:\n${material(c, kind)}`,
  ].join("\n");
}

export interface MediaItem {
  kind: MediaKind;
  sections: { label: string; text: string }[];
}

/** Writes media/<kind>.md and returns its path. */
export async function saveMedia(slug: string, name: string, item: MediaItem): Promise<string> {
  const dir = path.join(characterDir(slug), "media");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${item.kind}.md`);
  const body = item.sections.map((s) => `## ${s.label}\n\n${s.text.trim()}`).join("\n\n");
  await writeFile(file, `# ${name} — ${item.kind} prompt\n\n${body}\n`);
  return file;
}
