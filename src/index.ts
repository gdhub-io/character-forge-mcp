#!/usr/bin/env node
import { parseArgs } from "node:util";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { RollOptionsSchema, rollToText } from "./random.js";
import { listCards, listToText, loadCard, loadCardFile, saveCard, writeCard } from "./store.js";
import { buildTposePrompt, DEFAULT_VIEWS, generateConcept, VIEWS, type Views } from "./concept.js";
import { checkCard, checkToText } from "./check.js";
import { MEDIA_KINDS, mediaBrief, type MediaKind } from "./media.js";

const HELP = `character-forge — MCP server + CLI for building characters

Usage:
  character-forge                      start the MCP server on stdio (what MCP clients run)
  character-forge roll [--variants N] [--anchor ROLE] [--seed N] [--medium M] [--genre G] [--human] [--json]
  character-forge validate <card.json> check a card against the schema
  character-forge check <card.json>    red flags + coherence interview for a draft card
  character-forge save <card.json> [--overwrite]
                                       validate and save into the library (json + md + html)
  character-forge render <id>          re-render card.md / card.html of a saved character
  character-forge prompt <id> [--style S] [--views ${VIEWS.join("|")}]
                                       print the T-pose image prompt
  character-forge concept <id> [--style S] [--views V] [--seed N] [--control 0-1] [--pose picture]
                                       generate concept.png on fal.ai with a pose ControlNet (needs FAL_KEY);
                                       --pose puts the character in the pose of a picture → concept-pose.png
  character-forge media <id> --kind ${MEDIA_KINDS.join("|")}
                                       print the brief for writing one generation prompt
  character-forge list                 list saved characters

Env:
  CHARACTER_FORGE_DIR             library folder (default ~/character-forge)
  FAL_KEY                         fal.ai key for concepts (fal-ai/z-image/turbo/controlnet)
  (a .env file in the working directory is loaded too)
  CHARACTER_FORGE_IMAGE_MODEL     override the fal endpoint
`;

// A .env in the working directory (gitignored) can hold FAL_KEY etc.; real env vars win.
try {
  process.loadEnvFile();
} catch {
  // no .env — fine
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      seed: { type: "string" },
      variants: { type: "string" },
      anchor: { type: "string" },
      medium: { type: "string" },
      genre: { type: "string" },
      human: { type: "boolean" },
      json: { type: "boolean" },
      overwrite: { type: "boolean" },
      style: { type: "string" },
      views: { type: "string" },
      extra: { type: "string" },
      kind: { type: "string" },
      pose: { type: "string" },
      mode: { type: "string" },
      strength: { type: "string" },
      figure: { type: "string" },
      control: { type: "string" },
    },
  });
  const views = (values.views ?? DEFAULT_VIEWS) as Views;
  if (!VIEWS.includes(views)) fail(`--views must be one of: ${VIEWS.join(", ")}`);
  const conceptOpts = {
    style: values.style,
    views,
    extra: values.extra,
    poseImage: values.pose,
    control: values.mode as "img2img" | "gpt" | "gpt2" | "pose" | "depth" | "canny" | undefined,
    strength: values.strength ? Number(values.strength) : undefined,
    figure: values.figure as "shaded" | "flat" | "mask" | "blocking" | "blocking-lit" | "skeleton" | undefined,
    seed: values.seed ? Number(values.seed) : undefined,
    controlScale: values.control ? Number(values.control) : undefined,
  };
  const arg = (what: string) => positionals[0] ?? fail(`Missing ${what}.`);

  switch (cmd) {
    case undefined:
    case "serve":
      await createServer().connect(new StdioServerTransport());
      return;
    case "roll": {
      const opts = RollOptionsSchema.safeParse({ ...values, allow_nonhuman: values.human ? false : undefined });
      if (!opts.success) fail(opts.error.issues.map((i) => `--${i.path.join(".")}: ${i.message}`).join("\n"));
      const r = rollToText(opts.data);
      console.log(values.json ? JSON.stringify(r.data, null, 2) : r.text);
      return;
    }
    case "validate":
      console.log(`OK: ${(await loadCardFile(arg("card.json path"))).meta.name}`);
      return;
    case "check":
      console.log(checkToText(checkCard(await loadCardFile(arg("card.json path")))));
      return;
    case "save": {
      const saved = await saveCard(await loadCardFile(arg("card.json path")), { overwrite: values.overwrite });
      console.log(`Saved as "${saved.slug}"\n  ${saved.files.html}\n  ${saved.files.markdown}\n  ${saved.files.json}`);
      return;
    }
    case "render": {
      const saved = await writeCard(await loadCard(arg("id")));
      console.log(`Rendered\n  ${saved.files.html}\n  ${saved.files.markdown}`);
      return;
    }
    case "prompt":
      console.log(buildTposePrompt(await loadCard(arg("id")), conceptOpts));
      return;
    case "concept": {
      console.error("Generating…");
      const r = await generateConcept(arg("id"), conceptOpts);
      if (!r.generated) fail(`${r.reason} Use \`prompt\` to get the text.`);
      console.log(`Concept (${r.image.provider}/${r.image.model}${r.image.seed !== undefined ? `, seed ${r.image.seed}` : ""})\n  ${r.file}\n  ${r.html}`);
      return;
    }
    case "media": {
      const kind = values.kind as MediaKind;
      if (!MEDIA_KINDS.includes(kind)) fail(`--kind must be one of: ${MEDIA_KINDS.join(", ")}`);
      console.log(mediaBrief(await loadCard(arg("id")), kind));
      return;
    }
    case "list":
      console.log(listToText(await listCards()));
      return;
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      return;
    default:
      fail(`Unknown command: ${cmd}\n\n${HELP}`);
  }
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
