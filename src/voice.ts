import { readFile } from "node:fs/promises";
import { config } from "./config.js";
import { recordCost } from "./costs.js";
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

/** Voice models come from models.json (config().models.voice): ElevenLabs for adults, Qwen for minors. */
const voiceModels = () => config().models.voice;
/** Adults use ElevenLabs, under-18s Qwen: the pricing tier and models that go with an engine. */
function tier(engine: string) {
  const m = voiceModels();
  return engine === "elevenlabs" ? { who: "adult" as const, design: m.adultDesign, speech: m.adultSpeech } : { who: "child" as const, design: m.childDesign, speech: m.childSpeech };
}

export const PROFILE = "voice/voice.json";
/** Qwen stops after max_new_tokens codes (default 200 ≈ 16 s, which cut every line short); 2000 ≈ 2.5 min. */
const QWEN_MAX_TOKENS = 2000;

/** Languages a character can speak on the site; English is the original, the rest are translations. */
export const VOICE_LANGUAGES = { en: "English", ru: "Russian" } as const;
export type VoiceLanguage = keyof typeof VOICE_LANGUAGES;
type OtherLanguage = Exclude<VoiceLanguage, "en">;
/** Every voice language besides the English original. */
export const OTHER_VOICE_LANGUAGES = Object.keys(VOICE_LANGUAGES).filter((l) => l !== "en") as [OtherLanguage, ...OtherLanguage[]];
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
  opts: { description: string; text: string; pitchSemitones?: number; translations?: VoiceTranslation[] },
): Promise<DesignResult> {
  const r = await designOriginal(id, opts);
  // Every other language is its own performance: the voice prompt translated by meaning, generated fresh.
  for (const t of opts.translations ?? []) {
    if (t.lang !== "en" && t.text.trim()) r.files.push(await speakReference(id, t.text, t.lang, t.description));
  }
  return r;
}

/** The voice prompt in another language: the monologue and, ideally, the description, translated by meaning. */
export interface VoiceTranslation {
  lang: VoiceLanguage;
  text: string;
  description?: string;
}

