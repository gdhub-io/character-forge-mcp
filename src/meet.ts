/**
 * Experimental: characters meet in one scene. The chat model plays every character (in Claude Code, one subagent per
 * character); this module keeps the record, decides who acts next and builds each character's packet, so a character
 * only ever sees its own thoughts and what the others said and did.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CARD_USE, type CharacterCard, SlugSchema } from "./schema.js";
import { loadCard, outputDir, writeJson } from "./store.js";

export const SCENES_DIR = "_scenes";
export const DEFAULT_ROUNDS = 6;

const text = (description: string) =>
	z.string().trim().min(1).describe(description);
const Target = z
	.union([SlugSchema, z.literal("all")])
	.describe("A character's id, or 'all'.");
/** Who something is for: one id, "all", or several; models write either, so both are accepted and kept as a list. */
const Targets = z.preprocess(
	(v) => (Array.isArray(v) ? v : [v]),
	z.array(Target).min(1),
);

/** Where a feeling sits between a fight and love. One scale for every scene, so outcomes compare. */
export const STANCES: [number, string][] = [
	[-0.8, "ready to fight"],
	[-0.5, "hostile, quarrelling"],
	[-0.2, "wary"],
	[0.2, "neutral"],
	[0.5, "liking"],
	[0.8, "close, trusting"],
	[1, "in love, devoted"],
];
export const stance = (v: number) =>
	(STANCES.find(([max]) => v <= max) ?? STANCES[STANCES.length - 1])[1];
const SCALE = `-1 … +1: ${STANCES.map(([max, label]) => `up to ${max} ${label}`).join("; ")}.`;

export const TurnSchema = z.object({
	thought: text(
		"Private. What goes through their head right now about the situation, in their own inner voice.",
	),
	feelings: z
		.array(
			z.object({
				toward: SlugSchema.describe("Id of another character present."),
				emotion: text(
					"One or two words, mixed if it is mixed: wary, curious, contempt, pity, warmth, shame, desire, rage…",
				),
				valence: z.number().min(-1).max(1).describe(SCALE),
				why: text(
					"What in them, or in what the other did, makes them feel this. Point at their own card.",
				),
			}),
		)
		.describe(
			"Private. Exactly one entry for every other character still present.",
		),
	wants_to_say: z
		.array(
			z.object({ to: Targets, what: text("What they would like to say.") }),
		)
		.default([])
		.describe("Private. What they want to say and to whom, said or not."),
	hides: z
		.array(
			z.object({
				from: Targets,
				what: text("What they keep back."),
				why: text("Why."),
			}),
		)
		.default([])
		.describe("Private. What they deliberately don't say."),
	wants_to_ask: z
		.array(z.object({ to: Targets, question: text("The question.") }))
		.default([])
		.describe("Private. Questions they would like to ask, asked or not."),
	urgency: z
		.number()
		.min(0)
		.max(1)
		.describe(
			"How much they want to act next round: 0 content to wait, 1 can't hold back.",
		),
	says: z
		.string()
		.trim()
		.optional()
		.describe("Public. Their line, in their voice. Omit to stay silent."),
	to: Targets.optional().describe("Public. Who the line is addressed to."),
	question_to: SlugSchema.optional().describe(
		"Public. If their line asks someone a question: that one character's id (an id, not the question). They answer first.",
	),
	action: z
		.string()
		.trim()
		.optional()
		.describe(
			"Public. What they visibly do: a gesture, a move, helping, blocking, stepping away, touching, striking.",
		),
	leaves: z
		.boolean()
		.optional()
		.describe("Public. True if they leave the scene for good."),
});
export type Turn = z.infer<typeof TurnSchema>;
type RecordedTurn = Turn & { speaker: string; round: number };

interface CastMember {
	id: string;
	name: string;
	/** What a stranger sees: the only thing the others know about them at first. */
	seen: string;
	/** Who they are, from their own card: always-in-mind first, then what they can recall. Never the author's fields. */
	self: string;
}

export interface SceneEvent {
	round: number;
	what: string;
	at?: number;
}

