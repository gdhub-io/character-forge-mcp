import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * fal.ai queue client for pose-controlled image generation (default: fal-ai/z-image/turbo/controlnet,
 * ~$0.0065 per megapixel). Auth: FAL_KEY. Raw HTTP, no SDK.
 */

export const FAL_DEFAULT_MODEL = "fal-ai/z-image/turbo/controlnet";
export const FAL_IMG2IMG_MODEL = "fal-ai/z-image/turbo/image-to-image";
/** GPT Image editor: follows the block-in as a reference and keeps both views consistent. Token-priced (low ≈ $0.02/sheet). */
export const FAL_GPT_EDIT_MODEL = "openai/gpt-image-2.6/flare/edit";

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
const TIMEOUT_MS = 180_000;

export async function falControlGenerate(input: FalControlInput): Promise<FalResult> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set");
  const img2img = input.preprocess === "img2img";
  const gpt = input.preprocess === "gpt";
  const model = gpt ? FAL_GPT_EDIT_MODEL : img2img ? FAL_IMG2IMG_MODEL : (process.env.CHARACTER_FORGE_IMAGE_MODEL ?? FAL_DEFAULT_MODEL);
  const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json" };
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
        quality: process.env.CHARACTER_FORGE_GPT_QUALITY ?? "low", // the endpoint defaults to high (~10x the cost)
        reasoning_effort: "low",
        output_format: "png",
        enable_safety_checker: true,
      }
    : { ...common, ...specific };
  const submit = await fetch(`https://queue.fal.run/${model}`, { method: "POST", headers, body: JSON.stringify(body) });
  const queued = (await submit.json()) as { status_url?: string; response_url?: string; detail?: unknown };
  if (!submit.ok || !queued.status_url || !queued.response_url) throw new Error(`fal submit ${submit.status}: ${JSON.stringify(queued.detail ?? queued)}`);

  // Always use the URLs fal returns: hand-built ones that include the model path answer 405.
  const deadline = Date.now() + TIMEOUT_MS;
  for (;;) {
    const st = (await (await fetch(queued.status_url, { headers })).json()) as { status: string; error?: string };
    if (st.status === "COMPLETED") {
      if (st.error) throw new Error(`fal failed: ${st.error}`);
      break;
    }
    if (Date.now() > deadline) throw new Error("fal timed out after 3 minutes");
    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  const res = await fetch(queued.response_url, { headers });
  const out = (await res.json()) as { images?: { url: string; content_type?: string }[]; seed: number; has_nsfw_concepts?: boolean[]; detail?: unknown };
  if (!res.ok || !out.images?.[0]) throw new Error(`fal result ${res.status}: ${JSON.stringify(out.detail ?? out)}`);
  if (out.has_nsfw_concepts?.[0]) throw new Error("fal safety checker blocked the image; adjust the prompt");
  const img = await fetch(out.images[0].url);
  return { bytes: Buffer.from(await img.arrayBuffer()), mimeType: out.images[0].content_type ?? "image/png", seed: out.seed ?? input.seed ?? 0, model };
}

/**
 * Uploads bytes to fal storage and returns a CDN URL. Model endpoints ignored our data-URI control
 * images (identical outputs at different control scales), so control images always go by URL.
 * Files are readable by anyone with the link (fal's default ACL).
 */
export async function falUpload(bytes: Buffer, contentType: string, fileName: string): Promise<string> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set");
  const init = await fetch("https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3", {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
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
  if (/^https?:/.test(ref)) return ref;
  const ext = path.extname(ref).slice(1).toLowerCase();
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
  return falUpload(await readFile(ref), mime, path.basename(ref));
}