async function designOriginal(id: string, opts: { description: string; text: string; pitchSemitones?: number }): Promise<DesignResult> {
  const card = await loadCard(id);
  const save = (profile: VoiceProfile) => saveAsset(id, PROFILE, Buffer.from(`${JSON.stringify(profile, null, 2)}\n`));
  const promptText = `DESCRIPTION: ${opts.description}\nTEXT: ${opts.text}`;

  if (!isMinor(card)) {
    type Preview = { audio: { url: string }; generated_voice_id: string };
    const out = await falQueueJson<{ previews: Preview[]; voice_id?: string; seed: number }>(voiceModels().adultDesign, {
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
    await chargeVoice(id, "adult", voiceModels().adultDesign, opts.text, "voice design, en");
    files.push(await save({ engine: "elevenlabs", description: opts.description, referenceText: opts.text, voiceId: out.voice_id }));
    return { engine: "elevenlabs", files };
  }

  const text = stripTags(opts.text);
  const pitch = opts.pitchSemitones ?? -2;
  const designed = await falQueue(voiceModels().childDesign, { prompt: opts.description, text, language: "English", max_new_tokens: QWEN_MAX_TOKENS }, "audio");
  const reference = pitch ? await shiftPitch(designed.bytes, pitch) : designed.bytes;
  const refFile = await saveAsset(id, "voice/reference.mp3", reference, `${promptText}\nPITCH: ${pitch} semitones`);
  const cloned = await falQueueJson<{ speaker_embedding: { url: string } }>(voiceModels().childClone, {
    audio_url: await falUpload(reference, "audio/mpeg", "reference.mp3"),
    reference_text: text,
  });
  const embFile = await saveAsset(id, "voice/speaker.safetensors", await falDownload(cloned.speaker_embedding.url));
  await chargeVoice(id, "child", voiceModels().childDesign, text, "voice design + clone, en");
  const profile = await save({ engine: "qwen", description: opts.description, referenceText: text, pitchSemitones: pitch, embedding: "voice/speaker.safetensors" });
  return { engine: "qwen", files: [refFile, embFile, profile] };
}

/** Speaks one line in the character's saved voice → assets/voice/lines/<name>.mp3. */
export async function speakLine(id: string, opts: { text: string; name: string; lang?: VoiceLanguage }): Promise<string> {
  const name = opts.name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const file = await saveAsset(id, `voice/lines/${name}.mp3`, await speak(id, opts.text, opts.lang ?? "en"), opts.text);
  await chargeSpeech(id, opts.text, `line "${name}", ${opts.lang ?? "en"}`);
  return file;
}

/**
 * The reference monologue in another language → voice/reference.<lang>.mp3 (what the site plays). It is performed
 * by the voice-design model from the same description, not cloned: cloning copies the timbre but drops the acting
 * (the description of who they are and how they talk), and the translations came out flat. The timbre can differ a
 * little from the English take; the performance follows the card.
 */
export async function speakReference(id: string, text: string, lang: VoiceLanguage, description?: string): Promise<string> {
  const voice = await loadVoice(id);
  const prompt = description?.trim() || voice.description;
  const m = voiceModels();
  let bytes: Buffer;
  if (voice.engine === "elevenlabs") {
    type Preview = { audio: { url: string } };
    const out = await falQueueJson<{ previews: Preview[] }>(m.adultDesign, { prompt, text, auto_generate_text: false });
    if (!out.previews[0]) throw new Error("ElevenLabs returned no preview");
    bytes = await falDownload(out.previews[0].audio.url);
  } else {
    const designed = await falQueue(m.childDesign, { prompt, text: stripTags(text), language: VOICE_LANGUAGES[lang], max_new_tokens: QWEN_MAX_TOKENS }, "audio");
    bytes = voice.pitchSemitones ? await shiftPitch(designed.bytes, voice.pitchSemitones) : designed.bytes;
  }
  const file = await saveAsset(id, referenceFile(lang), bytes, `DESCRIPTION: ${prompt}\nTEXT: ${text}`);
  await chargeVoice(id, tier(voice.engine).who, tier(voice.engine).design, text, `reference monologue, ${lang}`);
  return file;
}

/** Ledger entries for voice work: priced per 1000 characters of the script. */
async function chargeVoice(id: string, who: "adult" | "child", model: string, script: string, detail: string): Promise<void> {
  const chars = stripTags(script).length;
  await recordCost(id, { kind: "voice", model, detail: `${detail}, ${chars} characters`, usd: (chars / 1000) * config().pricing.voice[who].per1000Chars });
}
async function chargeSpeech(id: string, script: string, detail: string): Promise<void> {
  const t = tier((await loadVoice(id)).engine);
  await chargeVoice(id, t.who, t.speech, script, detail);
}

async function speak(id: string, line: string, lang: VoiceLanguage): Promise<Buffer> {
  const voice = await loadVoice(id);
  if (voice.engine === "elevenlabs") {
    // Eleven v3 is multilingual: the same voice reads any language from the text itself.
    return (await falQueue(voiceModels().adultSpeech, { text: line, voice: voice.voiceId }, "audio")).bytes;
  }
  const embedding = await readFile(assetFile(id, voice.embedding ?? "voice/speaker.safetensors"));
  const out = await falQueue(
    voiceModels().childSpeech,
    {
      text: stripTags(line),
      speaker_voice_embedding_file_url: await falUpload(embedding, "application/octet-stream", "speaker.safetensors"),
      // The reference text is English; given with another language it pulls the speech back into English.
      ...(lang === "en" ? { reference_text: voice.referenceText } : {}),
      language: VOICE_LANGUAGES[lang],
      max_new_tokens: QWEN_MAX_TOKENS,
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
