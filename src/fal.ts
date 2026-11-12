import { readFile } from "node:fs/promises";
import path from "node:path";

import { apiKey, config } from "./config.js";

/** fal.ai queue client (raw HTTP, no SDK). The key, URLs and models come from models.json (see config.ts). */

export interface FalControlInput {
  prompt: string;
  /** Control image URL (see falUpload). */
  imageUrl: string;
  width: number;
  height: number;
  /**
   * How the control image is used: a ControlNet condition (detect a pose, estimate depth, trace edges),
   * or "img2img" — the image is the starting canvas and keeps the composition (see strength).
   */
  preprocess: "none" | "pose" | "depth" | "canny" | "img2img" | "gpt";
  /** img2img only: how much to repaint the starting image, 0-1. */
  strength?: number;
  controlScale?: number;
  seed?: number;
}

export interface FalResult {
  bytes: Buffer;
  mimeType: string;
  seed: number;
  model: string;
}

const POLL_MS = 1500;

function requireKey(): string {
  const key = apiKey();
  if (!key) throw new Error(`${config().providers.fal.apiKeyEnv} is not set`);
  return key;
}
const TIMEOUT_MS = 180_000;

export async function falControlGenerate(input: FalControlInput): Promise<FalResult> {
  const img2img = input.preprocess === "img2img";
  const gpt = input.preprocess === "gpt";
  const m = config().models.concept;
  const model = gpt ? m.model : img2img ? m.img2img : m.controlnet;
  const common = {
    prompt: input.prompt,
    image_url: input.imageUrl,
    image_size: { width: input.width, height: input.height },
    num_inference_steps: 8,
    output_format: "png",
    enable_safety_checker: true,
    ...(input.seed !== undefined ? { seed: input.seed } : {}),
  };
  const specific = img2img
    ? { strength: input.strength ?? 0.85 }
    : { preprocess: input.preprocess, control_scale: input.controlScale ?? 0.75, control_end: 1.0 };

  const body = gpt
    ? {
        prompt: input.prompt,
        image_urls: [input.imageUrl],
        image_size: "auto",
        quality: m.quality, // the endpoint defaults to high (~10x the cost)
        reasoning_effort: "low",
        output_format: "png",
        enable_safety_checker: true,
      }
    : { ...common, ...specific };
  const out = await falQueue(model, body);
  return { bytes: out.bytes, mimeType: out.mimeType, seed: out.seed ?? input.seed ?? 0, model };
}

/**
 * Submits to fal's queue, waits, downloads the first output file. `kind` picks the output field:
 * "images" (images[0]) or "video" (video). Always polls the URLs fal returns (hand-built ones answer 405).
 */
export async function falQueue(model: string, body: Record<string, unknown>, kind: "images" | "video" | "audio" = "images", timeoutMs = TIMEOUT_MS): Promise<{ bytes: Buffer; mimeType: string; seed?: number }> {
  type FileOut = { url: string; content_type?: string };
  const out = await falQueueJson<{ images?: FileOut[]; video?: FileOut; audio?: FileOut; seed?: number; has_nsfw_concepts?: boolean[] }>(model, body, timeoutMs);
  const file = kind === "images" ? out.images?.[0] : out[kind];
  if (!file) throw new Error(`fal result has no ${kind}: ${JSON.stringify(out).slice(0, 500)}`);
  if (out.has_nsfw_concepts?.[0]) throw new Error("fal safety checker blocked the output; adjust the prompt");
  return { bytes: await falDownload(file.url), mimeType: file.content_type ?? { images: "image/png", video: "video/mp4", audio: "audio/mpeg" }[kind], seed: out.seed };
}

/** Submits to fal's queue, waits, returns the raw result JSON. Always polls the URLs fal returns (hand-built ones answer 405). */
export async function falQueueJson<T>(model: string, body: Record<string, unknown>, timeoutMs = TIMEOUT_MS): Promise<T> {
  const headers = { Authorization: `Key ${requireKey()}`, "Content-Type": "application/json" };
  const submit = await fetch(`${config().providers.fal.queueUrl}/${model}`, { method: "POST", headers, body: JSON.stringify(body) });
  const queued = (await submit.json()) as { status_url?: string; response_url?: string; detail?: unknown };
  if (!submit.ok || !queued.status_url || !queued.response_url) throw new Error(`fal submit ${submit.status}: ${JSON.stringify(queued.detail ?? queued)}`);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const st = (await (await fetch(queued.status_url, { headers })).json()) as { status: string; error?: string };
    if (st.status === "COMPLETED") {
      if (st.error) throw new Error(`fal failed: ${st.error}`);
      break;
    }
    if (Date.now() > deadline) throw new Error(`fal timed out after ${Math.round(timeoutMs / 60000)} minutes`);
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  const res = await fetch(queued.response_url, { headers });
  const out = (await res.json()) as T & { detail?: unknown };
  if (!res.ok) throw new Error(`fal result ${res.status}: ${JSON.stringify(out.detail ?? out).slice(0, 500)}`);
  return out;
}

export const isUrl = (s: string) => /^https?:/.test(s);

export async function falDownload(url: string): Promise<Buffer> {
  const dl = await fetch(url);
  if (!dl.ok) throw new Error(`fal download ${dl.status}: ${url}`);
  return Buffer.from(await dl.arrayBuffer());
}

/**
 * Uploads bytes to fal storage and returns a CDN URL. Model endpoints ignored our data-URI control
 * images (identical outputs at different control scales), so control images always go by URL.
 * Files are readable by anyone with the link (fal's default ACL).
 */
export async function falUpload(bytes: Buffer, contentType: string, fileName: string): Promise<string> {
  const init = await fetch(config().providers.fal.uploadUrl, {
    method: "POST",
    headers: { Authorization: `Key ${requireKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ file_name: fileName, content_type: contentType }),
  });
  const json = (await init.json()) as { upload_url?: string; file_url?: string; detail?: unknown };
  if (!init.ok || !json.upload_url || !json.file_url) throw new Error(`fal upload initiate ${init.status}: ${JSON.stringify(json.detail ?? json)}`);
  const put = await fetch(json.upload_url, { method: "PUT", headers: { "Content-Type": contentType }, body: new Uint8Array(bytes) });
  if (!put.ok) throw new Error(`fal upload PUT ${put.status}`);
  return json.file_url;
}

/** URLs pass through; a local file is uploaded to fal storage. */
export async function toImageUrl(ref: string): Promise<string> {
  if (isUrl(ref)) return ref;
  const ext = path.extname(ref).slice(1).toLowerCase();
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
  return falUpload(await readFile(ref), mime, path.basename(ref));
}
