/**
 * Experimental: characters meet in one scene. The chat model plays every character (in Claude Code, one subagent per
 * character); this module keeps the record, decides who acts next and builds each character's packet, so a character
 * only ever sees its own thoughts and what the others said and did.
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { type CharacterCard, playerView, SlugSchema } from "./schema.js";
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
const STANCES: [number, string][] = [
	[-0.8, "ready to fight"],
	[-0.5, "hostile, quarrelling"],
	[-0.2, "wary"],
	[0.2, "neutral"],
	[0.5, "liking"],
	[0.8, "close, trusting"],
	[1, "in love, devoted"],
];
const stance = (v: number) =>
	(STANCES.find(([max]) => v <= max) ?? STANCES[STANCES.length - 1])[1];
const SCALE = `-1 … +1: ${STANCES.map(([max, label]) => `up to ${max} ${label}`).join("; ")}.`;
/** "ready to fight → … → in love, devoted": the scale in words, for the guide and the protocol. */
const SCALE_WORDS = STANCES.map(([, label]) => label).join(" → ");

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
type Turn = z.infer<typeof TurnSchema>;
type RecordedTurn = Turn & { speaker: string; round: number };

interface CastMember {
	id: string;
	/** A neutral stage id (person-a, person-b…): what the others call them until a name is said aloud. */
	stage?: string;
	name: string;
	/** What a stranger sees: the only thing the others know about them at first. */
	seen: string;
	/** Who they are, from their own card: always-in-mind first, then what they can recall. Never the author's fields. */
	self: string;
}

