import assert from "node:assert/strict";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const example = JSON.parse(
	readFileSync(path.join(root, "examples/marta-vell.json"), "utf8"),
);
const { roll, rollVariants } = await import(path.join(root, "dist/random.js"));
const { validateCard } = await import(path.join(root, "dist/store.js"));
const { buildTposePrompt } = await import(path.join(root, "dist/concept.js"));
const { checkCard } = await import(path.join(root, "dist/check.js"));
const { WOUNDS } = await import(path.join(root, "dist/engine.js"));
const { mannequinPng, poseKeypoints, AVERAGE_BODY } = await import(
	path.join(root, "dist/pose.js")
);

/** Runs fn with a fresh, temporary library, restoring CHARACTER_FORGE_DIR afterwards. */
async function withLibrary(fn) {
	const dir = mkdtempSync(path.join(os.tmpdir(), "cf-lib-"));
	const prev = process.env.CHARACTER_FORGE_DIR;
	process.env.CHARACTER_FORGE_DIR = dir;
	try {
		return await fn(dir);
	} finally {
		if (prev === undefined) delete process.env.CHARACTER_FORGE_DIR;
		else process.env.CHARACTER_FORGE_DIR = prev;
		rmSync(dir, { recursive: true, force: true });
	}
}

test("roll is deterministic per seed and respects overrides", () => {
	assert.deepEqual(roll({ seed: 42 }), roll({ seed: 42 }));
	assert.notDeepEqual(roll({ seed: 42 }), roll({ seed: 43 }));
	const fixed = roll({ seed: 42, medium: "film", genre: "noir" });
	assert.equal(fixed.sparks.medium, "film");
	assert.equal(fixed.sparks.genre, "noir");
	assert.deepEqual(fixed.engine, roll({ seed: 42 }).engine);
	assert.equal(
		roll({ seed: 7, allow_nonhuman: false }).sparks.species,
		"human",
	);
});

test("roll engine is always one coherent chain from the same wound", () => {
	for (let seed = 0; seed < 300; seed++) {
		const { engine } = roll({ seed });
		const w = WOUNDS.find((x) => x.wound === engine.wound);
		assert.ok(w, `unknown wound for seed ${seed}`);
		assert.equal(engine.lie, w.lie);
		assert.equal(engine.truth, w.truth);
		assert.ok(w.fears.includes(engine.fear));
		assert.ok(w.defenses.includes(engine.worst_trait));
		assert.ok(w.gifts.includes(engine.best_trait));
		assert.ok(w.arcs.includes(engine.arc_goal));
	}
});

test("variants share the anchor and world but have distinct cores", () => {
	const r = rollVariants({ seed: 5, anchor: "fisherman" }, 3);
	assert.equal(r.variants.length, 3);
	assert.deepEqual(
		r.variants.map((v) => v.label),
		["A", "B", "C"],
	);
	for (const v of r.variants) {
		assert.equal(v.sparks.occupation, "fisherman");
		assert.equal(v.sparks.setting, r.shared.setting);
		assert.equal(v.sparks.genre, r.shared.genre);
	}
	assert.equal(new Set(r.variants.map((v) => v.engine.wound)).size, 3);
	for (let seed = 0; seed < 200; seed++) {
		const vs = rollVariants({ seed }, 3).variants;
		assert.equal(new Set(vs.map((v) => v.sparks.archetype)).size, 3);
		assert.equal(new Set(vs.map((v) => v.sparks.age_band)).size, 3);
	}
	assert.deepEqual(rollVariants({ seed: 5, anchor: "fisherman" }, 3), r);
});

test("check flags generic filler and want = need", () => {
	const card = structuredClone(validateCard(example).card);
	assert.equal(checkCard(card).warnings.length, 0);
	card.uniqueness.twist = "She has a mysterious past";
	card.goals.need = card.goals.want;
	const w = checkCard(card).warnings.join("\n");
	assert.match(w, /uniqueness\.twist: generic phrase "mysterious"/);
	assert.match(w, /want and goals\.need/);
});

