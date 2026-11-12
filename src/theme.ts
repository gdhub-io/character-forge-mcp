import { recordCost } from "./costs.js";
import { readFile } from "node:fs/promises";
import { config } from "./config.js";
import { durationOf, run, transform } from "./ffmpeg.js";
import { falQueue } from "./fal.js";
import { promptFile, saveAsset } from "./store.js";

/**
 * The character's instrumental theme, generated from the composition plan saved by character_prompt_save
 * (prompts/theme.md, section "Composition plan"). ElevenLabs Music v2.5: $0.60 per started output minute.
 */

interface Chunk {
  duration_ms: number;
  text: string;
  positive_styles: string[];
  negative_styles: string[];
}

/** Pulls the JSON plan out of prompts/theme.md (the "## Composition plan" section, fenced or bare). */
export async function loadCompositionPlan(id: string): Promise<{ chunks: Chunk[] }> {
  const md = await readFile(promptFile(id, "theme.md"), "utf8").catch(() => {
    throw new Error(`No theme prompt for "${id}" yet: write one with character_prompt (kind "theme") and save it.`);
  });
  const section = md.split(/^## /m).find((s) => s.startsWith("Composition plan"));
  const json = section?.slice(section.indexOf("{"), section.lastIndexOf("}") + 1);
  if (!json) throw new Error(`prompts/theme.md for "${id}" has no "Composition plan" JSON section.`);
  const plan = JSON.parse(json) as { chunks?: Chunk[] };
  if (!plan.chunks?.length) throw new Error("The composition plan has no chunks.");
  return { chunks: plan.chunks };
}

export interface ThemeResult {
  file: string;
  seconds: number;
}

export async function generateTheme(id: string, opts: { seed?: number } = {}): Promise<ThemeResult> {
  const plan = await loadCompositionPlan(id);
  const out = await falQueue(
    config().models.music.model,
    { composition_plan: plan, output_format: "mp3_48000_192", ...(opts.seed !== undefined ? { seed: opts.seed } : {}) },
    "audio",
    5 * 60_000,
  );
  // The model can render "space and silence" as seconds of digital silence (Marta's first take opened with 10 s of
  // it); the player already rests between loops, so dead air at either end is trimmed. The raw take is kept.
  await saveAsset(id, "theme-raw.mp3", out.bytes);
  const trimmed = await trimSilence(out.bytes);
  const file = await saveAsset(id, "theme.mp3", trimmed.bytes);
  const planned = plan.chunks.reduce((s, c) => s + c.duration_ms, 0) / 1000;
  await recordCost(id, { kind: "music", model: config().models.music.model, detail: `${Math.round(planned)} s theme`, usd: Math.ceil(planned / 60) * config().pricing.music.startedMinute });
  return { file, seconds: Math.round(trimmed.seconds * 10) / 10 };
}

/** Cuts silence (below -60 dB) from both ends of an mp3. */
async function trimSilence(mp3: Buffer): Promise<{ bytes: Buffer; seconds: number }> {
  const edge = "silenceremove=start_periods=1:start_threshold=-60dB";
  let seconds = 0;
  const bytes = await transform(mp3, "mp3", "mp3", async (src, dst) => {
    await run("ffmpeg", ["-v", "error", "-y", "-i", src, "-af", `${edge},areverse,${edge},areverse`, "-c:a", "libmp3lame", "-b:a", "192k", dst]);
    seconds = await durationOf(dst);
  });
  return { bytes, seconds };
}