export interface Scene {
	id: string;
	situation: string;
	created: string;
	max_rounds: number;
	cast: CastMember[];
	/** Why each character is here now: known only to that character. */
	tasks: Record<string, string>;
	/** Sudden changes everyone perceives: planned for a round, or added live. `at` = how many turns came before. */
	events: SceneEvent[];
	turns: RecordedTurn[];
	round: number;
	done?: string;
}

function lastIndex<T>(xs: T[], pred: (x: T) => boolean): number {
	for (let i = xs.length - 1; i >= 0; i--) if (pred(xs[i])) return i;
	return -1;
}

const isSilent = (t: Turn) => !t.says && !t.action && !t.leaves;

/** What a stranger sees in the first seconds: body, face, clothes, how they hold themselves. Never the inner card. */
function strangerView(card: CharacterCard): string {
	if (card.look.stranger_view) return card.look.stranger_view;
	// Older cards: assembled from the author's fields, which may say more than eyes can see.
	const d = card.description;
	const l = card.look;
	return [
		`${d.gender}, looks ${d.age}.`,
		d.physical.height_build,
		d.physical.face,
		d.physical.hair,
		d.physical.first_impression,
		`Wearing: ${l.outfit.map((o) => o.piece).join("; ")}.`,
		`Carries: ${l.signature_item.item}.`,
	].join(" ");
}

const at = (o: unknown, p: string): unknown =>
	p
		.split(".")
		.reduce<unknown>(
			(v, k) =>
				v && typeof v === "object"
					? (v as Record<string, unknown>)[k]
					: undefined,
			o,
		);

/**
 * The character's view of themselves. ALWAYS fields lead (who they are in every moment); the rest of the card follows
 * as what they can recall, minus the author's fields (their truth, need and ending: knowing them would make them wise
 * too early) and the look (they don't see themselves from outside).
 */
/**
 * Beyond CARD_USE.author, these also tell a character its own future: the later stages of its story and the twist.
 * Someone living the moment can't know them.
 */
const FUTURE = [
	"psychology.states.reactive",
	"psychology.states.active",
	"uniqueness.twist",
];

/** Deletes the fields at these dotted paths from a card copy. */
function without(card: unknown, paths: readonly string[]) {
	const copy = structuredClone(card) as Record<string, unknown>;
	for (const p of paths) {
		const keys = p.split(".");
		const parent =
			keys.length > 1 ? at(copy, keys.slice(0, -1).join(".")) : copy;
		if (parent && typeof parent === "object")
			delete (parent as Record<string, unknown>)[keys[keys.length - 1]];
	}
	return copy;
}

export function selfSheet(card: CharacterCard): string {
	const sheet = without(card, FUTURE);
	const fears = at(sheet, "fears") as
		| { fears?: { conscious: boolean }[] }
		| undefined;
	// A fear they don't admit drives them, but they can't think it.
	if (fears?.fears) fears.fears = fears.fears.filter((f) => f.conscious);
	const always = CARD_USE.always
		.map((p) => [p, at(sheet, p)] as const)
		.filter(([, v]) => v !== undefined)
		.map(
			([p, v]) => `- ${p}: ${typeof v === "string" ? v : JSON.stringify(v)}`,
		);
	const rest = without(sheet, [
		...CARD_USE.always,
		...CARD_USE.author,
		...CARD_USE.visual,
	]);
	delete rest.meta;
	return `ALWAYS IN YOU:\n${always.join("\n")}\n\nWHAT YOU CAN RECALL WHEN THE MOMENT CALLS FOR IT:\n${JSON.stringify(rest)}`;
}

export const sceneDir = (id: string) => {
	if (!SlugSchema.safeParse(id).success)
		throw new Error(`Invalid scene id: ${id}`);
	return path.join(outputDir(), SCENES_DIR, id);
};

export async function loadScene(id: string): Promise<Scene> {
	return JSON.parse(
		await readFile(path.join(sceneDir(id), "scene.json"), "utf8"),
	);
}

async function saveScene(scene: Scene): Promise<string> {
	const dir = sceneDir(scene.id);
	await mkdir(dir, { recursive: true });
	const md = path.join(dir, "scene.md");
	await Promise.all([
		writeJson(path.join(dir, "scene.json"), scene),
		writeFile(md, renderScene(scene)),
	]);
	return md;
}