test("example card validates; broken card reports paths", () => {
	assert.equal(validateCard(example).ok, true);
	const broken = structuredClone(example);
	broken.psychology.inner_monologue = ["only one"];
	broken.uniqueness.quirks = ["a"];
	const r = validateCard(broken);
	assert.equal(r.ok, false);
	assert.match(r.issues, /psychology\.inner_monologue/);
	assert.match(r.issues, /uniqueness\.quirks/);
});

test("A-pose prompt carries the visual essentials", () => {
	const p = buildTposePrompt(validateCard(example).card);
	assert.match(p, /A-pose/);
	assert.match(p, /Drowned Slate/);
	assert.match(p, /barometer/);
	assert.match(p, /front view/);
});

test("MCP server: tools, roll, save, concept prompt, list", async () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), "cforge-"));
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: [path.join(root, "dist/index.js")],
		// cwd = temp dir so the project's .env (FAL_KEY) is never loaded: tests must not call paid APIs.
		cwd: dir,
		env: { PATH: process.env.PATH ?? "", CHARACTER_FORGE_DIR: dir },
	});
	const client = new Client({ name: "test", version: "0" });
	await client.connect(transport);
	try {
		const { tools } = await client.listTools();
		assert.deepEqual(tools.map((t) => t.name).sort(), [
			"character_check",
			"character_concept",
			"character_costs",
			"character_create",
			"character_get",
			"character_list",
			"character_method",
			"character_next",
			"character_pick",
			"character_prompt",
			"character_prompt_save",
			"character_role",
			"character_save",
			"character_scene",
			"character_theme",
			"character_translate",
			"character_video",
			"character_voice",
			"character_voice_line",
			"character_voice_translation",
		]);
		const { prompts } = await client.listPrompts();
		assert.equal(prompts.length, 2);

		const rolled = await client.callTool({
			name: "character_create",
			arguments: { seed: 1337, variants: 1 },
		});
		assert.equal(rolled.structuredContent.seed, 1337);

		assert.ok(rolled.structuredContent.engine.lie);

		const set = await client.callTool({
			name: "character_create",
			arguments: {
				anchor: "fisherman",
				seed: 9,
				brief: "an old fisherman who fears the sea",
			},
		});
		assert.equal(set.structuredContent.variants.length, 3);
		assert.equal(set.structuredContent.mode, "brief");
		const fromImage = await client.callTool({
			name: "character_create",
			arguments: {
				seed: 9,
				concept: path.join(root, "examples", "missing.png"),
			},
		});
		assert.equal(fromImage.isError, true);

		const role = await client.callTool({
			name: "character_role",
			arguments: { role: "critic" },
		});
		assert.match(role.content[0].text, /PROSECUTOR/);

		const checked = await client.callTool({
			name: "character_check",
			arguments: { card: example },
		});
		assert.ok(!checked.isError);
		assert.match(checked.content[0].text, /COHERENCE INTERVIEW/);

		const bad = await client.callTool({
			name: "character_save",
			arguments: { card: { meta: { name: "X" } } },
		});
		assert.equal(bad.isError, true);

		const saved = await client.callTool({
			name: "character_save",
			arguments: { card: example },
		});
		assert.ok(!saved.isError, saved.content?.[0]?.text);
		const id = saved.structuredContent.id;
		assert.equal(id, "marta-vell");
		for (const f of ["card.json", "card.md"])
			assert.ok(existsSync(path.join(dir, id, f)), f);
		assert.ok(!existsSync(path.join(dir, id, "card.html")), "no card.html");

		const again = await client.callTool({
			name: "character_save",
			arguments: { card: example },
		});
		assert.equal(again.structuredContent.id, "marta-vell-2");

		const concept = await client.callTool({
			name: "character_concept",
			arguments: { id, dry_run: true },
		});
		assert.equal(concept.structuredContent.generated, false);
		assert.match(concept.structuredContent.prompt, /A-pose/);

		const brief = await client.callTool({
			name: "character_prompt",
			arguments: { id, kind: "song" },
		});
		assert.match(brief.content[0].text, /Suno/);
		assert.match(brief.content[0].text, /barometer/);
		const promptSaved = await client.callTool({
			name: "character_prompt_save",
			arguments: {
				id,
				kind: "song",
				sections: [
					{ label: "Title", text: "Chalk's Free" },
					{ label: "Style", text: "sea shanty, folk" },
				],
			},
		});
		assert.ok(existsSync(promptSaved.structuredContent.file));
		const theme = await client.callTool({
			name: "character_prompt",
			arguments: { id, kind: "theme" },
		});
		assert.match(theme.content[0].text, /Composition plan/);
		assert.match(theme.content[0].text, /Dramatic question/);

		const list = await client.callTool({
			name: "character_list",
			arguments: {},
		});
		assert.equal(list.structuredContent.items.length, 2);
	} finally {
		await client.close();
		rmSync(dir, { recursive: true, force: true });
	}
});

