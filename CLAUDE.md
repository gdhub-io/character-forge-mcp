# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`character-forge-mcp` is an open-source MCP server, CLI and Claude Code plugin that creates characters for film, games, ads and books. Each character comes as a package: a card (`card.json`, `card.md`), a look derived from the story, and an A-pose concept sheet (`concept.png`). On request, the tool also writes generation prompts for an illustration, voice, video or song. The method behind the card is a screenwriting konspekt: Sheridan's 9 sections plus Dougan's best/worst/other traits. All product text, including cards, prompts and docs, is **English only**.

## Commands

```bash
npm run build                    # tsc → dist/ (tests and MCP clients run dist/, so build first)
npm test                         # build + node --test test/*.test.mjs
npm run build && node --test --test-name-pattern="variants" test/forge.test.mjs   # single test
npm run inspect                  # MCP Inspector against dist/index.js
npm run lint                     # Biome lint + format check (CI runs it); npm run format fixes

# CLI (same binary; no args = MCP server on stdio)
CHARACTER_FORGE_DIR=./characters node dist/index.js roll --variants 3 --anchor fisherman
node dist/index.js check examples/marta-vell.json    # red flags + coherence interview
node dist/index.js save examples/marta-vell.json --overwrite
node dist/index.js prompt marta-vell                  # A-pose image prompt
node dist/index.js media marta-vell --kind voice      # brief for one generation prompt
```

Biome (`biome.jsonc`) lints and formats: tabs, double quotes, sorted imports. TypeScript is strict, and the package is ESM (`NodeNext`), so relative imports need a `.js` extension. The end-to-end test in `test/forge.test.mjs` spawns `dist/index.js` over stdio with a real MCP client.

## Architecture

**Core idea: random but coherent.** A character is one causal chain: wound → lie → fear → defense (worst trait) / gift (best trait) → truth (need). `src/engine.ts` holds hand-curated `WOUNDS`, which are coherent by construction. `src/random.ts` picks one chain plus independent "sparks" (occupation, archetype, setting, visible mark) that the model has to make serve the chain. Never roll traits independently; that is the design this replaced. Rolls are seeded (`mulberry32`) and every field is rolled in a fixed order, so the same seed always gives the same result regardless of overrides.

**Variant tournament (the default flow).** `rollVariants` makes 3 variants of one concept. They share the anchor and world (`SHARED_KEYS`), and each has a distinct wound, archetype and age band. The roles are author, coherence reviewer, critic (prosecutor), judge and designer. They are defined once in `src/tournament.ts` (`ROLE_GUIDES`, `RUBRIC`, `TOURNAMENT_PROTOCOL`) and served by the `character_role` and `character_method` tools. Server instructions, MCP prompts and `skills/forge-character/SKILL.md` deliberately only *point* to that protocol; keep it that way so the copies don't drift. In Claude Code, the skill spawns real subagents (`agents/*.md`) with fresh context. After judging, the designer derives the winner's `look` section from the story. Only the winner gets the A-pose concept. In other MCP clients one model plays every role.

**Card pipeline.** `src/schema.ts` (zod) is the single source of truth for the card. It is also the `character_save` input schema the model sees, so field `.describe()` texts are effectively prompt text. Adding a field touches:
1. `schema.ts`
2. `sections()` in `src/render.ts`, a single section/block model rendered to Markdown
3. `examples/marta-vell.json`, which must stay valid; tests use it
4. optionally the question list in `src/check.ts`
5. optionally `METHOD_GUIDE` in `src/methodology.ts`

The card's `look` section (shape language, silhouette, perfection, signature item, marks with origins, movement, outfit, palette with meanings, 3 "story reads") is the single source for every visual output. `description.physical` holds only body, face and hair, so marks, movement and clothing live in `look` and nowhere else.

`src/check.ts` adds mechanical red flags (generic phrases, repeats, want ≈ need, thin core) and a coherence interview built from the card's own values.

