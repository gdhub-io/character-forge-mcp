#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { checkCard, checkToText } from "./check.js";
import {
	buildTposePrompt,
	DEFAULT_VIEWS,
	generateConcept,
	importConcept,
	VIEWS,
	type Views,
} from "./concept.js";
import { config, usableKey } from "./config.js";
import { costsToText, readCosts } from "./costs.js";
import { MEDIA_KINDS, type MediaKind, mediaBrief } from "./media.js";
import { nextToText } from "./next.js";
import { RollOptionsSchema, rollToText } from "./random.js";
import { generateIdleVideo, generateScene, type VideoModel } from "./scene.js";
import { createServer, VERSION } from "./server.js";
import {
	listCards,
	listToText,
	loadCard,
	loadCardFile,
	saveCard,
	saveTranslation,
	writeCard,
} from "./store.js";
import { designVoice, speakLine } from "./voice.js";

const HELP = `character-forge — MCP server + CLI for building characters

Usage:
  character-forge                      start the MCP server on stdio (what MCP clients run)
  character-forge --version            print the version
  character-forge roll [--variants N] [--anchor ROLE] [--seed N] [--medium M] [--genre G] [--human] [--json]
  character-forge validate <card.json> check a card against the schema
  character-forge check <card.json>    red flags + coherence interview for a draft card
  character-forge save <card.json> [--overwrite]
                                       validate and save into the library (json + md)
  character-forge translate <id> <translated.json> [--lang ru]
                                       save a translation of a saved card as card.<lang>.json
  character-forge render <id>          re-render card.md of a saved character
  character-forge prompt <id> [--style S] [--views ${VIEWS.join("|")}]
                                       print the T-pose image prompt
  character-forge concept <id> [--style S] [--views V] [--seed N] [--control 0-1] [--pose picture]
                                       generate concept.png on fal.ai with a pose ControlNet (needs FAL_KEY);
                                       --pose puts the character in the pose of a picture → concept-pose.png
  character-forge media <id> --kind ${MEDIA_KINDS.join("|")}
                                       print the brief for writing one generation prompt
  character-forge scene <id> [--prompt P] [--notes N] [--quality low|medium|high]
                                       the character in their environment (scene.png, ≈$0.05)
  character-forge video <id> [--prompt P] [--notes N] [--seconds 8] [--model kling|veo] [--loop frame|crossfade|off] [--audio]
                                       looping idle clip from scene.png (Kling ≈$0.084/s silent; Veo $0.15/s with sound)
  character-forge voice <id> --description D --text T [--pitch -2]
                                       design the character's own voice (ElevenLabs for adults, Qwen + pitch for minors)
  character-forge say <id> --text T --name N
                                       speak one line in that voice → assets/voice/lines/N.mp3
  character-forge concept-import <id> <image>   use an existing concept image (path or URL) as concept.png
  character-forge next <id>            what can be made next for the character, with prices
  character-forge costs <id>           what the character has cost so far (estimates from models.json pricing)
  character-forge list                 list saved characters

Env:
  CHARACTER_FORGE_DIR             library folder (default ~/character-forge)
  FAL_KEY                         fal.ai key for all media (the variable name is set in models.json)
  CHARACTER_FORGE_MODELS          a models.json to use instead of the package's (provider + model per media kind)
  (a .env file in the working directory is loaded too)
`;

