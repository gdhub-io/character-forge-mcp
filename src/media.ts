import { buildTposePrompt } from "./concept.js";
import type { CharacterCard } from "./schema.js";
import { savePrompt } from "./store.js";

/**
 * Generation prompts for other tools (image, voice, video, music), made one at a time and only on request.
 * The server provides target-specific rules plus the card material the prompt needs; the model writes it;
 * character_prompt_save stores it. Nothing here calls those generators.
 */

export const MEDIA_KINDS = ["concept", "illustration", "voice", "video", "song", "theme"] as const;
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
        `Where we hear them: ${join(b.key_locations)}; world: ${d.sociology.place}`,
        `THE MOMENT VISITORS SEE while the voice plays (scene and idle video): ${b.key_locations[0]} — ${lk.movement.idle_pose}`,
        `Core paradox: ${core.central_paradox}`,
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
    case "theme":
      return [
        `Name: ${c.meta.name} — ${c.meta.tagline} · ${c.meta.medium}, ${c.meta.genre}`,
        `Wound: ${core.wound}`,
        `Formative events: ${join(d.life_events.map((e) => `age ${e.age}: ${e.event}`))}`,
        `Strongest trigger: ${p.strongest_trigger}`,
        `Lie: "${core.lie}" · Truth: "${core.truth}"`,
        `Central paradox: ${core.central_paradox}`,
        `Best trait: ${c.traits.best_trait} · Worst trait: ${c.traits.worst_trait}`,
        `Mask: ${c.fears.mask}`,
        `Dramatic question: ${core.dramatic_question}`,
        `States — passive: ${p.states.passive} | active: ${p.states.active}`,
        `Emotional baseline: ${p.emotional_baseline} · Energy: ${c.traits.energy} · Temperament: ${c.traits.temperament} · Social: ${c.traits.social}`,
        `Gait: ${lk.movement.gait} · Speech: ${d.speech.manner}`,
        `World & culture: ${d.cultural_background}; ${d.sociology.place}`,
        `Signature item: ${lk.signature_item.item}`,
        `Palette: ${join(lk.palette.map((x) => `${x.name} — ${x.meaning}`))}`,
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

  voice: `VOICE — the character's own voice (character_voice): a short monologue in it, played as their voice, and the
acoustics of where we hear it. No celebrity or actor names.
The voice comes from WHO THEY ARE, not only age and pitch: what happened to them, how they talk and to whom
(who gets their real voice, who gets the mask), what their body and work did to the sound.
1) "Voice description", 300-900 characters: their history in one line → how they speak (pace, breath, pauses, habits,
   what they swallow or push) → age and gender stated plainly (for a child: "a real N-year-old boy/girl, unbroken
   voice", plus what makes it boyish or girlish), timbre and texture → recording (close mic, room). Never "cute".
2) "Sample script", 100-1000 characters, about 15-20 s: their INNER MONOLOGUE, what goes through their head right
   now. On screen they don't speak (the scene and idle video show no talking), so we hear their thoughts: said to
   themselves, never to the visitor or to anyone in the room (no greetings, no "sit down", no questions to us;
   thinking of someone absent is fine). Thoughts, not narration: no describing the place or the evening as a book
   would, and not a retelling of their backstory: they think about their own business right now (what they are
   doing, worried about, planning, the people around them). It is the visitor's FIRST meeting with the character:
   they have not read the card and know nothing about them, so every name and world term must make sense on first
   hearing from the thought itself; no riddles that need the card. Leave out past events that need explaining; the
   core shows in HOW they think about the present: the mask, the old hurt showing through, a glimpse of the truth.
   Old problems are old: they have lived with their body, scar or loss for years and are used to it, so they don't
   dwell on it head-on ("everyone is staring at my hand"); it shows sideways, as a habit, a shrug, a practical
   adjustment, a dry joke, or not at all. In their natural voice (not a whisper, not shouting), only
   quieter and closer, as thoughts are. It happens IN THE MOMENT the scene and idle video show (see "THE MOMENT
   VISITORS SEE"): the same place, the same pose, the same mood. Someone who looks still, watchful and sad on screen
   thinks low and tired, not bright. Their pet words, their world. It is what visitors hear, and the reference any
   later line is cloned from. Eleven v3 tags like [sighs], [short pause] are allowed (adults); for under-18s write
   delivery into punctuation instead. Translations keep the same thoughts, written natively.
   The "Voice description" says it is their inner voice, thinking to themselves.
3) "Acoustics": an inner voice has no room: very close and dry, as if inside the listener's head. Name the place
   only for the music and the mood. One line each for reverb (none, or the faintest touch), tone and level against
   the music.
4) "Delivery notes": 3 bullets (stability vs. expressiveness, pace, what to avoid).`,

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

  theme: `THEME — the character's instrumental leitmotif, about 30 s, for a looping background (e.g. behind an idle video).
It is a portrait of who they are INSIDE, not a soundtrack of their location: the picture already shows the place.
Written for ElevenLabs Music (composition plan); a one-paragraph fallback works for Lyria, Stable Audio or Suno.
Derive every choice from the card:
- WOUND MOTIF: a short, concrete sound figure (2-4 notes or one sound) tied to the wound event itself.
- TWO VOICES: two instruments that argue — the character's own voice vs. their mask / defense (best vs. worst trait
  are two faces of one wound). The lead instrument fits their age, speech and social energy.
- FORM follows the core, but the character is at the START of the story: ordinary state (passive) → the mask takes
  over → the wound motif stings → a glimpse of the truth (the melody almost completes) → back to the start, UNRESOLVED,
  ending on the dramatic question. Never a triumphant finale: the open ending makes the loop.
- TEMPO and metre from energy, temperament and gait; harmony and mode from emotional baseline and genre.
- The world, signature item and palette give timbre only: at most ONE literal sound from the setting.
- Space from the mask and insecurity (introverts: close-miked solo, more air). Ask for SPARSE, never for silence:
  something is always audible from the first second ("quiet", "sparse", "single notes"), or the model renders dead air.
Sections to save:
- "Theme idea": one line each — wound motif, the two voices, lead instrument, tempo/metre/key, the single setting
  detail — each with the card fact it comes from.
- "Composition plan": JSON {"chunks": [...]}, 4-5 chunks totalling 25000-35000 ms; each chunk has "duration_ms"
  (3000-120000), "text" = a section name in square brackets, then directions in curly braces, ONE direction per line,
  every line at most 200 characters (no lyrics); "positive_styles" (the first chunk sets genre, lead instrument, tempo
  and key for the whole piece); "negative_styles": ["vocals", "singing", "choir", "spoken word"] plus anything to avoid.
- "Prompt": the same piece as one paragraph with [m:ss-m:ss] timestamps, at most 900 characters, ending "No vocals."
- "Reading bed": how to make the quiet variant played while the card is open (same theme, no percussion, -1 intensity).
- "Settings": model, length, instrumental, and the loop note: the player fades the last 2-3 s, waits 5-10 s, replays.`,
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

/** Writes prompts/<kind>.md and returns its path. */
export async function saveMedia(slug: string, name: string, item: MediaItem): Promise<string> {
  const body = item.sections.map((s) => `## ${s.label}\n\n${s.text.trim()}`).join("\n\n");
  return savePrompt(slug, `${item.kind}.md`, `# ${name} — ${item.kind} prompt\n\n${body}\n`);
}
