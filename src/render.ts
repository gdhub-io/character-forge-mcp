import type { CharacterCard } from "./schema.js";

/**
 * One description of the card's content (sections → blocks), rendered to Markdown.
 * Adding or moving a field happens once, in `sections()`.
 */

type Item = string | { lead: string; text: string };
type Block =
	| { rows: [string, string][] }
	| { list: Item[]; title?: string; timeline?: boolean }
	| { quotes: string[] }
	| {
			cards: { label: string; text: string; tone?: "best" | "worst" }[];
			kind: "chain" | "states" | "traits";
	  }
	| { prose: string; title?: string }
	| { note: string }
	| { palette: { name: string; hex: string; meaning: string }[] };
interface Section {
	n: string;
	title: string;
	blocks: Block[];
}

const q = (s: string) => `“${s}”`;

/** The body's proportions in words, then why: "7.8 heads, shoulders ×1.25, … — <why>". */
function bodyLine(b: CharacterCard["look"]["body"]): string {
	const side = (v: number, lower: string) =>
		v === 0 ? "" : `${v > 0 ? "right" : "left"} ${lower} ${Math.abs(v)}`;
	const parts = [
		`${b.head_heights} heads`,
		`shoulders ×${b.shoulders}`,
		`hips ×${b.hips}`,
		`legs ×${b.legs}`,
		`arms ×${b.arms}`,
		side(b.shoulder_tilt, "shoulder lower"),
		side(b.head_tilt, "head tilt"),
		b.stoop ? `stoop ${b.stoop}` : "",
		b.knees === "straight" ? "" : `${b.knees} knees`,
	].filter(Boolean);
	return `${parts.join(", ")} — ${b.why}`;
}