export interface SceneSetup {
	characters: string[];
	situation: string;
	max_rounds?: number;
	tasks?: { character: string; task: string }[];
	events?: { round: number; what: string }[];
}

export async function startScene(
	{
		characters: ids,
		situation,
		max_rounds = DEFAULT_ROUNDS,
		tasks = [],
		events = [],
	}: SceneSetup,
	now = new Date(),
): Promise<Scene> {
	if (new Set(ids).size !== ids.length)
		throw new Error("Each character can be in the scene only once.");
	const stray = tasks.map((t) => t.character).filter((c) => !ids.includes(c));
	if (stray.length)
		throw new Error(
			`Tasks for characters not in the scene: ${stray.join(", ")}.`,
		);
	const cards = await Promise.all(ids.map(loadCard));
	const stamp = now
		.toISOString()
		.slice(0, 16)
		.replace(/[-:]/g, "")
		.replace("T", "-");
	const scene: Scene = {
		id: `${stamp}-${ids.map((i) => i.split("-")[0]).join("-")}`,
		situation: situation.trim(),
		created: now.toISOString(),
		max_rounds,
		tasks: Object.fromEntries(tasks.map((t) => [t.character, t.task.trim()])),
		events: events.map((e) => ({ round: e.round, what: e.what.trim() })),
		cast: cards.map((c, i) => ({
			id: ids[i],
			name: c.meta.name,
			seen: strangerView(c),
			self: selfSheet(c),
		})),
		turns: [],
		round: 1,
	};
	stampEvents(scene);
	await saveScene(scene);
	return scene;
}

/** Planned events of the current round happen as it begins. */
function stampEvents(s: Scene) {
	for (const e of s.events)
		if (e.round === s.round && e.at === undefined) e.at = s.turns.length;
}

/** A sudden change, now: everyone perceives it before the next character acts. */
export async function addEvent(
	id: string,
	what: string,
): Promise<{ scene: Scene; file: string }> {
	const s = await loadScene(id);
	if (s.done) throw new Error(`The scene has ended (${s.done}).`);
	s.events.push({ round: s.round, what: what.trim(), at: s.turns.length });
	return { scene: s, file: await saveScene(s) };
}

export const present = (s: Scene) =>
	s.cast
		.map((c) => c.id)
		.filter((id) => !s.turns.some((t) => t.speaker === id && t.leaves));

/**
 * Who acts next. Every present character gets one turn per round. First whoever was asked a question they haven't
 * had a turn to answer, then the most urgent (by their last turn; newcomers in cast order), ties in cast order.
 */
export function nextSpeaker(s: Scene): string | undefined {
	if (s.done) return undefined;
	const spoke = new Set(
		s.turns.filter((t) => t.round === s.round).map((t) => t.speaker),
	);
	const waiting = present(s).filter((id) => !spoke.has(id));
	const lastTurnOf = (id: string) =>
		lastIndex(s.turns, (t) => t.speaker === id);
	const asked = waiting.find((id) =>
		s.turns.some((t, i) => t.question_to === id && i > lastTurnOf(id)),
	);
	if (asked) return asked;
	const urgency = (id: string) => s.turns[lastTurnOf(id)]?.urgency ?? 0.5;
	return waiting.reduce<string | undefined>(
		(best, id) =>
			best === undefined || urgency(id) > urgency(best) ? id : best,
		undefined,
	);
}

