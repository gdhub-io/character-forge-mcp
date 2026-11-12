import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
const { bodyOf } = await import(path.join(root, "dist/schema.js"));
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

test("the DNA is rolled last, so seeds from before it give the same character", () => {
	const r = roll({ seed: 42 });
	// Engine and sparks of seed 42 as rolled before the DNA layer existed.
	assert.equal(
		r.engine.wound,
		"Offered their whole heart and was rejected with contempt",
	);
	assert.equal(r.engine.arc_goal, "Find love");
	assert.equal(r.sparks.occupation, "insurance fraud investigator");
	assert.equal(r.sparks.visible_mark, "eyepatch");
	const scales = Object.values(r.dna);
	assert.equal(scales.length, 6);
	for (const { value, plasticity } of scales) {
		assert.ok(value >= 0 && value <= 100);
		assert.ok(plasticity >= 30 && plasticity <= 70);
	}
	const vs = rollVariants({ seed: 5 }, 3).variants;
	assert.equal(new Set(vs.map((v) => JSON.stringify(v.dna))).size, 3);
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

test("a card from before the DNA layer still loads, renders and asks for its temperament", () => {
	const old = structuredClone(example);
	const { dna } = old.core;
	delete old.core.dna;
	old.description.species = dna.species;
	old.look.body = { ...dna.frame, ...old.look.body };
	delete old.traits.personality;
	for (const e of old.description.life_events) delete e.weight;
	Object.assign(old.traits, {
		energy: "Low in calm weather",
		temperament: "Melancholic",
		social: "Strong introvert",
	});
	assert.equal(validateCard(old).ok, false, "new cards must have DNA");
	const r = validateCard(old, { stored: true });
	assert.equal(r.ok, true, r.issues);
	assert.equal(r.card.core.dna.species, "Human");
	assert.deepEqual(r.card.core.dna.frame, dna.frame);
	assert.match(r.card.traits.personality, /Social: Strong introvert\./);
	assert.match(buildTposePrompt(r.card), /8\.4 heads tall/);
	assert.match(
		checkCard(r.card).warnings.join("\n"),
		/core\.dna: no temperament/,
	);
});

test("check asks how the wound landed on the born temperament", () => {
	const card = validateCard(example).card;
	const q = checkCard(card).questions.join("\n");
	assert.match(
		q,
		/DNA × WOUND: .*extraversion 18 → 14 now, neuroticism 64 → 84 now/,
	);
	const thin = structuredClone(card);
	thin.traits.personality = "Quiet.";
	assert.match(
		checkCard(thin).warnings.join("\n"),
		/traits\.personality: too thin/,
	);
});

test("life events change what they became, never the DNA", async () => {
	const { temperamentLine } = await import(path.join(root, "dist/schema.js"));
	const card = structuredClone(validateCard(example).card);
	for (const e of card.description.life_events) delete e.changes;
	const [event] = card.description.life_events;
	event.changes = [
		{
			characteristic: "temperament.neuroticism",
			to: 80,
			how: "Blamed for the fleet.",
		},
		{ characteristic: "frame.legs", to: 1.15, how: "A growth trial." },
	];
	assert.match(temperamentLine(card), /neuroticism 64 → 80 now/);
	assert.equal(bodyOf(card).legs, 1.15);
	assert.equal(card.core.dna.frame.legs, 1.05, "the DNA keeps the born value");
	event.changes = [
		{ characteristic: "temperament.neuroticism", to: 95, how: "Too far." },
		{ characteristic: "colors.scales", to: "#000000", how: "None to change." },
	];
	const w = checkCard(card).warnings.join("\n");
	assert.match(w, /neuroticism: 95 is outside the born corridor 64 ± 25/);
	assert.match(w, /colors\.scales: no colour part "scales"/);
	// Exactly one event is the wound.
	const twoWounds = structuredClone(example);
	for (const e of twoWounds.description.life_events) e.weight = "wound";
	assert.match(
		validateCard(twoWounds).issues,
		/Exactly one life event is the wound/,
	);
	// Lineage, made-up characteristics and impossible values can't even be saved.
	for (const [characteristic, to] of [
		["ancestry", "Royal"],
		["frame.tail", 1],
		["frame.head_heights", 0],
		["temperament.openness", "high"],
	]) {
		const bad = structuredClone(example);
		bad.description.life_events[0].changes = [
			{ characteristic, to, how: "No." },
		];
		assert.equal(validateCard(bad).ok, false, characteristic);
	}
});

test("check flags a character who presses on the lie but is missing from the arc", () => {
	const card = structuredClone(validateCard(example).card);
	assert.doesNotMatch(checkCard(card).warnings.join("\n"), /never appears/);
	card.backstory.contradictions[1].with_whom = "Zed Morrow, a stranger";
	card.backstory.contradictions[2].with_whom = "Pip, a raft boy";
	const w = checkCard(card).warnings.join("\n");
	assert.match(w, /Zed Morrow never appears in the climax or destiny/);
	// A short name counts only as a whole word: "pipe" isn't Pip.
	card.destiny.ending += " A pipe bursts.";
	assert.match(checkCard(card).warnings.join("\n"), /Pip never appears/);
	const q = checkCard(card).questions.join("\n");
	assert.match(q, /MOTIVES:/);
	assert.match(q, /SETUP → PAYOFF:/);
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

test("the A-pose prompt carries the look, the body's own sides and the wear, cleanly", () => {
	const card = validateCard(example).card;
	const p = buildTposePrompt(card);
	for (const must of [
		/A-pose/,
		/front view/,
		/Drowned Slate/,
		/barometer/,
		/LEFT shoulder visibly lower/,
		/Wear and care: /,
		/Not idealized/,
	])
		assert.match(p, must);
	// The body's numbers become sides the model can't mix up.
	const tilted = structuredClone(card);
	tilted.look.body = {
		...tilted.look.body,
		shoulder_tilt: -0.5,
		head_tilt: 0.4,
	};
	assert.match(
		buildTposePrompt(tilted),
		/head canted toward the RIGHT shoulder/,
	);
	// No doubled punctuation from card text that already ends a sentence.
	const shouty = structuredClone(card);
	shouty.description.physical.face = "Scarred!";
	assert.doesNotMatch(buildTposePrompt(shouty), /\.\.|!\./);
	// A custom pose replaces the A-pose wording.
	assert.doesNotMatch(buildTposePrompt(card, { poseImage: "x.png" }), /A-pose/);
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
			"character_meet",
			"character_meet_event",
			"character_meet_turn",
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

		// The finished card reaches the chat as a document, and every saved card is an MCP resource.
		const uri = "character-forge://marta-vell/card.md";
		assert.ok(
			saved.content.some((c) => c.type === "resource_link" && c.uri === uri),
		);
		const shown = await client.callTool({
			name: "character_get",
			arguments: { id },
		});
		const doc = shown.content.find((c) => c.type === "resource").resource;
		assert.equal(doc.mimeType, "text/markdown");
		assert.match(doc.text, /^# Marta Vell/m);
		const { resources } = await client.listResources();
		assert.ok(resources.some((r) => r.uri === uri && r.name === "Marta Vell"));
		const read = await client.readResource({ uri });
		assert.match(read.contents[0].text, /^# Marta Vell/m);

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
		// Prompts come back as copyable code blocks in the message, one per section.
		assert.match(
			promptSaved.structuredContent.message,
			/\*\*Style\*\*\n```text\nsea shanty, folk\n```/,
		);
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
		!mannequinPng("front", bodyOf(card)).png.equals(mannequinPng("front").png),
		"images should differ",
	);
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
	const plain = mannequinPng("front", bodyOf(card), "shaded");
	const blocked = mannequinPng(
		"front",
		bodyOf(card),
		"blocking",
		card.look.blocking,
	);
	assert.ok(!plain.png.equals(blocked.png), "images should differ");
	// Without zone colours the blocking style falls back to the grey mannequin.
	assert.ok(
		mannequinPng("front", bodyOf(card), "blocking").png.equals(plain.png),
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
		// The key only ever goes to fal: a config naming another host or another secret is refused.
		writeFileSync(
			file,
			JSON.stringify({
				providers: { fal: { queueUrl: "https://evil.example" } },
			}),
		);
		assert.throws(() => config(), /fal\.ai https/);
		writeFileSync(
			file,
			JSON.stringify({ providers: { fal: { apiKeyEnv: "GITHUB_TOKEN" } } }),
		);
		assert.throws(() => config(), /fal key variable/);
	} finally {
		if (prev === undefined) delete process.env.CHARACTER_FORGE_MODELS;
		else process.env.CHARACTER_FORGE_MODELS = prev;
		rmSync(dir, { recursive: true, force: true });
	}
});

test("the cost ledger adds up per character, priced from models.json", async () => {
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
		const { videoUsd } = await import(path.join(root, "dist/costs.js"));
		assert.equal(Math.round(videoUsd("kling", 8) * 1000), 672);
		assert.ok(videoUsd("veo", 8, true) > videoUsd("veo", 8, false));
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

test("every saved artifact comes back into the chat, with an offer to fix or redo", async () => {
	const { fileContent, shown } = await import(
		path.join(root, "dist/tools/util.js")
	);
	const dir = mkdtempSync(path.join(os.tmpdir(), "cforge-files-"));
	const write = (name, data) => {
		const f = path.join(dir, name);
		writeFileSync(f, data);
		return f;
	};
	const png = write(
		"concept.png",
		mannequinPng("front", AVERAGE_BODY, "flat").png,
	);
	const mp3 = write("voice.mp3", Buffer.from("ID3 fake audio"));
	const mp4 = write("idle.mp4", Buffer.from("fake video"));
	const md = write("song.md", "# Song\n\nLyrics");

	const image = await fileContent(png);
	assert.equal(image.type, "image");
	assert.equal(image.mimeType, "image/png");
	assert.ok(image.data.length > 0);
	assert.equal((await fileContent(mp3)).type, "audio");
	const video = await fileContent(mp4);
	assert.equal(video.type, "resource_link");
	assert.equal(video.mimeType, "video/mp4");
	assert.ok(video.uri.startsWith("file://"));
	const doc = await fileContent(md);
	assert.equal(doc.type, "resource");
	assert.equal(doc.resource.text, "# Song\n\nLyrics");

	const r = await shown(
		"no-such-character",
		"Scene saved.",
		[png, mp4],
		"Call it again with notes.",
	);
	assert.match(r.content[0].text, /Show this to the user/);
	assert.match(r.content[0].text, /notes/);
	assert.match(r.content[0].text, /Next:/);
	// A big JSON (a translated card) goes as a link, not back into the context.
	const json = write(
		"card.ru.json",
		JSON.stringify({ text: "x".repeat(30_000) }),
	);
	assert.equal((await fileContent(json)).type, "resource_link");
	assert.deepEqual(
		r.content.slice(1).map((c) => c.type),
		["image", "resource_link"],
	);
	assert.deepEqual(r.structuredContent.files, [png, mp4]);
});

test("user pictures, ids and a stray .env can't reach outside what they're for", async () => {
	const { readUserImage, assertPublicUrl } = await import(
		path.join(root, "dist/userimage.js")
	);
	const { pickWinner } = await import(path.join(root, "dist/store.js"));
	const dir = mkdtempSync(path.join(os.tmpdir(), "cforge-sec-"));
	try {
		// Only real images: a secret renamed to .png, or any other file, is refused.
		const png = path.join(dir, "ok.png");
		writeFileSync(png, mannequinPng("front", AVERAGE_BODY, "flat").png);
		assert.equal((await readUserImage(png)).mimeType, "image/png");
		const fake = path.join(dir, "id_rsa.png");
		writeFileSync(fake, "-----BEGIN OPENSSH PRIVATE KEY-----");
		await assert.rejects(() => readUserImage(fake), /Not a PNG/);
		await assert.rejects(
			() => readUserImage(path.join(dir, ".env")),
			/Only \.png/,
		);
		// Links: https to public hosts only.
		await assert.rejects(
			() => assertPublicUrl("http://example.com/a.png"),
			/https/,
		);
		await assert.rejects(
			() => assertPublicUrl("https://127.0.0.1/a.png"),
			/private address/,
		);
		await assert.rejects(
			() => assertPublicUrl("https://169.254.169.254/latest"),
			/private address/,
		);
		// A winner id is a plain id, never a path.
		await assert.rejects(() => pickWinner("../outside"));
		// A .env in the folder the server starts in may set the fal key, nothing else.
		writeFileSync(
			path.join(dir, ".env"),
			"CHARACTER_FORGE_MODELS=./broken.json\n",
		);
		writeFileSync(path.join(dir, "broken.json"), "{ not json");
		const out = execFileSync(
			process.execPath,
			[path.join(root, "dist/index.js"), "--version"],
			{
				cwd: dir,
				env: { PATH: process.env.PATH ?? "" },
			},
		).toString();
		assert.match(out, /^\d+\.\d+\.\d+/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("a scene: everyone acts each round, a question jumps the queue, and no one sees another's thoughts", async () => {
	await withLibrary(async (dir) => {
		const { saveCard } = await import(path.join(root, "dist/store.js"));
		const {
			startScene,
			addTurn,
			addEvent,
			nextSpeaker,
			packetFor,
			attitudePaths,
		} = await import(path.join(root, "dist/meet.js"));
		const as = (name) => ({
			...example,
			meta: { ...example.meta, slug: undefined, name },
		});
		await saveCard(as("Ann Ash"));
		await saveCard(as("Bo Birch"));
		await saveCard(as("Cy Cole"));
		const s = await startScene({
			characters: ["ann-ash", "bo-birch", "cy-cole"],
			situation: "A lift at night; the light goes out.",
			max_rounds: 3,
			tasks: [
				{ character: "ann-ash", task: "ANN-TASK: deliver a letter upstairs" },
			],
			events: [
				{ round: 2, what: "The cable groans and the lift drops a metre." },
			],
		});
		const turn = (others, extra = {}) => ({
			thought: "SECRET-THOUGHT",
			feelings: others.map((o) => ({
				toward: o,
				emotion: "wary",
				valence: -0.2,
				why: "a stranger in the dark",
			})),
			wants_to_say: [],
			hides: [{ from: "all", what: "SECRET-HIDDEN", why: "fear" }],
			wants_to_ask: [],
			urgency: 0.5,
			...extra,
		});
		assert.equal(nextSpeaker(s), "ann-ash");
		await assert.rejects(
			addTurn(s.id, "bo-birch", turn(["ann-ash", "cy-cole"])),
			/ann-ash's turn/,
		);
		await assert.rejects(
			addTurn(s.id, "ann-ash", turn(["bo-birch"])),
			/missing: cy-cole/,
		);
		let r = await addTurn(
			s.id,
			"ann-ash",
			turn(["bo-birch", "cy-cole"], {
				says: "Who's there?",
				to: ["cy-cole"],
				question_to: "cy-cole",
			}),
		);
		assert.equal(
			nextSpeaker(r.scene),
			"cy-cole",
			"the one asked answers first",
		);
		const packet = packetFor(r.scene, "cy-cole");
		assert.match(packet, /Who's there\?/);
		assert.match(packet, /YOU WERE ASKED/);
		assert.doesNotMatch(
			packet,
			/ANN-TASK/,
			"a task is known only to its character",
		);
		assert.match(packetFor(r.scene, "ann-ash"), /YOUR TASK.*ANN-TASK/);
		assert.match(packet, /WHO YOU ARE/);
		assert.doesNotMatch(
			packet,
			new RegExp(
				example.core.truth.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
			),
			"a character never learns its own truth",
		);
		assert.doesNotMatch(
			packet,
			/\[round|round \d+ of/i,
			"no game mechanics in what the character reads",
		);
		assert.match(
			packet,
			/drifting past you toward the horizon/,
			"others are seen through stranger_view",
		);
		assert.doesNotMatch(
			packet.split("WHO ELSE IS HERE")[1].split("WHAT HAS HAPPENED")[0],
			/deaf/,
			"others are seen without the author's fields",
		);
		assert.doesNotMatch(
			packet,
			/SECRET|Ann Ash/,
			"no thoughts, no names not said aloud",
		);
		assert.match(
			packetFor(r.scene, "ann-ash"),
			/SECRET-THOUGHT/,
			"own thoughts carry over",
		);
		r = await addTurn(
			s.id,
			"cy-cole",
			turn(["ann-ash", "bo-birch"], { says: "Me.", urgency: 0.9 }),
		);
		r = await addTurn(
			s.id,
			"bo-birch",
			turn(["ann-ash", "cy-cole"], { action: "steps back" }),
		);
		assert.equal(r.scene.round, 2);
		assert.match(
			packetFor(r.scene, "cy-cole"),
			/SUDDENLY: The cable groans/,
			"a planned event happens as its round begins",
		);
		await assert.rejects(
			addTurn(s.id, "cy-cole", {
				...turn(["ann-ash", "bo-birch"]),
				feelings: [
					...turn(["ann-ash", "bo-birch"]).feelings,
					...turn(["ann-ash"]).feelings,
				],
			}),
			/One feeling per character/,
		);
		r = await addEvent(s.id, "The door opens a crack.");
		assert.match(
			packetFor(r.scene, "cy-cole"),
			/SUDDENLY: The door opens a crack/,
		);
		assert.equal(nextSpeaker(r.scene), "cy-cole", "the most urgent goes first");
		for (const id of ["cy-cole", "ann-ash", "bo-birch"])
			r = await addTurn(
				s.id,
				id,
				turn(["ann-ash", "bo-birch", "cy-cole"].filter((x) => x !== id)),
			);
		assert.equal(r.scene.done, "a full round of silence");
		assert.equal(nextSpeaker(r.scene), undefined);
		const ab = attitudePaths(r.scene).find(
			(p) => p.from === "ann-ash" && p.to === "bo-birch",
		);
		assert.equal(ab.path.length, 2);
		const md = readFileSync(
			path.join(dir, "_scenes", s.id, "scene.md"),
			"utf8",
		);
		assert.match(md, /## Attitudes/);
		assert.match(md, /Suddenly:\*\* The cable groans/);
		assert.match(md, /ends \*\*wary\*\*/);
		assert.match(md, /a full round of silence/);
	});
});