test("plugin manifest and MCP Registry entry match package.json", () => {
	const read = (f) => JSON.parse(readFileSync(path.join(root, f), "utf8"));
	const pkg = read("package.json");
	assert.equal(read(".claude-plugin/plugin.json").version, pkg.version);
	// The Registry rejects a publish whose name or version disagrees with the npm package.
	const server = read("server.json");
	assert.equal(server.name, pkg.mcpName);
	assert.equal(server.version, pkg.version);
	assert.equal(server.packages[0].identifier, pkg.name);
	assert.equal(server.packages[0].version, pkg.version);
});

test("A-pose prompt never doubles punctuation", () => {
	const card = structuredClone(validateCard(example).card);
	card.description.physical.face = "Scarred!";
	const p = buildTposePrompt(card);
	assert.doesNotMatch(p, /\.\.|!\./);
});

test("mannequin is a valid PNG of the right size", () => {
	for (const [layout, w, h] of [
		["front", 1024, 1536],
		["front-back", 1536, 1024],
	]) {
		const { png, width, height } = mannequinPng(layout);
		assert.deepEqual([width, height], [w, h]);
		assert.equal(png.subarray(1, 4).toString(), "PNG");
		assert.equal(png.readUInt32BE(16), w);
		assert.equal(png.readUInt32BE(20), h);
	}
});

test("custom-pose prompt drops the A-pose wording", () => {
	const card = validateCard(example).card;
	assert.match(buildTposePrompt(card), /A-pose/);
	assert.doesNotMatch(buildTposePrompt(card, { poseImage: "x.png" }), /A-pose/);
});

test("skeleton follows the card's body, not a template", () => {
	const avg = poseKeypoints(AVERAGE_BODY);
	const broad = poseKeypoints({ ...AVERAGE_BODY, shoulders: 1.4 });
	assert.ok(broad[5][0] > avg[5][0], "broad shoulders sit wider");
	const leftLow = poseKeypoints({ ...AVERAGE_BODY, shoulder_tilt: -1 });
	assert.ok(leftLow[5][1] > leftLow[2][1], "left shoulder lower than right");
	const stoop = poseKeypoints({ ...AVERAGE_BODY, stoop: 1 });
	assert.ok(stoop[0][1] > avg[0][1], "a stoop drops the head");
	const tiltRight = poseKeypoints({ ...AVERAGE_BODY, head_tilt: 1 });
	assert.ok(
		tiltRight[0][0] < 0,
		"head cants toward the character's right (screen left)",
	);
	const bow = poseKeypoints({ ...AVERAGE_BODY, knees: "bow" });
	assert.ok(bow[12][0] > avg[12][0], "bow legs push knees out");
	const card = validateCard(example).card;
	assert.ok(
		!mannequinPng("front", card.look.body).png.equals(
			mannequinPng("front").png,
		),
		"images should differ",
	);
});