/** Records a turn, closes the round when everyone present has acted, and ends the scene when it should end. */
export async function addTurn(
	id: string,
	speaker: string,
	input: z.input<typeof TurnSchema>,
): Promise<{ scene: Scene; file: string }> {
	const turn = TurnSchema.parse(input);
	const s = await loadScene(id);
	if (s.done) throw new Error(`The scene has ended (${s.done}).`);
	const expected = nextSpeaker(s);
	if (speaker !== expected)
		throw new Error(`It is ${expected}'s turn, not ${speaker}'s.`);
	const others = present(s).filter((c) => c !== speaker);
	const missing = others.filter(
		(o) => !turn.feelings.some((f) => f.toward === o),
	);
	if (missing.length)
		throw new Error(
			`feelings must cover every other present character; missing: ${missing.join(", ")}.`,
		);
	const twice = others.filter(
		(o) => turn.feelings.filter((f) => f.toward === o).length > 1,
	);
	if (twice.length)
		throw new Error(
			`One feeling per character (name a mixed one, e.g. "stung but caring"); more than one for: ${twice.join(", ")}.`,
		);
	const cast = new Set(s.cast.map((c) => c.id));
	const unknown = [
		...turn.feelings.map((f) => f.toward),
		...(turn.to ?? []),
		...(turn.question_to ? [turn.question_to] : []),
		...[...turn.wants_to_say, ...turn.wants_to_ask].flatMap((w) => w.to),
		...turn.hides.flatMap((h) => h.from),
	].filter((t) => t !== "all" && !cast.has(t));
	if (unknown.length)
		throw new Error(`Not in this scene: ${[...new Set(unknown)].join(", ")}.`);
	s.turns.push({ ...turn, speaker, round: s.round });

	if (present(s).length < 2) s.done = "everyone else has left";
	else if (!nextSpeaker(s)) {
		const round = s.turns.filter((t) => t.round === s.round);
		if (round.every(isSilent)) s.done = "a full round of silence";
		else if (s.round >= s.max_rounds) s.done = "round limit";
		else {
			s.round++;
			stampEvents(s);
		}
	}
	return { scene: s, file: await saveScene(s) };
}

export const PLAYER_GUIDE = `
ROLE: YOU ARE THE CHARACTER. Not an actor, not a narrator: you live this moment from inside, with only what you know.

- WHO YOU ARE is your whole self. ALWAYS IN YOU drives every moment: your temperament, wound, lie, fears, mask, personality, worst and best trait. Let it decide, not politeness and not the plot.
- You are who you are at the start of your story, before anything has changed you. One night doesn't change a person: warmth has to be earned, can be lost, and you don't become wise or kind because a scene would be nicer. Your worst trait is as real as your best; under threat, above all when someone touches your wound, it wins. If your card says you are cruel, dangerous or cold, be it.
- The situation sets what your senses get: in the dark you see only what a light falls on, and you hear, smell or feel the rest; noise, distance, fog or a crowd cut it down the same way. Act on what you actually perceive, and let it change as the light or the distance changes.
- The others are strangers from other places, the way people from different countries or cultures are. You know only what you see and what was said aloud. Their stage ids are not names you know; use a name only once someone has said it. You may discover a link (neighbours, a shared person, a past) only through what is said.
- YOUR TASK is why you are here right now. Pursue it: it may need the others, or put you in their way. The others have reasons of their own that you don't know.
- Think first, then decide what to show. Say less than you think, hide what your fear tells you to hide, ask what you need to know. What you list in hides stays out of says and action. But hiding everything is its own lie: as trust or pressure grows, things come out. A secret can be told, a feeling confessed, a temper lost.
- Your feeling for each other character comes from where your card meets what they show and do, and it can go anywhere on one scale: from ready to fight, through quarrelling, wary, neutral and liking, to close and in love. Threat (they touch your wound or fear, or block your task) pushes it down: you argue, block them, strike, or step away if you feel weaker. Recognition (your gift, empathy, attraction, a shared need) pushes it up: you help, open up, touch, confess. Nothing at stake: you ignore them. Let it move as far as the moment truly takes it, either way, and no further.
- A line starting SUDDENLY is something that just happened; everyone present perceives it. React to it.
- You live a moment, not a game: there are no turns, rounds or scene for you. Never mention them, and never count or number your questions like moves.
- Silence is a valid answer. Leaving (leaves: true) is final.
- Speak in your card's voice: its rhythm, its pet words. Lines are short, the way people talk. English only.

Return ONLY the turn as JSON, no prose around it, in exactly this shape (lists hold one entry per feeling, thing hidden or question; ids are the stage ids; drop says/to/question_to/action/leaves when they don't apply):
{"thought": "…", "feelings": [{"toward": "<id>", "emotion": "wary", "valence": -0.3, "why": "…"}], "wants_to_say": [{"to": ["<id>"], "what": "…"}], "hides": [{"from": ["<id>"], "what": "…", "why": "…"}], "wants_to_ask": [{"to": ["<id>"], "question": "…"}], "urgency": 0.5, "says": "…", "to": ["<id>"], "question_to": "<id>", "action": "…", "leaves": false}
feelings needs one entry for every other character present. question_to is the id of the one you question aloud, not the question.
`.trim();