// A .env in the working directory (gitignored) can hold FAL_KEY etc.; real env vars win. An empty or unexpanded
// key from the plugin config must not block the .env one, so drop it first.
const keyEnv = config().providers.fal.apiKeyEnv;
if (!usableKey(process.env[keyEnv])) delete process.env[keyEnv];
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
			lang: { type: "string" },
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
			prompt: { type: "string" },
			notes: { type: "string" },
			quality: { type: "string" },
			seconds: { type: "string" },
			loop: { type: "string" },
			audio: { type: "boolean" },
			model: { type: "string" },
			pose: { type: "string" },
			mode: { type: "string" },
			strength: { type: "string" },
			figure: { type: "string" },
			control: { type: "string" },
			description: { type: "string" },
			text: { type: "string" },
			pitch: { type: "string" },
			name: { type: "string" },
		},
	});
	const views = (values.views ?? DEFAULT_VIEWS) as Views;
	if (!VIEWS.includes(views))
		fail(`--views must be one of: ${VIEWS.join(", ")}`);
	const conceptOpts = {
		style: values.style,
		views,
		extra: values.extra,
		poseImage: values.pose,
		control: values.mode as
			| "img2img"
			| "gpt"
			| "gpt2"
			| "pose"
			| "depth"
			| "canny"
			| undefined,
		strength: values.strength ? Number(values.strength) : undefined,
		figure: values.figure as
			| "shaded"
			| "flat"
			| "mask"
			| "blocking"
			| "blocking-lit"
			| "skeleton"
			| undefined,
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
			const opts = RollOptionsSchema.safeParse({
				...values,
				allow_nonhuman: values.human ? false : undefined,
			});
			if (!opts.success)
				fail(
					opts.error.issues
						.map((i) => `--${i.path.join(".")}: ${i.message}`)
						.join("\n"),
				);
			const r = rollToText(opts.data);
			console.log(values.json ? JSON.stringify(r.data, null, 2) : r.text);
			return;
		}
		case "validate":
			console.log(
				`OK: ${(await loadCardFile(arg("card.json path"))).meta.name}`,
			);
			return;
		case "check":
			console.log(
				checkToText(checkCard(await loadCardFile(arg("card.json path")))),
			);
			return;
		case "save": {
			const saved = await saveCard(await loadCardFile(arg("card.json path")), {
				overwrite: values.overwrite,
			});
			console.log(
				`Saved as "${saved.slug}"\n  ${saved.files.markdown}\n  ${saved.files.json}`,
			);
			return;
		}
		case "concept-import": {
			const r = await importConcept(
				arg("id"),
				positionals[1] ?? fail("Missing image path or URL."),
			);
			console.log(`Concept imported\n  ${r.file}\n  ${r.card}`);
			return;
		}
		case "next": {
			console.log(nextToText(arg("id")));
			return;
		}
		case "costs": {
			console.log(costsToText(arg("id"), await readCosts(arg("id"))));
			return;
		}
		case "translate": {
			// character-forge translate <id> <file.json> --lang ru
			const file = await saveTranslation(
				arg("id"),
				values.lang ?? "ru",
				JSON.parse(
					await readFile(
						positionals[1] ?? fail("Missing translated card.json path."),
						"utf8",
					),
				),
			);
			console.log(`Translation saved\n  ${file}`);
			return;
		}
		case "render": {
			const saved = await writeCard(await loadCard(arg("id")));
			console.log(`Rendered\n  ${saved.files.markdown}`);
			return;
		}
		case "prompt":
			console.log(buildTposePrompt(await loadCard(arg("id")), conceptOpts));
			return;
		case "concept": {
			console.error("Generating…");
			const r = await generateConcept(arg("id"), conceptOpts);
			if (!r.generated) fail(`${r.reason} Use \`prompt\` to get the text.`);
			console.log(
				`Concept (${r.image.provider}/${r.image.model}${r.image.seed !== undefined ? `, seed ${r.image.seed}` : ""})\n  ${r.file}\n  ${r.card}`,
			);
			return;
		}
		case "media": {
			const kind = values.kind as MediaKind;
			if (!MEDIA_KINDS.includes(kind))
				fail(`--kind must be one of: ${MEDIA_KINDS.join(", ")}`);
			console.log(mediaBrief(await loadCard(arg("id")), kind));
			return;
		}
		case "scene": {
			const r = await generateScene(arg("id"), {
				prompt: values.prompt,
				notes: values.notes,
				quality: values.quality as "low" | "medium" | "high" | undefined,
			});
			console.log(`Scene: ${r.file}`);
			return;
		}
		case "video": {
			const r = await generateIdleVideo(arg("id"), {
				prompt: values.prompt,
				notes: values.notes,
				seconds: values.seconds ? Number(values.seconds) : undefined,
				loop: values.loop as "frame" | "crossfade" | "off" | undefined,
				audio: values.audio,
				model: values.model as VideoModel | undefined,
			});
			console.log(`Video (${r.seconds}s): ${r.file}`);
			return;
		}
		case "voice": {
			if (!values.description || !values.text)
				fail("voice needs --description and --text");
			const r = await designVoice(arg("id"), {
				description: values.description!,
				text: values.text!,
				pitchSemitones: values.pitch ? Number(values.pitch) : undefined,
			});
			console.log(`Voice (${r.engine}):\n${r.files.join("\n")}`);
			return;
		}
		case "say": {
			if (!values.text || !values.name) fail("say needs --text and --name");
			console.log(
				await speakLine(arg("id"), { text: values.text!, name: values.name! }),
			);
			return;
		}
		case "list":
			console.log(listToText(await listCards()));
			return;
		case "--version":
		case "-v":
			console.log(VERSION);
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
