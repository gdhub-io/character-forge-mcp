import { readFile } from "node:fs/promises";
import { run, transform } from "./ffmpeg.js";
import { falDownload, falQueue, falQueueJson, falUpload } from "./fal.js";
import type { CharacterCard } from "./schema.js";
import { assetFile, loadCard, saveAsset } from "./store.js";

/**
 * A character's own voice, made once and reused for every line (on request only; all paid).
 * Adults: ElevenLabs Voice Design → a saved ElevenLabs voice; lines via Eleven v3 with [audio tags].
 * Minors: ElevenLabs refuses to design them, so Qwen 3 Voice Design → pitched down with ffmpeg (Qwen's
 * children lean girlish) → a speaker embedding cloned from that reference; lines via Qwen TTS with it.
 */

export const VOICE_MODELS = {
  adultDesign: "fal-ai/elevenlabs/text-to-voice/design/eleven-v3", // $0.10 / 1000 performed characters
  adultSpeech: "fal-ai/elevenlabs/tts/eleven-v3", // $0.10 / 1000 characters
  childDesign: "fal-ai/qwen-3-tts/voice-design/1.7b", // $0.09 / 1000 characters
  childClone: "fal-ai/qwen-3-tts/clone-voice/1.7b",
  childSpeech: "fal-ai/qwen-3-tts/text-to-speech/1.7b", // $0.09 / 1000 characters
} as const;

const PROFILE = "voice/voice.json";

/** Languages a character can speak on the site; English is the original, the rest are translations. */
export const VOICE_LANGUAGES = { en: "English", ru: "Russian" } as const;
export type VoiceLanguage = keyof typeof VOICE_LANGUAGES;
/** The site plays voice/reference.mp3 for English and voice/reference.<lang>.mp3 for the others. */
export const referenceFile = (lang: VoiceLanguage) => (lang === "en" ? "voice/reference.mp3" : `voice/reference.${lang}.mp3`);

export interface VoiceProfile {
  engine: "elevenlabs" | "qwen";
  description: string;
  referenceText: string;
  /** elevenlabs: the saved voice. */
  voiceId?: string;
  /** qwen: semitones the reference was shifted by, and the cloned speaker embedding (assets/voice/speaker.safetensors). */
  pitchSemitones?: number;
  embedding?: string;
}

/** Under 18 by the card's age, or described as a child: ElevenLabs won't design these voices. */
export function isMinor(c: CharacterCard): boolean {
  const n = Number.parseInt(c.description.age, 10);
  if (Number.isFinite(n)) return n < 18;
  return /\b(child|kid|boy|girl|teen|toddler|baby)\b/i.test(`${c.description.age} ${c.description.gender}`);
}

/** Eleven v3 reads [tags] as performance directions; Qwen would say them aloud. */
const stripTags = (s: string) => s.replace(/\[[^\]]*\]\s*/g, "").replace(/\s{2,}/g, " ").trim();

export async function loadVoice(id: string): Promise<VoiceProfile> {
  const raw = await readFile(assetFile(id, PROFILE), "utf8").catch(() => {
    throw new Error(`No voice for "${id}" yet: design it first (character_voice).`);
  });
  return JSON.parse(raw) as VoiceProfile;
}

export interface DesignResult {
  engine: VoiceProfile["engine"];
  files: string[];
}

/** Designs the character's voice from a description and a 100-1000 character reference script, and saves it. */
export async function designVoice(
  id: string,
  opts: { description: string; text: string; pitchSemitones?: number; translations?: Partial<Record<VoiceLanguage, string>> },
): Promise<DesignResult> {
  const r = await designOriginal(id, opts);
  // The same voice, the same monologue in every other language the site offers.
  for (const [lang, line] of Object.entries(opts.translations ?? {}) as [VoiceLanguage, string][]) {
    if (lang !== "en" && line?.trim()) r.files.push(await speakReference(id, line, lang));
  }
  return r;
}