test("A-pose prompt carries the body, wear and an anti-idealization line", () => {
	const p = buildTposePrompt(validateCard(example).card);
	assert.match(p, /LEFT shoulder visibly lower/);
	assert.match(p, /Wear and care: /);
	assert.match(p, /Not idealized/);
});

test("body words name the right side", () => {
	const card = structuredClone(validateCard(example).card);
	card.look.body = { ...card.look.body, shoulder_tilt: -0.5, head_tilt: 0.4 };
	const p = buildTposePrompt(card);
	assert.match(p, /LEFT shoulder visibly lower/);
	assert.match(p, /head canted toward the RIGHT shoulder/);
});

test("clip does not leave a stray word after a sentence end", async () => {
	const { clip } = await import(path.join(root, "dist/concept.js"));
	assert.equal(
		clip(
			"Keep the left side. Keep the right boot on the belt. FRONT: barometer disc at the bib",
			60,
		),
		"Keep the left side. Keep the right boot on the belt",
	);
});

test("colour blocking paints zones and keeps the character's left and right", () => {
	const card = validateCard(example).card;
	const plain = mannequinPng("front", card.look.body, "shaded");
	const blocked = mannequinPng(
		"front",
		card.look.body,
		"blocking",
		card.look.blocking,
	);
	assert.ok(!plain.png.equals(blocked.png), "images should differ");
	// Without zone colours the blocking style falls back to the grey mannequin.
	assert.ok(
		mannequinPng("front", card.look.body, "blocking").png.equals(plain.png),
		"images should be identical",
	);
});

test("tournament variants are drafts; picking a winner keeps it and deletes the other variants", async () => {
	await withLibrary(async (dir) => {
		const { saveCard, pickWinner } = await import(
			path.join(root, "dist/store.js")
		);
		const variant = (name, v) => ({
			...example,
			meta: { ...example.meta, slug: undefined, name, group: "g1", variant: v },
		});
		const a = await saveCard(variant("Alpha One", "A"));
		const b = await saveCard(variant("Beta Two", "B"));
		const solo = await saveCard({
			...example,
			meta: { ...example.meta, slug: undefined, name: "Solo Three" },
		});
		assert.ok(a.dir.includes(path.join("_drafts", "alpha-one")), a.dir);
		assert.ok(!solo.dir.includes("_drafts"), solo.dir);
		await saveCard(
			{
				...variant("Alpha One", "A"),
				meta: { ...variant("Alpha One", "A").meta, slug: "alpha-one" },
			},
			{ overwrite: true },
		);
		assert.ok(
			existsSync(path.join(dir, "_drafts", "alpha-one", "card.json")),
			"overwrite keeps the draft in place",
		);
		const r = await pickWinner("alpha-one");
		assert.deepEqual(r.deleted, ["beta-two"]);
		assert.ok(existsSync(path.join(dir, "alpha-one", "card.json")));
		assert.ok(!existsSync(b.dir));
	});
});

test("a translation keeps the original's structure and fixed values", async () => {
	await withLibrary(async (dir) => {
		const { saveCard, saveTranslation } = await import(
			path.join(root, "dist/store.js")
		);
		const { slug } = await saveCard(example);
		const ru = structuredClone(example);
		ru.meta.tagline = "Она слышала. Она молчала.";
		ru.description.gender = "Женщина";
		const file = await saveTranslation(slug, "ru", ru);
		assert.ok(file.endsWith("card.ru.json"));
		const broken = structuredClone(ru);
		broken.look.palette[0].hex = "#000000";
		await assert.rejects(
			() => saveTranslation(slug, "ru", broken),
			/must stay/,
		);
		const shorter = structuredClone(ru);
		shorter.uniqueness.quirks.push("Лишняя причуда.");
		await assert.rejects(() => saveTranslation(slug, "ru", shorter), /length/);
	});
});

