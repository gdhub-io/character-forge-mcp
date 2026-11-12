import { badChange, type CharacterCard, temperamentLine } from "./schema.js";

/** Words that usually mean the writer reached for a generic placeholder instead of a specific detail. */
const GENERIC = [
	"mysterious",
	"quirky",
	"interesting",
	"unique",
	"complex past",
	"troubled past",
	"dark past",
	"various",
	"some kind of",
	"something",
	"a lot of",
	"special",
	"normal",
	"typical",
	"kind-hearted",
	"has a heart of gold",
	"tough exterior",
	"strong-willed",
	"loves adventure",
	"independent woman",
	"lone wolf",
];
const GENERIC_RE = new RegExp(`\\b(${GENERIC.join("|")})\\b`);

export interface CheckResult {
	warnings: string[];
	questions: string[];
}

function strings(obj: unknown, path = ""): { path: string; value: string }[] {
	if (typeof obj === "string") return [{ path, value: obj }];
	if (Array.isArray(obj))
		return obj.flatMap((v, i) => strings(v, `${path}[${i}]`));
	if (obj && typeof obj === "object")
		return Object.entries(obj).flatMap(([k, v]) =>
			strings(v, path ? `${path}.${k}` : k),
		);
	return [];
}

const words = (s: string) =>
	new Set(s.toLowerCase().match(/[a-z']{4,}/g) ?? []);
function overlap(a: string, b: string): number {
	const A = words(a);
	const B = words(b);
	if (!A.size || !B.size) return 0;
	let n = 0;
	for (const w of A) if (B.has(w)) n++;
	return n / Math.min(A.size, B.size);
}

/**
 * Mechanical red flags + a coherence interview built from the card's own content.
 * Mechanical checks catch filler; the interview makes the model test every causal link.
 */
export function checkCard(c: CharacterCard): CheckResult {
	const warnings: string[] = [];
	const all = strings(c).filter(
		(s) => !s.path.startsWith("meta.brief") && !/\.hex$/.test(s.path),
	);

	for (const { path, value } of all) {
		const hit = GENERIC_RE.exec(value.toLowerCase())?.[1];
		if (hit)
			warnings.push(
				`${path}: generic phrase "${hit}" — replace with a concrete, filmable detail.`,
			);
	}

	const seen = new Map<string, string>();
	for (const { path, value } of all) {
		const key = value.toLowerCase().replace(/\W+/g, " ").trim();
		if (path.endsWith(".characteristic")) continue; // two events may change the same thing
		if (key.length > 12 && seen.has(key))
			warnings.push(`${path}: repeats ${seen.get(key)} word for word.`);
		else seen.set(key, path);
	}

	if (overlap(c.goals.want, c.goals.need) > 0.6)
		warnings.push(
			"goals.want and goals.need say almost the same thing — the want should be external and pull AGAINST the need.",
		);
	if (overlap(c.traits.best_trait, c.traits.worst_trait) > 0.6)
		warnings.push(
			"traits.best_trait and traits.worst_trait are near-identical — make them two different faces of the wound.",
		);

	const short = all.filter(
		(s) =>
			/^(core\.(wound|lie|truth|central_paradox|dramatic_question|spark_links)|goals\.|destiny\.)/.test(
				s.path,
			) && s.value.split(/\s+/).length < 5,
	);
	for (const s of short)
		warnings.push(
			`${s.path}: too thin ("${s.value}") — the core, goals and destiny need full sentences.`,
		);

	const dna = c.core.dna;
	if (!dna.temperament)
		warnings.push(
			"core.dna: no temperament — the card predates the DNA layer. Roll one (character_create) or write the six scales, then rewrite traits.personality and core.central_paradox on it.",
		);
	else if (
		!c.description.life_events.find((e) => e.weight === "wound")?.changes
			?.length
	)
		warnings.push(
			"description.life_events: the wound event doesn't record what it changed — list what it did to the temperament in its changes.",
		);
	if (dna.temperament && c.traits.personality.split(/\s+/).length < 40)
		warnings.push(
			"traits.personality: too thin — say who they are in life: mood, energy, alone or in company, leader or follower, rebel or conformist, social life, what they love.",
		);

	const arc = [c.goals.goal_climax, ...Object.values(c.destiny)]
		.join(" ")
		.toLowerCase();
	for (const x of c.backstory.contradictions) {
		const name = x.with_whom.split(/[,(—–]/)[0].trim();
		// Any proper word of the name will do: "Doran Hale" is "Hale" in the climax.
		// Names decline in some languages ("Хейл", "Хейла"), so a long one matches by its stem.
		const words = (name.match(/\p{Lu}[\p{L}'-]{2,}/gu) ?? [name])
			.filter((w) => !/^(The|His|Her|Their|Old|Young|Его|Её|Их)$/.test(w))
			.map((w) =>
				w.length > 4
					? new RegExp(`(?<!\\p{L})${w.toLowerCase().slice(0, -1)}`, "u")
					: new RegExp(`(?<!\\p{L})${w.toLowerCase()}(?!\\p{L})`, "u"),
			);
		if (!words.some((w) => w.test(arc)))
			warnings.push(
				`backstory.contradictions: ${name} never appears in the climax or destiny — a character who presses on the lie must be there when it breaks, or be cut.`,
			);
	}

	const unconscious = c.fears.fears.filter((f) => !f.conscious).length;
	if (unconscious === 0)
		warnings.push(
			"fears: no unconscious fear — strong characters are driven by at least one fear they don't admit.",
		);

	for (const e of c.description.life_events)
		for (const x of e.changes ?? []) {
			const bad = badChange(dna, x.characteristic, x.to);
			if (bad)
				warnings.push(
					`description.life_events (age ${e.age}): ${x.characteristic}: ${bad}.`,
				);
		}

	const temperament = temperamentLine(c);
	const q = [
		temperament
			? `DNA × WOUND: The wound "${c.core.wound}" lands on a born temperament of ${temperament}. Does the card show HOW it landed on THIS temperament (inward or outward, hard or soft) — in core.central_paradox, the life events and traits.personality?`
			: `DNA × WOUND: Which temperament did the wound "${c.core.wound}" land on? The card doesn't say yet.`,
		`PERSON: From traits.personality alone, can a stranger say whether they are withdrawn or outgoing, gloomy or cheerful, a rebel or a conformist, a leader or not, what their social life is like and what they love? "${c.traits.personality}"`,
		`BORN vs LIFE: Is everything they were born with in core.dna (species, sex, lineage, body plan, covering, natural colours, face, frame, born differences), and everything life did (scars, posture, weight, dye) in description.physical and look? Does every trait trace to the DNA, the wound, or both?`,
		`WOUND → LIE: Does "${c.core.lie}" follow inevitably from "${c.core.wound}"?`,
		`LIE → FEAR: Does the fear "${c.fears.fears[0].fear}" protect the lie, and does it grow from the biggest disappointment "${c.description.biggest_disappointment}"?`,
		`DEFENSE: Is the worst trait "${c.traits.worst_trait}" the way they defend the lie — and the thing that could destroy them in the climax?`,
		`GIFT: Is the best trait "${c.traits.best_trait}" forged by the same wound? Does core.central_paradox make that visible?`,
		`WANT vs NEED: Does the want "${c.goals.want}" feed the lie, while the need "${c.goals.need}" equals the truth "${c.core.truth}"? Does the climax "${c.goals.goal_climax}" force a choice between them?`,
		`FLAWS: Do the flaws (${c.identification.flaws.map((f) => f.flaw).join("; ")}) express the defense or the wound rather than being random decoration?`,
		`QUIRKS: For each quirk, is it a scar of the wound, a ritual protecting the lie, or pure texture? At least 3 of ${c.uniqueness.quirks.length} should connect to the core.`,
		`BACKSTORY: Does the biography dramatise the wound "${c.core.wound}" as lived, specific experience? Do the 3 formative events appear in it and escalate?`,
		`WORLD: Are the boundaries "${c.backstory.world.boundaries}" the ones the character must cross in the destiny's threshold? A boundary the story never approaches is a promise broken.`,
		`MOTIVES: Does every demand or threat in goals.goal_climax and destiny come with the other side's reason, stated in the card? "Because the plot needs it" is a hole.`,
		`SETUP → PAYOFF: Is every payoff in destiny set up earlier (no rescue from a fall that never happens), and is every loaded setup (a threat, a deadline, a departure, a boundary) paid off? List any dangling one.`,
		`SECRETS: If the story hangs on something hidden, could the people around them — and they themselves — really not know it, given their body, world and skills? If the evidence is in plain sight, the card must say why nobody reads it.`,
		`TIMELINE: Do ages, the order of events and the moment of each discovery agree across the biography, life events, threshold and climax?`,
		`FIRST APPEARANCE: Does "${c.identification.first_appearance}" show the core in one image or action?`,
		`CONTRADICTIONS: Does each secondary character (${c.backstory.contradictions.map((x) => x.with_whom).join("; ")}) pressure the lie from a different side?`,
		`ARC: Is "${c.destiny.transformation}" precisely the move from the lie to the truth — their own act, not something done to someone else? Compare the first appearance "${c.identification.first_appearance}" with the ending "${c.destiny.ending}": a stranger must see the change.`,
		`LOOK: Does every look element show a part of the story? Is the signature item "${c.look.signature_item.item}" rooted in the backstory? Does each mark (${c.look.marks.map((m) => m.mark).join("; ")}) come from a real event in the biography?`,
		`RESTRAINT: Is the look carried by 1-2 strong symbols, or is every detail an on-the-nose symbol? Count how often the main motif repeats across name, marks, props, locations and world — more than two or three is a gimmick. Leave at least one detail that invites a question instead of answering one.`,
		`SPARKS: Does "${c.core.spark_links}" make the job, world and archetype feel inevitable rather than pasted on?`,
		`STRENGTH: Could this character be swapped into another story without changes? If yes, they are not specific enough. Name one scene only THIS character could play.`,
		`VOICE: Could you tell who is speaking from the sample lines alone, with the name removed?`,
	];
	return { warnings, questions: q };
}

export function checkToText(r: CheckResult): string {
	return [
		r.warnings.length
			? `RED FLAGS (${r.warnings.length}):\n${r.warnings.map((w) => `- ${w}`).join("\n")}`
			: "RED FLAGS: none.",
		"",
		"COHERENCE INTERVIEW — answer each honestly to yourself. Any 'no' or 'weakly' means revise that part before saving:",
		r.questions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
	].join("\n");
}