async function designOriginal(id: string, opts: { description: string; text: string; pitchSemitones?: number }): Promise<DesignResult> {
  const card = await loadCard(id);
  const save = (profile: VoiceProfile) => saveAsset(id, PROFILE, Buffer.from(`${JSON.stringify(profile, null, 2)}\n`));
  const promptText = `DESCRIPTION: ${opts.description}\nTEXT: ${opts.text}`;

  if (!isMinor(card)) {
    type Preview = { audio: { url: string }; generated_voice_id: string };
    const out = await falQueueJson<{ previews: Preview[]; voice_id?: string; seed: number }>(VOICE_MODELS.adultDesign, {
      prompt: opts.description,
      text: opts.text,
      auto_generate_text: false,
      voice_name: card.meta.name,
    });
    if (!out.voice_id) throw new Error("ElevenLabs designed previews but saved no voice");
    // ElevenLabs always returns three previews (no count parameter); the saved voice is built from the first,
    // so only that take is kept, as the reference the site plays and later lines are judged against.
    const first = out.previews[0];
    if (!first) throw new Error("ElevenLabs returned no preview");
    const files = [await saveAsset(id, "voice/reference.mp3", await falDownload(first.audio.url), promptText)];
    files.push(await save({ engine: "elevenlabs", description: opts.description, referenceText: opts.text, voiceId: out.voice_id }));
    return { engine: "elevenlabs", files };
  }

  const text = stripTags(opts.text);
  const pitch = opts.pitchSemitones ?? -2;
  const designed = await falQueue(VOICE_MODELS.childDesign, { prompt: opts.description, text, language: "English" }, "audio");
  const reference = pitch ? await shiftPitch(designed.bytes, pitch) : designed.bytes;
  const refFile = await saveAsset(id, "voice/reference.mp3", reference, `${promptText}\nPITCH: ${pitch} semitones`);
  const cloned = await falQueueJson<{ speaker_embedding: { url: string } }>(VOICE_MODELS.childClone, {
    audio_url: await falUpload(reference, "audio/mpeg", "reference.mp3"),
    reference_text: text,
  });
  const embFile = await saveAsset(id, "voice/speaker.safetensors", await falDownload(cloned.speaker_embedding.url));
  const profile = await save({ engine: "qwen", description: opts.description, referenceText: text, pitchSemitones: pitch, embedding: "voice/speaker.safetensors" });
  return { engine: "qwen", files: [refFile, embFile, profile] };
}

/** Speaks one line in the character's saved voice → assets/voice/lines/<name>.mp3. */
export async function speakLine(id: string, opts: { text: string; name: string; lang?: VoiceLanguage }): Promise<string> {
  const name = opts.name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return saveAsset(id, `voice/lines/${name}.mp3`, await speak(id, opts.text, opts.lang ?? "en"), opts.text);
}

/** The reference monologue in another language, in the same voice → voice/reference.<lang>.mp3 (what the site plays). */
export async function speakReference(id: string, text: string, lang: VoiceLanguage): Promise<string> {
  return saveAsset(id, referenceFile(lang), await speak(id, text, lang), text);
}

async function speak(id: string, line: string, lang: VoiceLanguage): Promise<Buffer> {
  const voice = await loadVoice(id);
  if (voice.engine === "elevenlabs") {
    // Eleven v3 is multilingual: the same voice reads any language from the text itself.
    return (await falQueue(VOICE_MODELS.adultSpeech, { text: line, voice: voice.voiceId }, "audio")).bytes;
  }
  const embedding = await readFile(assetFile(id, voice.embedding ?? "voice/speaker.safetensors"));
  const out = await falQueue(
    VOICE_MODELS.childSpeech,
    {
      text: stripTags(line),
      speaker_voice_embedding_file_url: await falUpload(embedding, "application/octet-stream", "speaker.safetensors"),
      reference_text: voice.referenceText,
      language: VOICE_LANGUAGES[lang],
    },
    "audio",
  );
  return out.bytes;
}

/** Shifts pitch (and formants, which makes a child voice sound bigger) by semitones, keeping the tempo. */
async function shiftPitch(bytes: Buffer, semitones: number): Promise<Buffer> {
  const ratio = 2 ** (semitones / 12);
  return transform(bytes, "audio", "mp3", async (src, dst) => {
    const rate = Number((await run("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate", "-of", "csv=p=0", src])).trim());
    await run("ffmpeg", ["-v", "error", "-y", "-i", src, "-af", `asetrate=${rate * ratio},aresample=${rate},atempo=${1 / ratio}`, "-b:a", "160k", dst]);
  });
}