test("models.json is read on every call and missing keys fall back to defaults", async () => {
	const { config } = await import(path.join(root, "dist/config.js"));
	assert.equal(config().provider, "fal");
	assert.ok(config().models.video.kling.includes("kling"));
	const dir = mkdtempSync(path.join(os.tmpdir(), "cf-models-"));
	const file = path.join(dir, "models.json");
	const prev = process.env.CHARACTER_FORGE_MODELS;
	process.env.CHARACTER_FORGE_MODELS = file;
	try {
		writeFileSync(
			file,
			JSON.stringify({ models: { video: { default: "veo" } } }),
		);
		assert.equal(config().models.video.default, "veo");
		assert.ok(
			config().models.video.veo.includes("veo"),
			"other keys keep their defaults",
		);
		writeFileSync(
			file,
			JSON.stringify({ models: { music: { model: "x/other-music" } } }),
		);
		assert.equal(
			config().models.music.model,
			"x/other-music",
			"re-read without a restart",
		);
	} finally {
		if (prev === undefined) delete process.env.CHARACTER_FORGE_MODELS;
		else process.env.CHARACTER_FORGE_MODELS = prev;
		rmSync(dir, { recursive: true, force: true });
	}
});

test("the cost ledger adds up per character and only counts successful calls", async () => {
	await withLibrary(async () => {
		const { saveCard } = await import(path.join(root, "dist/store.js"));
		const { recordCost, readCosts } = await import(
			path.join(root, "dist/costs.js")
		);
		const { slug } = await saveCard(example);
		await recordCost(slug, {
			kind: "video",
			model: "m",
			detail: "8 s",
			usd: 0.672,
		});
		await recordCost(slug, {
			kind: "music",
			model: "m",
			detail: "30 s",
			usd: 0.6,
		});
		const l = await readCosts(slug);
		assert.equal(l.entries.length, 2);
		assert.equal(l.totalUsd, 1.272);
		assert.equal(l.byKind.video, 0.672);
	});
});

test("a character started from the user's picture gets it as the winner's concept", async () => {
	await withLibrary(async (dir) => {
		const { saveCard } = await import(path.join(root, "dist/store.js"));
		const { keepWinner } = await import(path.join(root, "dist/concept.js"));
		const img = path.join(dir, "mine.png");
		writeFileSync(img, mannequinPng("front", AVERAGE_BODY, "flat").png);
		const variant = (v) => ({
			...example,
			meta: {
				...example.meta,
				name: `${example.meta.name} ${v}`,
				slug: undefined,
				group: "g1",
				variant: v,
				concept_image: img,
			},
		});
		const { slug } = await saveCard(variant("A"));
		await saveCard(variant("B"));
		const r = await keepWinner(slug);
		assert.equal(r.deleted.length, 1);
		assert.ok(
			existsSync(r.concept) &&
				r.concept.endsWith(path.join("assets", "concept.png")),
		);
		assert.ok(
			readFileSync(path.join(dir, slug, "card.md"), "utf8").includes(
				"concept.png",
			),
		);
	});
});

test("next steps follow the pipeline: concept, then location, then video and music, then voice", async () => {
	await withLibrary(async (dir) => {
		const { saveCard, saveAsset } = await import(
			path.join(root, "dist/store.js")
		);
		const { nextSteps } = await import(path.join(root, "dist/next.js"));
		const { slug } = await saveCard(example);
		const steps = () => nextSteps(slug).next.map((n) => n.tool.split(" ")[0]);
		assert.ok(steps().includes("character_concept"));
		await saveAsset(slug, "concept.png", Buffer.from("x"));
		assert.deepEqual(
			steps().filter((t) => t !== "translate-character"),
			["character_scene"],
		);
		await saveAsset(slug, "scene.png", Buffer.from("x"));
		assert.ok(
			steps().includes("character_video") &&
				steps().includes("character_prompt") &&
				!steps().includes("character_voice_translation"),
		);
		await saveAsset(slug, "idle.mp4", Buffer.from("x"));
		assert.ok(nextSteps(slug).next.some((n) => n.step.startsWith("Voice")));
	});
});