interface SceneEvent {
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

export const sceneDir = (id: string) => {
	if (!SlugSchema.safeParse(id).success)
		throw new Error(`Invalid scene id: ${id}`);
	return path.join(outputDir(), SCENES_DIR, id);
};

async function loadScene(id: string): Promise<Scene> {
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

/** What starts a scene: the character_meet input, defined once. */
export const SceneSetupSchema = z.object({
	characters: z
		.array(SlugSchema)
		.min(2)
		.max(5)
		.describe("Ids of saved characters, in the order they enter."),
	situation: text(
		"The user's situation, in English: a place, and any details they gave (time, roles, what is going on).",
	),
	max_rounds: z
		.number()
		.int()
		.min(1)
		.max(12)
		.default(DEFAULT_ROUNDS)
		.describe("When the scene stops at the latest."),
	tasks: z
		.array(
			z.object({
				character: SlugSchema,
				task: text(
					"Why they are here right now and what they need, in English. Only this character learns it.",
				),
			}),
		)
		.default([])
		.describe("One task per character (see the protocol)."),
	events: z
		.array(
			z.object({
				round: z.number().int().min(1),
				what: text("What suddenly happens, in English."),
			}),
		)
		.default([])
		.describe(
			"Planned sudden changes everyone perceives, each at the start of its round.",
		),
});

export async function startScene(
	setup: z.input<typeof SceneSetupSchema>,
	now = new Date(),
): Promise<{ scene: Scene; file: string }> {
	const {
		characters: ids,
		situation,
		max_rounds,
		tasks,
		events,
	} = SceneSetupSchema.parse(setup);
	if (new Set(ids).size !== ids.length)
		throw new Error("Each character can be in the scene only once.");
	const stray = tasks.map((t) => t.character).filter((c) => !ids.includes(c));
	if (stray.length)
		throw new Error(
			`Tasks for characters not in the scene: ${stray.join(", ")}.`,
		);
	const late = events.filter((e) => e.round > max_rounds);
	if (late.length)
		throw new Error(
			`Events after the last round (${max_rounds}) would never happen: rounds ${late.map((e) => e.round).join(", ")}.`,
		);
	const cards = await Promise.all(ids.map(loadCard));
	const stamp = now
		.toISOString()
		.slice(0, 19)
		.replace(/[-:]/g, "")
		.replace("T", "-");
	// Never overwrite an earlier scene: a second take in the same second gets -2, -3…
	const base = `${stamp}-${ids.map((i) => i.split("-")[0]).join("-")}`;
	let id = base;
	for (let n = 2; await exists(path.join(sceneDir(id), "scene.json")); n++)
		id = `${base}-${n}`;
	const scene: Scene = {
		id,
		situation,
		created: now.toISOString(),
		max_rounds,
		tasks: Object.fromEntries(tasks.map((t) => [t.character, t.task])),
		events: events.map((e) => ({ ...e })),
		cast: cards.map((c, i) => ({
			id: ids[i],
			stage: `person-${String.fromCharCode(97 + i)}`,
			name: c.meta.name,
			seen: strangerView(c),
			self: playerView(c),
		})),
		turns: [],
		round: 1,
	};
	stampEvents(scene);
	return { scene, file: await saveScene(scene) };
}

const exists = (file: string) =>
	access(file).then(
		() => true,
		() => false,
	);

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

const present = (s: Scene) =>
	s.cast
		.map((c) => c.id)
		.filter((id) => !s.turns.some((t) => t.speaker === id && t.leaves));

/**
 * Who acts next. Every present character gets one turn per round. First whoever was asked a question they haven't
 * had a turn to answer, then the most urgent (by their last turn; newcomers in cast order), ties in cast order.
 */
/** The questions put to this character since their last turn: they answer first. */
const pendingQuestions = (s: Scene, id: string) => {
	const last = lastIndex(s.turns, (t) => t.speaker === id);
	return s.turns.filter((t, i) => t.question_to === id && i > last);
};

/** What suddenly happened right before turn i (or now, for i = the number of turns). */
const eventsAt = (s: Scene, i: number) =>
	s.events.filter((e) => e.at === i).map((e) => e.what);

export function nextSpeaker(s: Scene): string | undefined {
	if (s.done) return undefined;
	const spoke = new Set(
		s.turns.filter((t) => t.round === s.round).map((t) => t.speaker),
	);
	const waiting = present(s).filter((id) => !spoke.has(id));
	const lastTurnOf = (id: string) =>
		lastIndex(s.turns, (t) => t.speaker === id);
	const asked = waiting.find((id) => pendingQuestions(s, id).length);
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
	// Players name each other by stage id; the record keeps the real ids.
	const real = (x: string) =>
		x === "all" ? x : (s.cast.find((c) => c.stage === x)?.id ?? x);
	for (const f of turn.feelings) f.toward = real(f.toward);
	turn.to = turn.to?.map(real);
	if (turn.question_to) turn.question_to = real(turn.question_to);
	for (const w of [...turn.wants_to_say, ...turn.wants_to_ask])
		w.to = w.to.map(real);
	for (const h of turn.hides) h.from = h.from.map(real);
	const others = present(s).filter((c) => c !== speaker);
	const elsewhere = turn.feelings
		.map((f) => f.toward)
		.filter((t) => !others.includes(t));
	if (elsewhere.length)
		throw new Error(
			`feelings are only for the other characters present; not for: ${[...new Set(elsewhere)].join(", ")}.`,
		);
	if (turn.question_to && !others.includes(turn.question_to))
		throw new Error(
			`question_to must be another character present, not ${turn.question_to}.`,
		);
	if (turn.question_to && !turn.says)
		throw new Error("A question needs a line: put it in says.");
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
	const unknown = [
		...(turn.to ?? []),
		...[...turn.wants_to_say, ...turn.wants_to_ask].flatMap((w) => w.to),
		...turn.hides.flatMap((h) => h.from),
	].filter((t) => t !== "all" && !others.includes(t));
	if (unknown.length)
		throw new Error(
			`Not here (gone, yourself, or never in this scene): ${[...new Set(unknown)].join(", ")}.`,
		);
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

const PLAYER_GUIDE = `
ROLE: YOU ARE THE CHARACTER. Not an actor, not a narrator: you live this moment from inside, with only what you know.

- WHO YOU ARE is your whole self. ALWAYS IN YOU drives every moment: your temperament, wound, lie, fears, mask, personality, worst and best trait. Let it decide, not politeness and not the plot.
- You are who you are at the start of your story, before anything has changed you. One night doesn't change a person: warmth has to be earned, can be lost, and you don't become wise or kind because a scene would be nicer. Your worst trait is as real as your best; under threat, above all when someone touches your wound, it wins. If your card says you are cruel, dangerous or cold, be it.
- The situation sets what your senses get: in the dark you see only what a light falls on, and you hear, smell or feel the rest; noise, distance, fog or a crowd cut it down the same way. Act on what you actually perceive, and let it change as the light or the distance changes.
- The others are strangers from other places, the way people from different countries or cultures are. You know only what you see and what was said aloud. Their stage ids are not names you know; use a name only once someone has said it. You may discover a link (neighbours, a shared person, a past) only through what is said.
- YOUR TASK is why you are here right now. Pursue it: it may need the others, or put you in their way. The others have reasons of their own that you don't know.
- Think first, then decide what to show. Say less than you think, hide what your fear tells you to hide, ask what you need to know. What you list in hides stays out of says and action. But hiding everything is its own lie: as trust or pressure grows, things come out. A secret can be told, a feeling confessed, a temper lost.
- Your feeling for each other character comes from where your card meets what they show and do, and it can go anywhere on one scale: ${SCALE_WORDS}. Threat (they touch your wound or fear, or block your task) pushes it down: you argue, block them, strike, or step away if you feel weaker. Recognition (your gift, empathy, attraction, a shared need) pushes it up: you help, open up, touch, confess. Nothing at stake: you ignore them. Let it move as far as the moment truly takes it, either way, and no further.
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
	const member = (id: string) => s.cast.find((c) => c.id === id);
	const seen = (id: string) => member(id)?.seen ?? "";
	// Others are known by stage ids, never by the names in their ids, until a name is said aloud.
	const stage = (id: string) => (id === "all" ? id : (member(id)?.stage ?? id));
	const events = (i: number) =>
		eventsAt(s, i).map((what) => `- SUDDENLY: ${what}`);
	const publicLog = s.turns.flatMap((t, i) => {
		const parts = [
			t.action && `(${t.action})`,
			t.says &&
				`says${t.to?.length ? ` to ${t.to.map(stage).join(", ")}` : ""}: "${t.says}"`,
			t.leaves && "(leaves)",
		].filter(Boolean);
		return [
			...events(i),
			`- ${t.speaker === speaker ? "YOU" : stage(t.speaker)} ${parts.length ? parts.join(" ") : "(silent)"}`,
		];
	});
	publicLog.push(...events(s.turns.length));
	const mine = s.turns
		.filter((t) => t.speaker === speaker)
		.map(
			(t) =>
				`- thought: ${t.thought} | felt: ${t.feelings.map((f) => `${stage(f.toward)} ${f.emotion} ${f.valence}`).join("; ")}${t.hides.length ? ` | hid: ${t.hides.map((h) => h.what).join("; ")}` : ""}`,
		);
	const pending = pendingQuestions(s, speaker);
	return [
		`You are ${me.name} (${stage(speaker)}).\n\nWHO YOU ARE (your own card, as you know yourself):\n${me.self}`,
		`SITUATION: ${s.situation}`,
		s.tasks[speaker] ? `YOUR TASK (only you know it): ${s.tasks[speaker]}` : "",
		`WHO ELSE IS HERE (how they look in full light, in the author's words. The situation decides how much of it you perceive now; you never know whose a thing is, who issued it or its history):\n${here.map((id) => `- ${stage(id)}: ${seen(id)}`).join("\n")}`,
		`WHAT HAS HAPPENED (public):\n${publicLog.length ? publicLog.join("\n") : "Nothing yet. This is the first moment."}`,
		mine.length
			? `YOUR EARLIER THOUGHTS (only you know):\n${mine.join("\n")}`
			: "",
		pending.length
			? `YOU WERE ASKED: ${pending.map((t) => `${stage(t.speaker)}: "${t.says ?? ""}"`).join(" ")}`
			: "",
		PLAYER_GUIDE,
	]
		.filter(Boolean)
		.join("\n\n");
}

/** Each character's attitude to each other, turn by turn (the scene's emotional curve), and where it ended. */
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
			.filter((p) => p.path.length)
			.map((p) => ({
				...p,
				ends: stance(p.path[p.path.length - 1].valence),
			})),
	);
}

const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);

function renderScene(s: Scene): string {
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
	const sudden = (i: number) =>
		eventsAt(s, i).map((what) => `> **Suddenly:** ${what}`);
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
	out.push(...sudden(s.turns.length));
	const paths = attitudePaths(s);
	if (paths.length)
		out.push(
			"## Attitudes",
			paths
				.map(
					(p) =>
						`- ${name(p.from)} → ${name(p.to)}: ${p.path.map((x) => `${signed(x.valence)} ${x.emotion}`).join(" → ")} — ends **${p.ends}**`,
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
5. Show the user scene.md. Then, in their language, retell it for a reader who knows neither card: first two or three plain sentences on who each character is and why they are here; then the scene simply, said, thought (one short line), did, with no long inner reasoning; then where each pair ended on the scale (${SCALE_WORDS}) and what moved it.
`.trim();