/** Everything one character may know before its turn: never another character's private fields. */
export function packetFor(s: Scene, speaker: string): string {
	const me = s.cast.find((c) => c.id === speaker);
	if (!me) throw new Error(`${speaker} is not in this scene.`);
	const here = present(s).filter((id) => id !== speaker);
	const seen = (id: string) => s.cast.find((c) => c.id === id)?.seen ?? "";
	const events = (at: number) =>
		s.events.filter((e) => e.at === at).map((e) => `- SUDDENLY: ${e.what}`);
	const publicLog = s.turns.flatMap((t, i) => {
		const parts = [
			t.action && `(${t.action})`,
			t.says &&
				`says${t.to?.length ? ` to ${t.to.join(", ")}` : ""}: "${t.says}"`,
			t.leaves && "(leaves)",
		].filter(Boolean);
		return [
			...events(i),
			`- ${t.speaker === speaker ? "YOU" : t.speaker} ${parts.length ? parts.join(" ") : "(silent)"}`,
		];
	});
	publicLog.push(...events(s.turns.length));
	const mine = s.turns
		.filter((t) => t.speaker === speaker)
		.map(
			(t) =>
				`- thought: ${t.thought} | felt: ${t.feelings.map((f) => `${f.toward} ${f.emotion} ${f.valence}`).join("; ")}${t.hides.length ? ` | hid: ${t.hides.map((h) => h.what).join("; ")}` : ""}`,
		);
	const pending = s.turns.filter(
		(t, i) =>
			t.question_to === speaker &&
			i > lastIndex(s.turns, (x) => x.speaker === speaker),
	);
	return [
		`You are ${me.name} (${speaker}).\n\nWHO YOU ARE (your own card, as you know yourself):\n${me.self}`,
		`SITUATION: ${s.situation}`,
		s.tasks[speaker] ? `YOUR TASK (only you know it): ${s.tasks[speaker]}` : "",
		`WHO ELSE IS HERE (how they look in full light, in the author's words. The situation decides how much of it you perceive now; you never know whose a thing is, who issued it or its history):\n${here.map((id) => `- ${id}: ${seen(id)}`).join("\n")}`,
		`WHAT HAS HAPPENED (public):\n${publicLog.length ? publicLog.join("\n") : "Nothing yet. This is the first moment."}`,
		mine.length
			? `YOUR EARLIER THOUGHTS (only you know):\n${mine.join("\n")}`
			: "",
		pending.length
			? `YOU WERE ASKED: ${pending.map((t) => `${t.speaker}: "${t.says ?? ""}"`).join(" ")}`
			: "",
		PLAYER_GUIDE,
	]
		.filter(Boolean)
		.join("\n\n");
}

/** Each character's attitude to each other, turn by turn: the scene's emotional curve. */
export function attitudePaths(s: Scene) {
	return s.cast.flatMap((a) =>
		s.cast
			.filter((b) => b.id !== a.id)
			.map((b) => ({
				from: a.id,
				to: b.id,
				path: s.turns
					.filter((t) => t.speaker === a.id)
					.flatMap((t) =>
						t.feelings
							.filter((f) => f.toward === b.id)
							.map((f) => ({
								round: t.round,
								valence: f.valence,
								emotion: f.emotion,
							})),
					),
			}))
			.filter((p) => p.path.length),
	);
}

const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);

