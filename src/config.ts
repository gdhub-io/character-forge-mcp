import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Media provider and models, one per kind of output (concept, scene, video, music, voice). They live in models.json
 * at the package root (or the file named by CHARACTER_FORGE_MODELS) and are re-read on every call, so switching a
 * model needs no rebuild and no server restart. Missing keys fall back to the defaults below.
 */
export interface ModelsConfig {
  provider: "fal";
  providers: { fal: { apiKeyEnv: string; queueUrl: string; uploadUrl: string } };
  models: {
    /** A-pose sheet: GPT Image edit by default; img2img and controlnet are the alternative pipelines. */
    concept: { model: string; quality: string; img2img: string; controlnet: string };
    /** The character in their own place (idle still), referenced from concept.png. */
    scene: { model: string; quality: string };
    /** Idle loop: which family is the default, and the endpoints. The request body differs per family, so the
     * families themselves (kling, veo) are fixed in code; their endpoints are not. */
    video: { default: "kling" | "veo"; kling: string; veo: string; veoStartOnly: string };
    /** Theme music from a composition plan. */
    music: { model: string };
    /** Adults: ElevenLabs design + speech; minors: Qwen design, clone and speech. */
    voice: { adultDesign: string; adultSpeech: string; childDesign: string; childClone: string; childSpeech: string };
  };
  /** USD estimates for the per-character cost ledger (costs.ts). */
  pricing: {
    concept: { image: number };
    scene: { image: number };
    video: { kling: { second: number }; veo: { second: number; secondSilent: number } };
    music: { startedMinute: number };
    voice: { adult: { per1000Chars: number }; child: { per1000Chars: number } };
  };
}

const DEFAULTS: ModelsConfig = {
  provider: "fal",
  providers: {
    fal: { apiKeyEnv: "FAL_KEY", queueUrl: "https://queue.fal.run", uploadUrl: "https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3" },
  },
  models: {
    concept: { model: "openai/gpt-image-2.6/flare/edit", quality: "low", img2img: "fal-ai/z-image/turbo/image-to-image", controlnet: "fal-ai/z-image/turbo/controlnet" },
    scene: { model: "openai/gpt-image-2.6/flare/edit", quality: "medium" },
    video: {
      default: "kling",
      kling: "fal-ai/kling-video/o1/standard/image-to-video",
      veo: "fal-ai/veo3.1/fast/first-last-frame-to-video",
      veoStartOnly: "fal-ai/veo3.1/fast/image-to-video",
    },
    music: { model: "elevenlabs/music/v2.5" },
    voice: {
      adultDesign: "fal-ai/elevenlabs/text-to-voice/design/eleven-v3",
      adultSpeech: "fal-ai/elevenlabs/tts/eleven-v3",
      childDesign: "fal-ai/qwen-3-tts/voice-design/1.7b",
      childClone: "fal-ai/qwen-3-tts/clone-voice/1.7b",
      childSpeech: "fal-ai/qwen-3-tts/text-to-speech/1.7b",
    },
  },
  pricing: {
    concept: { image: 0.02 },
    scene: { image: 0.05 },
    video: { kling: { second: 0.084 }, veo: { second: 0.15, secondSilent: 0.1 } },
    music: { startedMinute: 0.6 },
    voice: { adult: { per1000Chars: 0.1 }, child: { per1000Chars: 0.09 } },
  },
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type Plain = Record<string, unknown>;
const merge = (base: Plain, over: Plain): Plain =>
  Object.fromEntries(
    Object.entries(base).map(([k, v]) => {
      const o = over?.[k];
      return [k, v && typeof v === "object" && !Array.isArray(v) && o && typeof o === "object" ? merge(v as Plain, o as Plain) : (o ?? v)];
    }),
  );

/** The current media config: models.json over the defaults. A broken file is an error, not a silent fallback. */
export function config(): ModelsConfig {
  const file = process.env.CHARACTER_FORGE_MODELS ?? path.join(ROOT, "models.json");
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return DEFAULTS;
  }
  try {
    return merge(DEFAULTS as unknown as Plain, JSON.parse(raw) as Plain) as unknown as ModelsConfig;
  } catch (e) {
    throw new Error(`${file} is not valid JSON: ${(e as Error).message}`);
  }
}

/** The provider's API key, from the environment variable the config names. */
export function apiKey(): string | undefined {
  return usableKey(process.env[config().providers.fal.apiKeyEnv]);
}

/** A plugin user who skipped the key gets an empty value (or an unexpanded ${user_config.…}): both mean no key. */
export function usableKey(value: string | undefined): string | undefined {
  const key = value?.trim();
  return key && !key.startsWith("${") ? key : undefined;
}
