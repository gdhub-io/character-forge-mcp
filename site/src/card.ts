// The subset of a character-forge card.json the site shows, and its split into drawer sections.

type Pair = { label: string; text: string };

export interface Card {
	meta: {
		name: string;
		slug?: string;
		medium: string;
		genre: string;
		logline: string;
		tagline: string;
	};
	core: {
		wound: string;
		lie: string;
		truth: string;
		central_paradox: string;
		dramatic_question: string;
		spark_links: string;
	};
	goals: {
		want: string;
		need: string;
		motivation: string;
		conflicting_goals: string;
	};
	identification: {
		methods: { method: string; how: string }[];
		flaws: { category: string; flaw: string; how_it_shows: string }[];
		superpower: string;
		vulnerability: string;
		sympathy_hook: string;
		first_appearance: string;
		jeopardy: string;
	};
	psychology: {
		emotional_baseline: string;
		inner_monologue: string[];
		insecurity: string;
		strongest_trigger: string;
	};
	description: {
		name_meaning: string;
		age: string;
		gender: string;
		species: string;
		cultural_background: string;
		physical: {
			height_build: string;
			face: string;
			hair: string;
			first_impression: string;
		};
		speech: { manner: string; pet_words: string[]; sample_lines: string[] };
		secret_dream: string;
		missing: string;
	};
	fears: {
		fears: { fear: string; root: string; conscious: boolean }[];
		mask: string;
		courage_source: string;
	};
	uniqueness: {
		archetype: string;
		twist: string;
		quirks: string[];
		stress_relief: string;
	};
	backstory: {
		biography: string;
		key_locations: string[];
		contradictions: { with_whom: string; behavior: string }[];
		world: {
			who_rules: string;
			boundaries: string;
			good_and_bad: string;
			worth_living_for: string;
		};
	};
	traits: {
		best_trait: string;
		worst_trait: string;
		other_traits: string[];
		energy: string;
		temperament: string;
		social: string;
		others_say: string[];
	};
	destiny: {
		ordinary_world: string;
		void: string;
		threshold: string;
		ordeal: string;
		transformation: string;
		ending: string;
	};
	look: {
		shape_language: string;
		silhouette: string;
		signature_item: { item: string; story: string; how_carried: string };
		marks: { mark: string; location: string; origin: string }[];
		movement: { gait: string; idle_pose: string };
		outfit: { piece: string; why: string }[];
		palette: { name: string; hex: string; meaning: string }[];
		story_reads: string[];
	};
}

export type Block =
	| { type: "chain"; steps: (Pair & { tone?: "end" })[] }
	| { type: "question"; label: string; text: string }
	| { type: "rows"; rows: [string, string][] }
	| { type: "list"; title?: string; items: { lead?: string; text: string }[] }
	| { type: "quotes"; title?: string; items: string[] }
	| { type: "prose"; title?: string; text: string }
	| {
			type: "timeline";
			title?: string;
			items: { lead: string; text: string }[];
	  }
	| { type: "cards"; items: (Pair & { tone?: "best" | "worst" })[] }
	| { type: "image"; src: string; alt: string; download?: string }
	| {
			type: "palette";
			items: { name: string; hex: string; meaning: string }[];
	  };

export interface Section {
	n: string;
	nav: string;
	kicker: string;
	/** Omitted when the first block speaks for itself (the concept on Look). */
	title?: string;
	blocks: Block[];
}

const q = (s: string) => `“${s.replace(/^["“]|["”]$/g, "")}”`;
/** "Self-destructive: she believes…" → "Self-destructive". */
const head = (s: string) => s.split(":")[0].trim();
const same = (a: string, b: string) =>
	head(a).toLowerCase() === head(b).toLowerCase();