function sections(c: CharacterCard): { main: Section[]; visual: Section } {
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
	const life = u.lifestyle;
	const main: Section[] = [
		{
			n: "00",
			title: "Core",
			blocks: [
				{
					kind: "chain",
					cards: [
						{ label: "Wound", text: core.wound },
						{ label: "Lie", text: q(core.lie) },
						{ label: "Truth", text: q(core.truth) },
					],
				},
				{
					rows: [
						["Central paradox", core.central_paradox],
						["Dramatic question", core.dramatic_question],
						["Why these sparks", core.spark_links],
					],
				},
			],
		},
		{
			n: "01",
			title: "Goals",
			blocks: [
				{
					rows: [
						["Want", g.want],
						["Need", g.need],
						["Motivation", g.motivation],
						["Inner arc", g.arc_goal],
						["Conflicting goals", g.conflicting_goals],
						["Goal climax", g.goal_climax],
						["Scene goal example", g.scene_goal_example],
					],
				},
			],
		},
		{
			n: "02",
			title: "Audience identification",
			blocks: [
				{ list: id.methods.map((m) => ({ lead: m.method, text: m.how })) },
				{
					title: "Flaws",
					list: id.flaws.map((x) => ({
						lead: `${x.flaw} (${x.category})`,
						text: x.how_it_shows,
					})),
				},
				{
					rows: [
						["Superpower", id.superpower],
						["Vulnerability", id.vulnerability],
						["Sympathy hook", id.sympathy_hook],
						["First appearance", id.first_appearance],
						["Jeopardy", id.jeopardy],
					],
				},
			],
		},
		{
			n: "03",
			title: "Psychological profile",
			blocks: [
				{
					kind: "states",
					cards: [
						{ label: "Passive", text: p.states.passive },
						{ label: "Reactive", text: p.states.reactive },
						{ label: "Active", text: p.states.active },
					],
				},
				{ quotes: p.inner_monologue.map(q) },
				{
					rows: [
						["Emotional baseline", p.emotional_baseline],
						["Interprets experience", p.interprets_experience],
						["Psychological issues", p.psychological_issues],
						["Insecurity", p.insecurity],
						["Strong beliefs", p.strong_beliefs],
						["Strongest trigger", p.strongest_trigger],
						["Childhood", p.childhood],
						["Showing the inner state", p.visual_device],
					],
				},
			],
		},
		{
			n: "04",
			title: "Description",
			blocks: [
				{
					rows: [
						["Name", d.name_meaning],
						["Age", d.age],
						["Gender", d.gender],
						["Species", d.species],
						["Cultural background", d.cultural_background],
					],
				},
				{
					title: "Body",
					list: [d.physical.height_build, d.physical.face, d.physical.hair],
				},
				{ note: d.physical.first_impression },
				{
					title: "Formative events",
					timeline: true,
					list: d.life_events.map((e) => ({
						lead: e.age,
						text: `${e.event} → ${e.effect}`,
					})),
				},
				{
					rows: [
						["Speech", d.speech.manner],
						["Pet words", d.speech.pet_words.map(q).join(", ")],
					],
				},
				{ quotes: d.speech.sample_lines },
				{
					title: "Sociology",
					list: [
						{ lead: "Status", text: d.sociology.status },
						{ lead: "Education", text: d.sociology.education },
						{ lead: "Money", text: d.sociology.money },
						{ lead: "Friends & family", text: d.sociology.friends_family },
						{ lead: "Place", text: d.sociology.place },
						{ lead: "World events", text: d.sociology.world_events },
					],
				},
				{
					rows: [
						["Hobbies & interests", d.hobbies.join("; ")],
						["Biggest disappointment", d.biggest_disappointment],
						["Values most", d.most_valued],
						["Secret dream & future", d.secret_dream],
						["Missing from life", d.missing],
					],
				},
			],
		},
		{
			n: "05",
			title: "Fears",
			blocks: [
				{
					list: f.fears.map((x) => ({
						lead: x.conscious ? x.fear : `${x.fear} (unconscious)`,
						text: x.root,
					})),
				},
				{
					rows: [
						["Mask", f.mask],
						["Source of courage", f.courage_source],
						["Overcoming", f.overcoming],
					],
				},
			],
		},
		{
			n: "06",
			title: "Universal & unique",
			blocks: [
				{
					rows: [
						["Archetype", u.archetype],
						["Twist", u.twist],
					],
				},
				{ title: "Quirks", list: u.quirks },
				{
					title: "Lifestyle",
					list: [
						{ lead: "Tastes", text: life.tastes },
						{ lead: "Shopping", text: life.shopping },
						{ lead: "Food", text: life.food },
						{ lead: "Vehicle", text: life.vehicle },
						{ lead: "Love", text: life.love_style },
						{ lead: "Sore spot", text: life.sore_spot },
						{ lead: "Non-verbal tics", text: life.nonverbal_tics },
						{ lead: "Talents", text: life.talents },
						{ lead: "Spirituality", text: life.spirituality },
					],
				},
				{
					rows: [
						["Stress relief", u.stress_relief],
						["Dream vacation", u.dream_vacation],
					],
				},
			],
		},
		{
			n: "07",
			title: "Backstory & world",
			blocks: [
				{ title: "Biography", prose: b.biography },
				{
					title: "World",
					list: [
						{ lead: "Who rules", text: b.world.who_rules },
						{ lead: "Boundaries", text: b.world.boundaries },
						{ lead: "Hierarchy", text: b.world.hierarchy },
						{ lead: "Good and bad", text: b.world.good_and_bad },
						{ lead: "Worth dying for", text: b.world.worth_dying_for },
						{ lead: "Worth living for", text: b.world.worth_living_for },
						{ lead: "Best and worst", text: b.world.best_and_worst },
						{ lead: "Survival vs comfort", text: b.world.survival_vs_comfort },
					],
				},
				{
					rows: [
						["Tie to the past", b.connection_to_past],
						["Compared to peers", b.distance_from_peers],
						["Daily life", b.daily_life],
						["Decision-making", b.decision_style],
					],
				},
				{ title: "Key locations", list: b.key_locations },
				{
					title: "Contradictions",
					list: b.contradictions.map((x) => ({
						lead: x.with_whom,
						text: x.behavior,
					})),
				},
			],
		},
		{
			n: "08",
			title: "Character traits",
			blocks: [
				{
					kind: "traits",
					cards: [
						{ label: "Best trait", text: t.best_trait, tone: "best" },
						{ label: "Worst trait", text: t.worst_trait, tone: "worst" },
						...t.other_traits.map((x) => ({ label: "Other trait", text: x })),
					],
				},
				{
					rows: [
						["Energy", t.energy],
						["Temperament", t.temperament],
						["Social", t.social],
						["Habits", t.habits.join("; ")],
					],
				},
				{
					title: "Reactions",
					list: t.reactions.map((r) => ({
						lead: r.situation,
						text: r.reaction,
					})),
				},
				{ title: "What others say", list: t.others_say.map(q) },
			],
		},
		{
			n: "09",
			title: "Destiny",
			blocks: [
				{
					timeline: true,
					list: [
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
	];
	const visual: Section = {
		n: "",
		title: "Look",
		blocks: [
			{ palette: lk.palette },
			{ title: "Reads in 3 seconds", list: lk.story_reads },
			...(lk.stranger_view
				? [{ title: "Seen by a stranger", prose: lk.stranger_view } as Block]
				: []),
			{
				rows: [
					["Shape language", lk.shape_language],
					["Silhouette", lk.silhouette],
					["Perfection", lk.perfection],
					["Body", bodyLine(lk.body)],
				],
			},
			{
				title: "Signature item",
				list: [
					{
						lead: lk.signature_item.item,
						text: `${lk.signature_item.story} — ${lk.signature_item.how_carried}`,
					},
				],
			},
			{
				title: "Marks",
				list: lk.marks.map((m) => ({
					lead: `${m.mark} (${m.location})`,
					text: m.origin,
				})),
			},
			{
				title: "Movement",
				list: [
					{ lead: "Gait", text: lk.movement.gait },
					{ lead: "Idle", text: lk.movement.idle_pose },
					{ lead: "Gesture", text: lk.movement.signature_gesture },
					{ lead: "Under stress", text: lk.movement.under_stress },
				],
			},
			{
				title: "Outfit",
				list: lk.outfit.map((o) => ({ lead: o.piece, text: o.why })),
			},
			{
				rows: [
					["Props", lk.props.join("; ") || "—"],
					["Art style", lk.art_style],
					["Turnaround notes", lk.turnaround_notes],
				],
			},
		],
	};
	return { main, visual };
}

const tags = (c: CharacterCard) => [
	c.meta.medium,
	c.meta.genre,
	c.uniqueness.archetype,
	c.description.age,
	c.description.species,
];

// ---------- Markdown ----------

function mdBlock(b: Block): string {
	if ("rows" in b) return b.rows.map(([k, v]) => `**${k}:** ${v}`).join("\n\n");
	if ("list" in b) {
		const items = b.list
			.map(
				(i) => `- ${typeof i === "string" ? i : `**${i.lead}** — ${i.text}`}`,
			)
			.join("\n");
		return b.title ? `**${b.title}:**\n${items}` : items;
	}
	if ("quotes" in b) return b.quotes.map((x) => `> ${x}`).join("\n>\n");
	if ("cards" in b)
		return b.cards.map((x) => `- **${x.label}:** ${x.text}`).join("\n");
	if ("prose" in b) return b.title ? `**${b.title}:**\n\n${b.prose}` : b.prose;
	if ("note" in b) return `*${b.note}*`;
	return `**Palette:**\n${b.palette.map((x) => `- ${x.name} \`${x.hex}\` — ${x.meaning}`).join("\n")}`;
}

const mdSection = (s: Section) =>
	[
		`## ${s.n ? `${Number(s.n)}. ` : ""}${s.title}`,
		...s.blocks.map(mdBlock),
	].join("\n\n");

export function renderMarkdown(
	c: CharacterCard,
	opts: { conceptFile?: string } = {},
): string {
	const { main, visual } = sections(c);
	return `${[
		`# ${c.meta.name}`,
		`*${c.meta.tagline}*`,
		`> ${c.meta.logline}`,
		tags(c)
			.map((t) => `\`${t}\``)
			.join(" · "),
		opts.conceptFile ? `![A-pose concept](${opts.conceptFile})` : "",
		...main.map(mdSection),
		mdSection(visual),
	]
		.filter(Boolean)
		.join("\n\n")}\n`;
}
