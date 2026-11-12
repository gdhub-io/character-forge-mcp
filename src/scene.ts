import { recordCost } from "./costs.js";
import { readFile } from "node:fs/promises";
import { ffmpeg, run, transform } from "./ffmpeg.js";
import type { CharacterCard } from "./schema.js";
import { config } from "./config.js";
import { DEFAULT_ART_STYLE, pronoun } from "./concept.js";
import { falQueue, falUpload } from "./fal.js";
import { assetFile, loadCard, saveAsset } from "./store.js";

/**
 * A living portrait: the character in their own place, doing what they usually do (an "idle" moment),
 * first as a still (GPT Image edit, using concept.png as the character reference), then as a looping
 * idle clip built from that same still (Kling or Veo).
 */

/**
 * Video families (endpoints in models.json): Kling O1 Standard (≈$0.084/s, first+last frame, no audio) and Veo 3.1
 * Fast (720p, $0.15/s with sound, $0.10 without; 4, 6 or 8 s). Seedance was dropped: its partner moderation rejects
 * any realistic face it didn't generate itself, which is every scene we make.
 */
export const VIDEO_FAMILIES = ["kling", "veo"] as const;
export type VideoModel = (typeof VIDEO_FAMILIES)[number];


/** Everything the scene needs comes from the card: place, idle pose, habit, look, worn items and their sides. */
export function defaultScenePrompt(c: CharacterCard): string {
  const lk = c.look;
  const d = c.description;
  const own = (where: string) => where.replace("_", " ");
  const worn = (lk.blocking?.accessories ?? []).filter((a) => a.item).map((a) => `${a.item} on the ${own(a.where)}`);
  // Marks that only exist at a story moment ("Wave-night state only") don't belong in the everyday idle scene.
  // ("LEFT shin only" is a side, not a moment, so only "<moment> only" / "only during …" counts.)
  const marks = lk.marks.filter((m) => !/\b(state|night|scene|moment) only\b|\bonly (during|at|on|in|when)\b/i.test(m.location));
  return [
    `A cinematic still of ${c.meta.name} (${d.age}, ${d.gender.toLowerCase()}) — the character from the reference sheet — in their own place: ${c.backstory.key_locations[0]}.`,
    `An ordinary idle moment: ${lk.movement.idle_pose} Doing what they usually do: ${c.backstory.daily_life}`,
    // The idle text mentions occasional habits ("every hour she taps it"); drawn literally they invent props and
    // hand contact (Marta's second take grew a wall barometer under her hand). Show the plain pose only.
    "Show only the plain idle pose itself: the occasional habits and gestures mentioned above are character notes, not to be drawn; no extra objects are added for them, and the hands rest on the character's own body or clothing.",
    `Same face, hair, outfit (${lk.outfit.map((o) => o.piece).join("; ")}) and marks (${marks.map((m) => `${m.mark}, ${m.location}`).join("; ")}) as in the reference.`,
    // A body far from average (Pike: 2.35 m at ten) vanishes in a scene with nothing to measure it against.
    `Scale: ${d.physical.height_build.split(/[.;:]/)[0]}. Show it against the place: doorways, ceilings, railings and everyday objects at their normal size around the character.`,
    worn.length ? `Worn items, on the character's own sides: ${worn.join("; ")}.` : "",
    // GPT hung Marta's rope coil over her crossed arms, so the forearm sank into it — and the video inherited it.
    "Physical sense: every worn item hangs freely and clear of the arms and hands (a coil on a shoulder hangs behind or beside the arm, never over the chest where the arms rest); nothing passes through a limb or the body.",
    `Signature item visible: ${lk.signature_item.item.replace(/\.$/, "")}.`,
    "Restraint: show the character's craft or obsession through one or two details, not by filling the frame with it; the place is lived-in and ordinary, full of things that have nothing to do with their main motif.",
    "Composition for a full-screen website background: 16:9 wide shot, the character placed in the RIGHT third of the frame, whole figure visible. The LEFT 60% is a calm continuation of the same place — low detail, soft focus, no bright spots, no faces or text — where menus and info cards will sit.",
    `Static camera at eye level. Light motivated by the place itself. Style: ${DEFAULT_ART_STYLE.replace(/,\s*soft studio light/i, "")}. One single image, no text.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Motion for a seamless idle loop: keep the first frame's pose (the scene may differ from the card's idle pose),
 * take only the flavour of motion from the card, and come back to the start. With audio, describe the place's sound.
 */
export function defaultLoopPrompt(c: CharacterCard, audio = false, loop: LoopMode = "frame", model: VideoModel = "kling"): string {
  const mv = c.look.movement;
  const his = pronoun(c.description.gender);
  return [
    loop === "frame" || model === "veo"
      ? "Seamless idle loop, static locked-off camera, no cuts. The clip starts and ends on the exact first frame. The character stays in the right third of the frame and never walks."
      : "Calm idle moment, static locked-off camera, no cuts. The character stays in the right third of the frame and never walks, and ends in nearly the same pose as the first frame.",
    // Kling with first = last frame tends to freeze everything; the background has to be told to live the whole time.
    "The world keeps moving for the WHOLE clip, never frozen: whatever in this scene naturally moves — water and waves, clouds, rain, smoke, flames, lamplight, foliage, hanging cloth or rope — moves continuously and visibly, in slow even cycles.",
    `The character breathes, blinks and shifts weight slightly, in the spirit of ${his} idle habit (${mv.idle_pose})`,
    `Once in the middle, one small, clearly readable beat in the spirit of that habit, carried by the head, shoulders or a whole arm (a look up at the sky, a turn of the head, a shift of weight), then back to exactly the first-frame pose. ${his[0].toUpperCase() + his.slice(1)} hands stay away from ${his} face and mouth, and do not tap, pick up or touch small objects: the hand misses and it reads as a glitch.`,
    `${c.look.signature_item.item.split(/[:,]/)[0]} stays still in its place.`,
    "No new people or objects appear.",
    // Video moderation has rejected stylized characters as "likenesses of real people"; say it plainly.
    "The character is entirely fictional, an original stylized game character; any resemblance to a real person is coincidental.",
    // Breaths at the start and end pile up at the loop seam; contact sounds rarely match what the hands do.
    audio ? `Sound: steady ambient sound of this place (${c.backstory.key_locations[0].split(/[:.]/)[0]}), even from the first to the last second. At most one soft breath, only in the middle; no breathing at the start or end. No tapping, knocking or object sounds, no speech, no music.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** The user's corrections for this one take go last, where they override anything above them; no code change needed. */
const withNotes = (prompt: string, notes?: string) => (notes?.trim() ? `${prompt}\nCorrections for this take (they override anything above): ${notes.trim()}` : prompt);

export interface SceneResult {
  file: string;
  prompt: string;
}

export async function generateScene(id: string, opts: { prompt?: string; notes?: string; quality?: "low" | "medium" | "high" } = {}): Promise<SceneResult> {
  const card = await loadCard(id);
  const concept = await readFile(assetFile(id, "concept.png")).catch(() => {
    throw new Error(`No concept.png for "${id}" yet: generate the concept first, it is the character reference.`);
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
  await recordCost(id, { kind: "scene", model: sceneModel.model, detail: `scene still, ${opts.quality ?? sceneModel.quality}`, usd: config().pricing.scene.image });
  return { file, prompt };
}

/**
 * How the clip loops. "frame": the scene is also the last frame (Kling holds the background still to get there).
 * "crossfade": only the first frame is given, so the world moves freely; ffmpeg then blends the last second into
 * the first (picture and sound) so the end flows into the start. "off": a plain clip.
 */
export type LoopMode = "frame" | "crossfade" | "off";
const CROSSFADE_S = 1;

export interface VideoResult {
  file: string;
  prompt: string;
  seconds: number;
}

/** Idle clip from scene.png (Kling ≈$0.084/s silent, Veo 3.1 Fast $0.15/s with sound), looped per LoopMode. */
export async function generateIdleVideo(
  id: string,
  opts: { prompt?: string; notes?: string; seconds?: number; loop?: LoopMode; audio?: boolean; model?: VideoModel } = {},
): Promise<VideoResult> {
  const card = await loadCard(id);
  const scene = await readFile(assetFile(id, "scene.png")).catch(() => {
    throw new Error(`No scene.png for "${id}" yet: generate the scene first.`);
  });
  const url = await falUpload(scene, "image/png", "scene.png");
  const video = config().models.video;
  const model = opts.model ?? video.default;
  // Veo matches the first and last frame but not the motion through them, so its seam jerks; it gets both.
  const loop = opts.loop ?? (model === "kling" ? "frame" : "crossfade");
  const asked = opts.seconds ?? 8;
  // Kling takes any length with an end frame, but only 5 or 10 s from a start frame alone; Veo takes 4, 6 or 8 s.
  const seconds =
    model === "kling" && loop !== "frame" ? (asked > 7 ? 10 : 5) : model === "veo" ? (asked >= 7 ? 8 : asked >= 5 ? 6 : 4) : asked;
  // Kling O1 has no sound; Veo makes it by default.
  const audio = model === "veo" && (opts.audio ?? true);
  const prompt = withNotes(opts.prompt ?? defaultLoopPrompt(card, audio, loop, model), opts.notes);
  const end = loop === "frame" ? { end_image_url: url } : {};
  const body =
    model === "kling"
      ? { prompt, start_image_url: url, ...end, duration: String(seconds) }
      : { prompt, ...(loop === "off" ? { image_url: url } : { first_frame_url: url, last_frame_url: url }), duration: `${seconds}s`, aspect_ratio: "16:9", resolution: "720p", generate_audio: audio };
  const endpoint = model === "veo" && loop === "off" ? video.veoStartOnly : video[model];
  const out = await falQueue(endpoint, body, "video", 10 * 60_000); // video renders take minutes
  const looped = loop === "crossfade" ? await crossfadeLoop(out.bytes, CROSSFADE_S) : out.bytes;
  const bytes = audio ? await normalizeAudio(looped) : looped;
  const file = await saveAsset(id, "idle.mp4", bytes, prompt);
  const price = config().pricing.video;
  const perSecond = model === "veo" ? (audio ? price.veo.second : price.veo.secondSilent) : price.kling.second;
  await recordCost(id, { kind: "video", model: endpoint, detail: `${seconds} s${audio ? ", with sound" : ""}`, usd: perSecond * seconds });
  return { file, prompt, seconds };
}

/**
 * Makes a clip loop seamlessly: output = clip[d..T] whose last d seconds dissolve into clip[0..d], so the final
 * frame is frame d — the first frame of the output. Audio, if any, is crossfaded the same way.
 */
export async function crossfadeLoop(video: Buffer, d: number): Promise<Buffer> {
  return transform(video, "mp4", "mp4", async (src, dst) => {
    const info = JSON.parse(await run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", src])) as {
      format: { duration: string };
      streams: { codec_type: string }[];
    };
    const total = Number(info.format.duration);
    const hasAudio = info.streams.some((x) => x.codec_type === "audio");
    const v = `[0:v]split[a][b];[a]trim=start=${d},setpts=PTS-STARTPTS[tail];[b]trim=end=${d},setpts=PTS-STARTPTS[head];[tail][head]xfade=transition=fade:duration=${d}:offset=${(total - 2 * d).toFixed(3)}[v]`;
    const a = `;[0:a]asplit[x][y];[x]atrim=start=${d},asetpts=PTS-STARTPTS[at];[y]atrim=end=${d},asetpts=PTS-STARTPTS[ah];[at][ah]acrossfade=d=${d}[a]`;
    await run("ffmpeg", ["-v", "error", "-y", "-i", src, "-filter_complex", hasAudio ? v + a : v, "-map", "[v]", ...(hasAudio ? ["-map", "[a]", "-c:a", "aac", "-b:a", "160k"] : []), "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", dst]);
  });
}

// A short fade at both ends so the loop seam doesn't thump when the clip restarts.
const FADE = "afade=t=in:d=0.4";

/** Models mix ambient sound very low (Veo's sea came out near -45 dB); bring it to a steady, quiet background level (about a third of a normal mix). */
export const normalizeAudio = (video: Buffer, lufs = -34) =>
  ffmpeg(video, "mp4", "mp4", ["-c:v", "copy", "-af", `loudnorm=I=${lufs}:TP=-2:LRA=11,${FADE},areverse,${FADE},areverse`, "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart"]);