// Each fact appears once. Core is the summary chain; the sections below hold the detail and skip what another section
// already says (the biography tells the formative events; quirks carry the gesture and stress habit; destiny carries the climax).
export function sections(c: Card, concept?: string): Section[] {
	const {
		core,
		goals: g,
		identification: id,
		psychology: p,
		description: d,
		fears: f,
		uniqueness: u,
		backstory: b,
		traits: t,
		destiny: ds,
		look: lk,
	} = c;
	const them = { her: "her", his: "him", their: "them" }[possessive(c)];
	const methods = id.methods.filter((m) => !/superpower/i.test(m.method));
	const flaws = id.flaws.filter((x) => !same(x.flaw, t.worst_trait));
	return [
		{
			n: "00",
			nav: "Core",
			kicker: "One causal chain",
			title: "Everything grows from one wound",
			blocks: [
				{
					type: "chain",
					steps: [
						{ label: "Wound", text: core.wound },
						{ label: "Lie", text: q(core.lie) },
						{ label: "Fear", text: f.fears[0]?.fear ?? "" },
						{
							label: "Defense / Gift",
							text: `${head(t.worst_trait)} / ${head(t.best_trait)}`,
						},
						{ label: "Truth", text: q(core.truth), tone: "end" },
					],
				},
				{
					type: "question",
					label: "The question the story answers",
					text: core.dramatic_question,
				},
			],
		},
		{
			n: "01",
			nav: "Goals",
			kicker: "Want vs need",
			title: "Want and need",
			blocks: [
				{
					type: "cards",
					items: [
						{ label: "Want", text: g.want },
						{ label: "Need", text: g.need, tone: "best" },
					],
				},
				{
					type: "rows",
					rows: [
						["Motivation", g.motivation],
						["Conflict", g.conflicting_goals],
					],
				},
			],
		},
		{
			n: "02",
			nav: "Identification",
			kicker: "Why we care",
			title: "How the audience bonds",
			blocks: [
				{
					type: "rows",
					rows: [
						["Superpower", id.superpower],
						["Vulnerability", id.vulnerability],
						["Sympathy hook", id.sympathy_hook],
						["First appearance", id.first_appearance],
						["Jeopardy", id.jeopardy],
					],
				},
				{
					type: "list",
					items: methods.map((m) => ({ lead: m.method, text: m.how })),
				},
				{
					type: "list",
					title: "Flaws",
					items: flaws.map((x) => ({
						lead: `${x.flaw} · ${x.category}`,
						text: x.how_it_shows,
					})),
				},
			],
		},
		{
			n: "03",
			nav: "Psychology",
			kicker: "Inside",
			title: "Inside the head",
			blocks: [
				{ type: "quotes", title: "Inner monologue", items: p.inner_monologue },
				{
					type: "rows",
					rows: [
						["Baseline", p.emotional_baseline],
						["Insecurity", p.insecurity],
						["Trigger", p.strongest_trigger],
					],
				},
			],
		},
		{
			n: "04",
			nav: "Description",
			kicker: "First impression",
			title: d.physical.first_impression,
			blocks: [
				{
					type: "rows",
					rows: [
						["Name", d.name_meaning],
						["Age", d.age],
						["Background", d.cultural_background],
						["Build", d.physical.height_build],
						["Face", d.physical.face],
						["Hair", d.physical.hair],
					],
				},
				{
					type: "rows",
					rows: [
						["Speech", d.speech.manner],
						["Pet words", d.speech.pet_words.map(q).join("  ")],
					],
				},
				{
					type: "quotes",
					title: "In their own words",
					items: d.speech.sample_lines,
				},
				{
					type: "rows",
					rows: [
						["Secret dream", d.secret_dream],
						["Missing", d.missing],
					],
				},
			],
		},
		{
			n: "05",
			nav: "Fears",
			kicker: "Fear & courage",
			title: `What holds ${them} back`,
			blocks: [
				{
					type: "list",
					items: f.fears.map((x) => ({
						lead: `${x.fear}${x.conscious ? "" : " · unconscious"}`,
						text: x.root,
					})),
				},
				{
					type: "rows",
					rows: [
						["Mask", f.mask],
						["Courage", f.courage_source],
					],
				},
			],
		},
		{
			n: "06",
			nav: "Uniqueness",
			kicker: u.archetype,
			title: u.twist,
			blocks: [
				{
					type: "list",
					title: "Quirks",
					items: u.quirks.map((text, i) => ({
						lead: String(i + 1).padStart(2, "0"),
						text,
					})),
				},
				{ type: "rows", rows: [["Stress relief", u.stress_relief]] },
			],
		},
		{
			n: "07",
			nav: "Story & world",
			kicker: "Backstory",
			title: "Where it all comes from",
			blocks: [
				{ type: "prose", text: b.biography },
				{
					type: "rows",
					rows: [
						["Who rules", b.world.who_rules],
						["Boundaries", b.world.boundaries],
						["Good & bad", b.world.good_and_bad],
						["Worth living for", b.world.worth_living_for],
					],
				},
				{
					type: "list",
					title: "Key locations",
					items: b.key_locations.map((text) => ({ text })),
				},
				{
					type: "list",
					title: "Contradictions",
					items: b.contradictions.map((x) => ({
						lead: x.with_whom,
						text: x.behavior,
					})),
				},
			],
		},
		{
			n: "08",
			nav: "Traits",
			kicker: "Best & worst",
			title: "One wound, two faces",
			blocks: [
				{
					type: "cards",
					items: [
						{ label: "Best trait", text: t.best_trait, tone: "best" },
						{ label: "Worst trait", text: t.worst_trait, tone: "worst" },
					],
				},
				{
					type: "rows",
					rows: [
						["Other traits", t.other_traits.join(" · ")],
						["Energy", t.energy],
						["Temperament", t.temperament],
						["Social", t.social],
					],
				},
				{ type: "quotes", title: "What others say", items: t.others_say },
			],
		},
		{
			n: "09",
			nav: "Destiny",
			kicker: "The arc",
			title: "Where the story leads",
			blocks: [
				{
					type: "timeline",
					items: [
						{ lead: "Ordinary world", text: ds.ordinary_world },
						{ lead: "The void", text: ds.void },
						{ lead: "Threshold", text: ds.threshold },
						{ lead: "Ordeal", text: ds.ordeal },
						{ lead: "Transformation", text: ds.transformation },
						{ lead: "Ending", text: ds.ending },
					],
				},
			],
		},
		{
			n: "◐",
			nav: "Look",
			kicker: "Look",
			blocks: [
				...(concept
					? [
							{
								type: "image" as const,
								src: concept,
								alt: `${c.meta.name}: front and back concept`,
								download: concept.split("?")[0].split("/").slice(-2).join("-"),
							},
						]
					: []),
				{ type: "palette", items: lk.palette },
				{
					type: "list",
					title: "Reads in 3 seconds",
					items: lk.story_reads.map((text, i) => ({
						lead: String(i + 1),
						text,
					})),
				},
				{
					type: "list",
					title: "Signature item",
					items: [
						{
							lead: lk.signature_item.item,
							text: `${lk.signature_item.story} ${lk.signature_item.how_carried}`,
						},
					],
				},
				{
					type: "rows",
					rows: [
						["Shape", lk.shape_language],
						["Silhouette", lk.silhouette],
					],
				},
				{
					type: "list",
					title: "Marks",
					items: lk.marks.map((m) => ({
						lead: `${m.mark} · ${m.location}`,
						text: m.origin,
					})),
				},
				{
					type: "rows",
					rows: [
						["Gait", lk.movement.gait],
						["Idle", lk.movement.idle_pose],
					],
				},
				{
					type: "list",
					title: "Outfit · inner → outer",
					items: lk.outfit.map((o) => ({ lead: o.piece, text: o.why })),
				},
			],
		},
	];
}

/** "his" / "her" / "their" from the card's gender, for button labels. */
export function possessive(c: Card): string {
	const g = c.description.gender;
	return /^(w|f|girl)/i.test(g) ? "her" : /^(m|boy)/i.test(g) ? "his" : "their";
}