**Layers.**
- `src/store.ts` is the library on disk, at `CHARACTER_FORGE_DIR` (default `~/character-forge`), one folder per slug. `StoredCard` is a card with a known slug. `writeCard` re-renders md, and embeds `assets/concept.png` if it exists. Each character folder keeps the card at its root, every generated file (images, video, sound) in `assets/` and every prompt in `prompts/` (`saveAsset`, `savePrompt`); `loadCard` moves files from the old flat layout on first read.
- `models.json` (package root, or `CHARACTER_FORGE_MODELS`) holds the media provider (fal) and one model per kind: concept, scene, video, music, voice. `src/config.ts` re-reads it on every call, so switching a model needs no rebuild or restart; missing keys fall back to its defaults.
- `src/concept.ts` builds the A-pose prompt and owns `generateConcept()`, the single pipeline shared by the CLI and the MCP tool. Image generation is **fal.ai only**: no `FAL_KEY` means prompt only. Decisions below were tested on Marta, with the same seed throughout:
- **Default pipeline (`mode: "gpt"`):** `src/pose.ts` draws an OpenPose-style skeleton from `look.body` (front and back), uploaded and given to GPT Image 2.6 edit as the pose reference together with the full look; about $0.02 a sheet. The paragraphs below describe the earlier paths, still available through `mode`.
- **Z-Image image-to-image (`mode: "img2img"`):** `src/pose.ts` renders a faceless **A-pose figure** from `look.body`, anatomically proportioned on the 8-head canon (lit capsules and ellipsoids with a z-buffer; PNG via zlib, no image deps). It is **colour-blocked** with `look.blocking` zone colours (hair, skin, top, bottom, left/right footwear), like an artist's block-in. Colour blocking was the decisive fix: a grey mannequin bleeds grey into the result, while blocked colours carry through. `src/fal.ts` uploads it to fal storage and repaints it with `fal-ai/z-image/turbo/image-to-image` at strength 0.85. Z-Image has 8 steps, so strength is quantised to 1/8: 0.75 greys the colours, ≥0.9 loses the pose.
- **SDXL ControlNet Union** held the skeleton pose but the quality was unusable (junk objects, text). The user rejected it; don't reintroduce it.
- **ControlNet** (`fal-ai/z-image/turbo/controlnet`) is kept only as an option (`mode: pose | depth | canny`). In every variant it barely held the pose: drawn OpenPose skeletons were ignored; pose and depth on the mannequin gave pixel-identical outputs. Don't make it the default again without new evidence.
- **GPT Image 2.6 Flare Edit** (`mode: "gpt"`, quality forced to `low`; the endpoint defaults to the ~10× pricier `high`) takes the block-in as a reference. It was the best at keeping both views consistent: sides, accessories and mismatched boots. It still flattens shoulder tilt and drifts toward realism. Accessories need an `item` label, or blobs get drawn as armour.
- **Style:** concepts use `DEFAULT_ART_STYLE` (house style). `style: "card"` uses `look.art_style`; any other text renders a variant saved as `concept-<style>.png`.
- **Control images must be URLs.** Upload them with `falUpload`; data URIs were silently ignored.
- **The prompt must fit Z-Image's ~512-token encoder** (a test enforces about 1800 characters, most important first, no hex codes). Long prompts silently dropped the outfit.
- `index.ts` loads a `.env` from the working directory.
- `src/media.ts` serves generation prompts **on request only**, one kind per call: `character_prompt` returns the target-specific rules plus card material, the model writes the prompt, and `character_prompt_save` stores it as `prompts/<kind>.md`. Never wire media prompts into character creation. The concept kind reuses `buildTposePrompt`.
- `src/tools/` has one file per MCP tool, wired in `src/tools/index.ts`. `src/prompts/` holds the MCP prompts.
- `src/index.ts` is the CLI and stdio entry. CLI commands reuse store, concept and random helpers. For example, `RollOptionsSchema` drives both the `character_create` input and CLI flag parsing. `character_create` is the single entry for a new character (random, brief, concept image, or both); a user image travels in `meta.concept_image`, and `character_pick` imports it as the winner's concept.
- `src/methodology.ts` holds `METHOD_GUIDE` and the konspekt's lists. Most lists are not rolled; `referenceLists()` gives them to the model as menus via `character_method`.

**Plugin.** The repo root is a Claude Code plugin (`.claude-plugin/plugin.json` and `marketplace.json`, with `skills/`, `agents/`). The plugin's MCP server runs `npx -y @gdhub/character-forge-mcp@latest` from npm, so installing from GitHub needs no build; inside the repo `.mcp.json` runs the local `dist/` instead. `.claude/skills` and `.claude/agents` are symlinks to the root folders for in-repo development; edit the originals. Don't install the plugin while developing here, or the skill and agents load twice. `.mcp.json` runs the local server with `CHARACTER_FORGE_DIR=./characters`, which is gitignored. The server reads its version from `package.json`; Release Please bumps it together with `plugin.json` (a test checks they match).

## Workflow and releases

- **Nobody pushes to `main`.** Every change goes intent → branch → develop (with tests) → refactor (`simplify`) → review (`code-review`, `npm run lint`, `npm test`) → pull request. The `contribute` skill (`.claude/skills/contribute`) walks through it; CONTRIBUTING.md is the human version.
- **PR titles and commits follow Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `!` for breaking). PRs are squash-merged, so the title is the commit Release Please reads.
- **Never bump versions or edit CHANGELOG.md by hand.** Release Please keeps a release PR open; merging it tags the version, writes the changelog, creates the GitHub release and publishes to npm (`.github/workflows/release.yml`).
- CI (`.github/workflows/ci.yml`) runs lint and tests on Node 20 and 22 and type-checks the site. Tests must never call paid APIs.