export function renderScene(s: Scene): string {
	const name = (id: string) =>
		id === "all" ? "everyone" : (s.cast.find((c) => c.id === id)?.name ?? id);
	const out = [
		"# Scene",
		`> ${s.situation}`,
		`**Cast:** ${s.cast.map((c) => `${c.name} (\`${c.id}\`)`).join(", ")}`,
	];
	const tasks = s.cast.filter((c) => s.tasks[c.id]);
	if (tasks.length)
		out.push(
			`**Why they are here** (each knows only their own):\n${tasks.map((c) => `- ${c.name}: ${s.tasks[c.id]}`).join("\n")}`,
		);
	const sudden = (at: number) =>
		s.events.filter((e) => e.at === at).map((e) => `> **Suddenly:** ${e.what}`);
	let round = 0;
	for (const [i, t] of s.turns.entries()) {
		if (t.round !== round) {
			round = t.round;
			out.push(`## Round ${round}`);
		}
		out.push(...sudden(i));
		const head = [
			`**${name(t.speaker)}**${t.to?.length ? ` → ${t.to.map(name).join(", ")}` : ""}`,
			t.action && `*${t.action}*`,
			t.says && `“${t.says}”`,
			t.leaves && "*leaves.*",
			isSilent(t) && "*says nothing.*",
		].filter(Boolean);
		const inner = [
			`*Thinks:* ${t.thought}`,
			...t.feelings.map(
				(f) =>
					`- toward ${name(f.toward)}: **${f.emotion}** (${signed(f.valence)}) — ${f.why}`,
			),
			...t.wants_to_say.map(
				(w) => `- wants to tell ${w.to.map(name).join(", ")}: ${w.what}`,
			),
			...t.hides.map(
				(h) =>
					`- hides from ${h.from.map(name).join(", ")}: ${h.what} (${h.why})`,
			),
			...t.wants_to_ask.map(
				(q) => `- wants to ask ${q.to.map(name).join(", ")}: ${q.question}`,
			),
			`- urgency ${t.urgency}`,
		];
		out.push(
			`${head.join(" ")}\n\n<details><summary>inside</summary>\n\n${inner.join("\n")}\n\n</details>`,
		);
	}
	const paths = attitudePaths(s);
	if (paths.length)
		out.push(
			"## Attitudes",
			paths
				.map(
					(p) =>
						`- ${name(p.from)} → ${name(p.to)}: ${p.path.map((x) => `${signed(x.valence)} ${x.emotion}`).join(" → ")} — ends **${stance(p.path[p.path.length - 1].valence)}**`,
				)
				.join("\n"),
		);
	if (s.done) out.push(`*Scene ended: ${s.done}.*`);
	return `${out.join("\n\n")}\n`;
}

export const MEET_PROTOCOL = `
MEET PROTOCOL (experimental). You are the DIRECTOR: you run the scene and you never speak for a character yourself.

0. Before character_meet: every character needs a TASK, one line on why they are here right now and what they need. Use the user's; for anyone without one, write it from their card (their want) so it fits the situation. Tasks that touch each other (one needs what the other has, or is in the other's way) make scenes. Planned SUDDEN changes (the cable snaps, someone knocks) go in events with their round. When the user asks for one mid-scene, call character_meet_event.
1. character_meet returned the first speaker and their PACKET. A packet is everything that character may know: the situation, what the others look like, the public record, their own earlier thoughts. Never add anything else to it, above all not another character's thoughts or card.
2. Hand the packet to the speaker. In Claude Code: one character-player subagent per character, spawned on its first turn and continued (SendMessage) on later turns, so each keeps only its own mind; if it can't be continued, spawn a fresh one with the packet (it carries everything). In other clients, play the speaker yourself from the packet and their card only.
3. Pass the JSON it returns to character_meet_turn unchanged (scene id, speaker id, turn). If the tool rejects it, send the error back to the same character and ask for a corrected turn.
4. Repeat with the next speaker and packet the tool returns, until it says the scene has ended.
5. Show the user scene.md. Then, in their language, retell it for a reader who knows neither card: first two or three plain sentences on who each character is and why they are here; then the scene simply, said, thought (one short line), did, with no long inner reasoning; then where each pair ended on the scale (fight … neutral … love) and what moved it.
`.trim();
