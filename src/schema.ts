import { z } from "zod";
import { MEDIUMS } from "./methodology.js";
import type { BodyShape } from "./pose.js";

export const SlugSchema = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lowercase-latin-with-dashes");

const text = (description: string) =>
	z.string().trim().min(1).describe(description);
const list = (description: string, min = 1) =>
	z.array(z.string().trim().min(1)).min(min).describe(description);

const MetaSchema = z.object({
	name: text("Full name of the character."),
	slug: SlugSchema.optional().describe(
		"Optional URL-safe id (lowercase-latin-with-dashes). Derived from the name if omitted.",
	),
	medium: z.enum(MEDIUMS).describe("Where the character will live."),
	genre: text("Genre / tone."),
	mode: z
		.enum(["random", "brief"])
		.describe(
			"'random' if built from a rolled seed, 'brief' if from a user description.",
		),
	brief: z
		.string()
		.optional()
		.describe("The user's original brief, verbatim, when mode = 'brief'."),
	concept_image: z
		.string()
		.optional()
		.describe(
			"Path or URL of the user's own concept image, when they gave one (character_create returns it). character_pick imports it as the winner's concept.",
		),
	seed: z
		.number()
		.int()
		.optional()
		.describe("Seed returned by character_create, when one was used."),
	group: z
		.string()
		.optional()
		.describe("Variant-set id shared by competing variants of one concept."),
	variant: z
		.string()
		.optional()
		.describe("Variant letter within the group (A, B, C...)."),
	verdict: z
		.object({
			status: z.enum(["winner", "runner-up", "rejected"]),
			score: z.number().min(0).max(100).describe("Final judge score 0-100."),
			summary: text("One or two sentences: why it won or lost."),
		})
		.optional()
		.describe("Tournament result, filled after judging."),
	logline: text(
		"One sentence: who they are, what they want, what stands in the way.",
	),
	tagline: text("A short memorable hook, 3-8 words."),
});

const scale = (min: number, max: number, describe: string) =>
	z.number().min(min).max(max).describe(describe);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const percent = (describe: string) =>
	z.number().int().min(0).max(100).describe(describe);

/** One innate temperament scale: where they were born, how far life can move it, and how it shows. */
const trait = (low: string, high: string) =>
	z
		.object({
			value: percent(`Born value, 0 = ${low}, 100 = ${high}.`),
			plasticity: percent(
				"How far life can move it: the value stays within born ± plasticity/2.",
			),
			shows: text("One line: how this shows in this particular being."),
		})
		.describe(`${low} (0) → ${high} (100).`);

export const TEMPERAMENT_SCALES = {
	extraversion: trait(
		"withdrawn, seeks solitude, recharges alone",
		"outgoing, seeks company, draws energy from others",
	),
	neuroticism: trait(
		"calm, even, cheerful by default",
		"anxious, moody, gloomy by default",
	),
	agreeableness: trait(
		"rebel, contrarian, hard to sway",
		"soft, accommodating, goes along",
	),
	conscientiousness: trait(
		"chaotic, impulsive, lives by chance",
		"orderly, disciplined, lives by a plan",
	),
	openness: trait(
		"sticks to the familiar, practical",
		"curious, creative, drawn to art, music and the new",
	),
	sensitivity: trait(
		"dandelion: barely moved by good or bad surroundings",
		"orchid: shaped hard by both bad and good surroundings",
	),
} as const;
export type TemperamentScale = keyof typeof TEMPERAMENT_SCALES;
/** The scales in their fixed order: rolls draw them in it. */
export const TEMPERAMENT_KEYS = Object.keys(
	TEMPERAMENT_SCALES,
) as TemperamentScale[];
const FRAME_KEYS = [
	"head_heights",
	"shoulders",
	"hips",
	"legs",
	"arms",
] as const;
type FrameKey = (typeof FRAME_KEYS)[number];

const PART = /^[a-z][a-z_-]*$/;

/** What a life event can change in them: the DNA's characteristics, by name. Lineage is history: nothing changes it. */
const ChangeablePath = z.union([
	z.enum([
		...TEMPERAMENT_KEYS.map((k) => `temperament.${k}` as const),
		...FRAME_KEYS.map((k) => `frame.${k}` as const),
		"species",
		"sex",
		"body_plan",
		"covering",
		"face",
		"build_tendency",
	]),
	z.string().regex(new RegExp(`^colors\\.${PART.source.slice(1)}`)),
]);

/** Body proportions they were born with; they build the concept's pose figure (always a humanoid A-pose). */
const FrameSchema = z
	.object({
		head_heights: scale(
			3,
			10,
			"Standing height in head lengths, as drawn in the art style: ~4 small child, ~6 teen or stocky, 7-7.5 average adult, 8+ tall and elongated, 9.5-10 fashion-sketch extreme.",
		),
		shoulders: scale(
			0.6,
			1.6,
			"Shoulder width vs an average adult of their kind: 1 average, 0.8 narrow, 1.3 broad.",
		),
		hips: scale(
			0.6,
			1.6,
			"Hip width vs an average adult of their kind: 1 average, 0.8 narrow, 1.3 wide.",
		),
		legs: scale(
			0.8,
			1.2,
			"Leg length vs average: 0.9 short-legged, 1.1 long-legged.",
		),
		arms: scale(0.85, 1.15, "Arm length vs average: 0.9 short, 1.1 long."),
	})
	.describe(
		"Innate proportions. For a non-humanoid body, the closest humanoid reading (the concept sheet is a humanoid A-pose).",
	);

/** What they were born (or made) with. Never changed by life; everything acquired is layered on top. */
const DnaSchema = z
	.object({
		temperament: z
			.object(TEMPERAMENT_SCALES)
			.describe(
				"Innate temperament: six scales. Take the rolled numbers unless the brief fixes them; the wound lands on this temperament.",
			),
		species: text("Human or otherwise."),
		sex: text(
			"Sex they were born or made with, or 'none' (gender as presented lives in description).",
		),
		ancestry: text(
			"Lineage or origin they were born from; for made beings, who made them and from what.",
		),
		body_plan: text(
			"How the body is built: biped, quadruped, serpentine, winged, many-limbed, amorphous...",
		),
		covering: text(
			"What covers the body and its natural texture: skin, fur, scales, feathers, bark, plating; hair type if any.",
		),
		colors: z
			.array(
				z.object({
					part: z
						.string()
						.regex(PART)
						.describe(
							"Body part as one lowercase English word (skin, hair, eyes, scales, stag-hide...); it stays the same in translations, so life events can name it.",
						),
					hex: hex.describe("Natural colour, #RRGGBB."),
				}),
			)
			.min(1)
			.describe(
				"Natural colours of the body, before life changed them (dye, sun, scars).",
			),
		face: text("Face or head features they were born with, one line."),
		frame: FrameSchema,
		build_tendency: percent(
			"Innate build: 0 lean and wiry → 100 heavy and solid.",
		),
		born_differences: z
			.array(text("One innate body difference and how it shows."))
			.describe(
				"Body differences they were born or made with: a missing or extra limb, heterochromia, a birthmark... Rare: usually empty. Injuries and wear from life are marks in look, not here.",
			),
	})
	.describe(
		"DNA: what they were born or made with, the bottom layer of the core. Temperament + innate appearance.",
	);

const CoreSchema = z.object({
	dna: DnaSchema,
	wound: text(
		"The formative wound everything grows from, as the author knows it (the character may not).",
	),
	self_story: text(
		"The wound as they tell it to themselves: first person, in their voice, only what they know or believe. No hindsight, no future, nothing only the author knows (if they took a joke for an honour, it is an honour here). A playing character keeps this in mind instead of the wound.",
	),
	lie: text("The false belief the wound taught them, in their own words."),
	truth: text("The truth they must learn — the need, stated as a belief."),
	central_paradox: text(
		"The contradiction that makes them vivid: the wound landing on this temperament, so their best and worst traits are two faces of it.",
	),
	dramatic_question: text(
		"The yes/no question the story answers about them, e.g. 'Will she ring the bell for the man who drowned her town?'",
	),
	spark_links: text(
		"How the surprising elements (job, world, archetype, look) grew out of the wound and the DNA — the 'inevitable but unexpected' logic.",
	),
});

const GoalsSchema = z.object({
	want: text("Conscious external goal (can change during the story)."),
	need: text("Inner need that never changes; carries the theme."),
	motivation: text("Why they act on want/need."),
	arc_goal: text(
		"The inner arc, ideally phrased like one of the popular arc goals.",
	),
	goal_climax: text("How the goal peaks at the story climax."),
	conflicting_goals: text(
		"How want and need are (or become) mutually exclusive, forcing a choice.",
	),
	scene_goal_example: text("An example of a concrete goal in one scene."),
});

const IdentificationSchema = z.object({
	methods: z
		.array(
			z.object({
				method: text("Identification method, e.g. 'Underemployed'."),
				how: text("How exactly it shows."),
			}),
		)
		.min(3)
		.describe("At least 3 ways the audience bonds with the character."),
	flaws: z
		.array(
			z.object({
				category: z.enum([
					"physical",
					"emotional",
					"spiritual",
					"psychological",
					"personality",
				]),
				flaw: text("The flaw."),
				how_it_shows: text("How it shows on screen / page."),
			}),
		)
		.min(2)
		.describe("At least 2 flaws, ideally from different categories."),
	superpower: text(
		"What they can do that is amazing (can be mundane-but-exceptional).",
	),
	vulnerability: text("The kryptonite that balances the superpower."),
	sympathy_hook: text(
		"The moment/situation that makes us feel for them early on.",
	),
	first_appearance: text(
		"How we meet them — as early as possible, in a scene that shows who they are.",
	),
	jeopardy: text(
		"The danger (emotional, physical) that makes the audience worry for them.",
	),
});

const PsychologySchema = z.object({
	states: z.object({
		passive: text("What they are like with no goal."),
		reactive: text("What pushes them into motion."),
		active: text("What they are like fully committed."),
	}),
	emotional_baseline: text(
		"Overall emotional state: broken / fresh / cynical / positive...",
	),
	inner_monologue: z
		.array(z.string().trim().min(1))
		.length(3)
		.describe(
			"Exactly 3 lines of inner voice, first person, in quotes-free form.",
		),
	interprets_experience: text(
		"Do they blame themselves, or never take responsibility?",
	),
	psychological_issues: text(
		"Neuroses, obsessions, panic, anger, memory problems...",
	),
	insecurity: text("What they feel is wrong with them and hide."),
	strong_beliefs: text("Convictions / sense of mission."),
	strongest_trigger: text(
		"What provokes their strongest emotion (scar, shameful past...).",
	),
	childhood: text("Family climate in childhood and how it shapes them now."),
	visual_device: text(
		"How to SHOW their inner state on screen / in-game / on page.",
	),
});

/** The value a change sets must be one the characteristic can hold: a 0-100 scale, a proportion in range, a colour. */
const ChangeSchema = z
	.object({
		characteristic: ChangeablePath.describe(
			"Which characteristic it changed in them, by its name in core.dna: temperament.extraversion, frame.legs, colors.hair (a part named in colors), covering, face, build_tendency...",
		),
		to: z
			.union([z.number(), z.string().trim().min(1)])
			.describe(
				"What it became after the event: a number for a scale (0-100, within born ± plasticity/2), a proportion (in the frame's range) or the build; #RRGGBB for a colour; text otherwise.",
			),
		how: text("How and why the event changed it."),
	})
	.superRefine(({ characteristic, to }, ctx) => {
		const [head, key] = characteristic.split(".");
		const schema =
			head === "temperament" || head === "build_tendency"
				? percent("")
				: head === "frame"
					? (FrameSchema.shape[key as FrameKey] as z.ZodNumber | undefined)
					: head === "colors"
						? hex
						: z.string();
		// An unknown characteristic is already reported by ChangeablePath.
		if (schema && !schema.safeParse(to).success)
			ctx.addIssue({
				code: "custom",
				path: ["to"],
				message: `${characteristic} can't become ${JSON.stringify(to)}`,
			});
	});

const DescriptionSchema = z.object({
	name_meaning: text("Why this name: etymology, metaphor, sound."),
	age: text("Age or apparent age."),
	gender: text("Gender as they present it (sex at birth lives in core.dna)."),
	cultural_background: text(
		"The culture they grew up in and how it shows (their lineage lives in core.dna).",
	),
	physical: z
		.object({
			height_build: text("Height, weight, body type now."),
			face: text("Face, eyes, skin now."),
			hair: text("Hair (or crest, mane, none) now."),
			first_impression: text("Overall impression at first glance."),
		})
		.describe(
			"How the body looks NOW: the DNA plus what life did (weight, age, sun, dye). Marks, movement and clothing live in the look section.",
		),
	life_events: z
		.array(
			z.object({
				age: text("Age when it happened."),
				weight: z
					.enum(["wound", "major", "minor"])
					.describe(
						"How much it shaped them: 'wound' for the formative hurt (exactly one event), 'major' for a turning point, 'minor' for something small that still left a trace.",
					),
				event: text("What happened."),
				effect: text(
					"How it changed them, given the temperament it landed on.",
				),
				changes: z
					.array(ChangeSchema)
					.optional()
					.describe(
						"What this event made of them: which characteristics it changed, to what and how — a hard childhood made them more anxious, a fever turned their hair white, a growth trial stretched their legs. The DNA itself never changes (it keeps what they were born with); this records what life made of it. Leave out what it didn't touch.",
					),
			}),
		)
		.length(3)
		.refine(
			(events) => events.filter((e) => e.weight === "wound").length === 1,
			"Exactly one life event is the wound (weight 'wound').",
		)
		.describe(
			"Exactly 3 formative life events. One of them is the wound itself (weight 'wound'), with what it changed in them.",
		),
	hobbies: list(
		"Hobbies, skills, interests, collections, sports, music, weekends.",
		2,
	),
	speech: z.object({
		manner: text("How they talk: rhythm, register, accent, verbal habits."),
		pet_words: list("Favourite words or phrases.", 2),
		sample_lines: list("2-4 lines of dialogue in their voice.", 2),
	}),
	sociology: z.object({
		status: text("Social status."),
		education: text("Education."),
		money: text("Relationship with money."),
		friends_family: text("Friends, family, traditions."),
		place: text("District, city, surroundings."),
		world_events: text(
			"How events in the wider world affect them, inside and out.",
		),
	}),
	biggest_disappointment: text(
		"Biggest disappointment / heartache — fears grow from this.",
	),
	most_valued: text("What they value most in life."),
	secret_dream: text("Secret dream, and how they see their future."),
	missing: text("What is missing from their life; what would make it perfect."),
});

const FearsSchema = z.object({
	fears: z
		.array(
			z.object({
				fear: text("The fear."),
				root: text("Where it comes from."),
				conscious: z.boolean().describe("Do they know about it?"),
			}),
		)
		.min(2),
	mask: text("How they hide fear / the face they show the world."),
	courage_source: text("What motivates them to push through the fear."),
	overcoming: text(
		"How they overcome it (one of the classic patterns, made specific).",
	),
});

const UniquenessSchema = z.object({
	archetype: text("The universal archetype."),
	twist: text("What makes this archetype unique."),
	quirks: list(
		"At least 5 specific, filmable quirks that make this archetype unique.",
		5,
	),
	lifestyle: z
		.object({
			tastes: text("Strange taste in music, food, films, shows."),
			shopping: text(
				"Where and how they shop (thrift store, boutique, black market...).",
			),
			food: text("Food preferences or an unusual way of ordering."),
			vehicle: text("What they drive (or ride) and how."),
			love_style: text(
				"How they show love; romantic quirks; preferred relationships.",
			),
			sore_spot: text(
				"A strange small thing that upsets them or presses a sore spot.",
			),
			nonverbal_tics: text(
				"Non-verbal tics: gestures, blinking, teeth-grinding...",
			),
			talents: text("Unusual talents."),
			spirituality: text(
				"How they practice spirituality: rituals, meditation, faith, superstition.",
			),
		})
		.describe("Answers to the uniqueness questions."),
	stress_relief: text("How they relieve stress."),
	dream_vacation: text("Their dream vacation."),
});

const BackstorySchema = z.object({
	world: z.object({
		who_rules: text(
			"Who rules this world and who makes the important decisions.",
		),
		boundaries: text(
			"The edges of their world: where it ends, what lies beyond, what is forbidden.",
		),
		hierarchy: text("Social hierarchy."),
		good_and_bad: text("What counts as good and bad here."),
		worth_dying_for: text("What is worth dying for."),
		worth_living_for: text("What is worth living for."),
		best_and_worst: text(
			"Best and worst things that can happen in this world.",
		),
		survival_vs_comfort: text(
			"Survival or manicured nails — what matters more here.",
		),
	}),
	biography: z
		.string()
		.trim()
		.min(300)
		.describe(
			"Short biography, 80-200 words: a chronological story from birth to the start of the story, grounded in real-feeling personal experience. It must dramatise the wound.",
		),
	connection_to_past: text(
		"How the character is tied to past events of this world.",
	),
	distance_from_peers: text(
		"How far they've gone compared to people from their hometown.",
	),
	daily_life: text("How they shop, eat, love, work, exercise, pray."),
	decision_style: text(
		"How their decision-making looks visually, and under pressure.",
	),
	key_locations: list(
		"Key places (home, street, workplace) with one telling detail each.",
		2,
	),
	contradictions: z
		.array(
			z.object({
				with_whom: text("Secondary character (name + role)."),
				behavior: text("Which side of the hero they reveal."),
			}),
		)
		.min(2)
		.describe("Secondary characters who reveal contradictory sides."),
});

const TraitsSchema = z.object({
	personality: text(
		"What they are like in life now, as a person: mood, energy, how they are with others (alone or in company, leader or follower, rebel or conformist), their social life and what they love. The DNA temperament after the wound and the life events; a stranger should know them from this paragraph.",
	),
	habits: list("Behavioral habits.", 2),
	best_trait: text("ONE thing they do better than anyone in the world."),
	worst_trait: text("ONE trait that could bring their downfall."),
	other_traits: z
		.array(z.string().trim().min(1))
		.length(3)
		.describe("Exactly 3 other traits."),
	reactions: z
		.array(
			z.object({
				situation: text("A situation."),
				reaction: text("Their characteristic reaction."),
			}),
		)
		.min(3)
		.describe("At least 3 characteristic reactions."),
	others_say: list("What other characters say about them (quotes).", 2),
});

const DestinySchema = z.object({
	ordinary_world: text("Their ordinary world."),
	void: text("The emptiness nothing in that world can fill."),
	threshold: text("What pushes them into the other world."),
	ordeal: text("The greatest obstacle."),
	transformation: text("How they change forever."),
	ending: text("Where they end up — master of two worlds (even if they die)."),
});

/** Posture and asymmetries on top of the innate frame (core.dna.frame): together they build the pose figure. */
const BodySchema = z
	.object({
		shoulder_tilt: scale(
			-1,
			1,
			"Which shoulder sits lower: -1 their LEFT much lower, 0 level, 1 their RIGHT much lower.",
		),
		head_tilt: scale(
			-1,
			1,
			"Habitual head cant: -1 strongly toward their LEFT shoulder, 0 straight, 1 toward their RIGHT.",
		),
		stoop: scale(
			0,
			1,
			"0 upright, 0.5 rounded back, 1 heavy stoop with the head sunk forward between the shoulders.",
		),
		knees: z
			.enum(["straight", "knock", "bow"])
			.describe(
				"Knees: straight, knock-kneed (inward) or bow-legged (outward).",
			),
		why: text(
			"Where this posture and these asymmetries come from (work, injury, age, habit; or built in, if so), each tied to the story.",
		),
	})
	.describe(
		"Posture and asymmetries on top of the frame (core.dna.frame, as life events changed it). Not idealized: symmetry is rare.",
	);

const LookSchema = z
	.object({
		shape_language: text(
			"Dominant shapes (round / square / triangle / mixed) and why they follow from the core.",
		),
		silhouette: text(
			"Silhouette hook recognisable in black fill — and which genre-stock look it deliberately avoids.",
		),
		perfection: text(
			"How polished vs. flawed they look, and why (neglect, pride, poverty, vanity, discipline...).",
		),
		body: BodySchema,
		blocking: z
			.object({
				hair: hex.describe(
					"Hair colour now: the natural one as age and life changed it (grey, dye, sun).",
				),
				skin: hex.describe(
					"Skin (or fur / scales) colour now: the natural one as age and life changed it.",
				),
				top: hex.describe("Main colour of the upper body and arms (sleeves)."),
				bottom: hex.describe("Main colour of the lower body and legs."),
				footwear_left: hex.describe("Footwear on the character's LEFT foot."),
				footwear_right: hex.describe("Footwear on the character's RIGHT foot."),
				accessories: z
					.array(
						z.object({
							where: z
								.enum([
									"left_shoulder",
									"right_shoulder",
									"chest",
									"waist",
									"left_hip",
									"right_hip",
									"back",
									"head",
								])
								.describe(
									"Where on the body (the character's own left/right).",
								),
							color: hex,
							size: z.enum(["small", "medium", "large"]).optional(),
							item: z
								.string()
								.optional()
								.describe(
									"What the blob is, e.g. 'coiled rope' — named in the prompt so it isn't drawn as armour.",
								),
						}),
					)
					.optional()
					.describe(
						"Worn items that must appear consistently in every view (a coil on one shoulder, a belt, a backpack).",
					),
			})
			.optional()
			.describe(
				"Zone colours for the concept block-in (#RRGGBB): they steer the concept image's colours. Strongly recommended.",
			),
		signature_item: z
			.object({
				item: text("The one object everyone associates with them."),
				story: text(
					"Where it comes from in their backstory and what it means to them.",
				),
				how_carried: text(
					"How they carry, wear or use it; how it changes over the arc.",
				),
			})
			.describe("The character's attribute."),
		marks: z
			.array(
				z.object({
					mark: text(
						"Scar, tattoo, prosthetic, wear... Acquired only: innate differences live in core.dna.",
					),
					location: text("Exactly where (left/right matters)."),
					origin: text("Which event in their life caused it."),
				}),
			)
			.min(1)
			.describe("Marks on the body, each with an origin in the biography."),
		movement: z.object({
			gait: text("How they walk."),
			idle_pose: text("How they stand or sit when nothing happens."),
			signature_gesture: text("A gesture only they make."),
			under_stress: text("How their body changes under pressure."),
		}),
		outfit: z
			.array(
				z.object({
					piece: text("Garment or accessory, with material."),
					why: text(
						"What it says about them: sociology, world, defense, history.",
					),
				}),
			)
			.min(2)
			.describe("Outfit pieces from inner to outer."),
		palette: z
			.array(
				z.object({
					name: text("Colour name."),
					hex: hex.describe("#RRGGBB"),
					meaning: text("What this colour carries in their story."),
				}),
			)
			.min(3)
			.max(6)
			.describe("3-6 key colours."),
		props: z
			.array(z.string().trim().min(1))
			.describe("Other props, besides the signature item (may be empty)."),
		story_reads: z
			.array(z.string().trim().min(1))
			.length(3)
			.describe(
				"Exactly 3 things a stranger understands about them in 3 seconds, without a word.",
			),
		stranger_view: z
			.string()
			.trim()
			.min(1)
			.optional()
			.describe(
				"What a stranger sees in the first seconds, as plain observation in 3-6 sentences: height and build, face, hair, clothes, what they carry, how they stand and move. Only what eyes can see in ordinary light: no names, owners, origins, histories, meanings or anything hidden (hair hanging over one ear is seen; that the ear is deaf is not). Characters who meet them know only this.",
			),
		art_style: text(
			"Art style for the concept, e.g. 'stylized 3D, painterly textures'.",
		),
		turnaround_notes: text(
			"What the concept artist must not miss (asymmetry, sides, scale).",
		),
	})
	.describe(
		"The look, derived from the story: every element must show a part of it.",
	);

export const CharacterCardSchema = z.object({
	meta: MetaSchema,
	core: CoreSchema,
	goals: GoalsSchema,
	identification: IdentificationSchema,
	psychology: PsychologySchema,
	description: DescriptionSchema,
	fears: FearsSchema,
	uniqueness: UniquenessSchema,
	backstory: BackstorySchema,
	traits: TraitsSchema,
	destiny: DestinySchema,
	look: LookSchema,
});

/**
 * A card read from disk. Cards saved before the DNA layer get their innate parts (species, proportions) moved into
 * core.dna and a personality made from the old energy/temperament/social lines; their temperament stays unknown
 * until the card is rewritten, and character_check asks for it.
 */
/** The shape of a card that may predate the DNA layer, for tools that accept one (a translation of an old card). */
export const LegacyCardSchema = CharacterCardSchema.extend({
	core: CoreSchema.extend({
		dna: DnaSchema.partial().required({
			species: true,
			frame: true,
			born_differences: true,
		}),
		self_story: CoreSchema.shape.self_story.optional(),
	}),
});
export const StoredCardSchema = z.preprocess(upgradeLegacy, LegacyCardSchema);

export type CharacterCard = z.infer<typeof StoredCardSchema>;

type Json = Record<string, unknown>;
const asObject = (v: unknown): Json | undefined =>
	v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : undefined;
export function upgradeLegacy(raw: unknown): unknown {
	const card = asObject(raw);
	const core = asObject(card?.core);
	const traits = asObject(card?.traits);
	const events = asObject(card?.description)?.life_events;
	const weighed =
		Array.isArray(events) && events.every((e) => asObject(e)?.weight);
	if (!card || !core || (core.dna && traits?.personality && weighed))
		return raw;
	const next: Json = structuredClone(card);
	const nextCore = next.core as Json;
	if (!nextCore.dna) {
		const body = asObject(asObject(next.look)?.body) ?? {};
		nextCore.dna = {
			species: asObject(next.description)?.species,
			born_differences: [],
			frame: Object.fromEntries(FRAME_KEYS.map((k) => [k, body[k]])),
		};
	}
	// Which old event was the wound is unknown: the first one stands for it until the card is rewritten.
	const nextEvents = asObject(next.description)?.life_events;
	if (Array.isArray(nextEvents))
		nextEvents.forEach((e, i) => {
			const ev = asObject(e);
			if (ev && !ev.weight) ev.weight = i === 0 ? "wound" : "major";
		});
	const t = asObject(next.traits);
	if (t && !t.personality)
		t.personality = [
			["Energy", t.energy],
			["Temperament", t.temperament],
			["Social", t.social],
		]
			.filter(([, v]) => typeof v === "string")
			.map(([k, v]) => `${k}: ${v}.`)
			.join(" ");
	// The moved fields go, so keeping unknown fields on a rewrite doesn't bring them back.
	if (t) for (const k of ["energy", "temperament", "social"]) delete t[k];
	const d = asObject(next.description);
	if (d && nextCore.dna) delete d.species;
	const b = asObject(asObject(next.look)?.body);
	if (b && nextCore.dna) for (const k of FRAME_KEYS) delete b[k];
	return next;
}

/**
 * Fields a stored card has that this version's schema doesn't know (a newer version, another branch) survive a
 * rewrite: zod strips them on parse, so they are copied back from the card as it was read.
 */
export function keepUnknown<T>(read: unknown, parsed: T): T {
	const a = asObject(read);
	const b = asObject(parsed);
	if (Array.isArray(read) && Array.isArray(parsed))
		return parsed.map((x, i) => keepUnknown(read[i], x)) as T;
	if (!a || !b) return parsed;
	const out: Json = { ...b };
	for (const [k, v] of Object.entries(a))
		out[k] = k in b ? keepUnknown(v, b[k]) : v;
	return out as T;
}

/** What life made of the DNA, event by event: characteristic → its value now (absent = as born). The DNA stays as born. */
export function changedBy(c: CharacterCard): Map<string, number | string> {
	const now = new Map<string, number | string>();
	for (const e of c.description.life_events)
		for (const ch of e.changes ?? []) now.set(ch.characteristic, ch.to);
	return now;
}

/** "extraversion 55 → 30 now, neuroticism 58, …" — the born temperament and what life events made of it. */
export function temperamentLine(c: CharacterCard): string {
	const t = c.core.dna.temperament;
	if (!t) return "";
	const now = changedBy(c);
	return TEMPERAMENT_KEYS.map((k) => {
		const v = now.get(`temperament.${k}`);
		return `${k} ${t[k].value}${v === undefined || v === t[k].value ? "" : ` → ${v} now`}`;
	}).join(", ");
}

/** The whole body for the pose figure: the innate frame, as life events changed it, plus the posture. */
export function bodyOf(
	c: CharacterCard,
): BodyShape & CharacterCard["look"]["body"] {
	const frame = { ...c.core.dna.frame };
	const now = changedBy(c);
	for (const k of FRAME_KEYS) {
		const v = now.get(`frame.${k}`);
		if (typeof v === "number") frame[k] = v;
	}
	return { ...frame, ...c.look.body };
}

/** Why this change can't happen to this DNA (a colour it doesn't have, a scale moved past its plasticity), if so. */
export function badChange(
	dna: CharacterCard["core"]["dna"],
	path: string,
	to: number | string,
): string | undefined {
	const [head, key] = path.split(".");
	if (head === "colors" && !dna.colors?.some((x) => x.part === key))
		return `no colour part "${key}"`;
	const scale =
		head === "temperament"
			? dna.temperament?.[key as TemperamentScale]
			: undefined;
	if (
		scale &&
		typeof to === "number" &&
		Math.abs(to - scale.value) > scale.plasticity / 2
	)
		return `${to} is outside the born corridor ${scale.value} ± ${scale.plasticity / 2}; life can't move it that far`;
	return undefined;
}

/**
 * What a playing character keeps in mind (a scene, a meeting, later life in time). ALWAYS: who they are, in every
 * prompt, so these fields are written from inside: nothing the character doesn't know (fears: the conscious ones).
 * AUTHOR: what they don't know — the truth, the future, how the story or the audience sees them; knowing it would
 * make them wise too early or play the ending. VISUAL: for images and video. Everything else is RECALLED when the
 * moment calls for it.
 */
export const CARD_USE = {
	always: [
		"meta.name",
		"description.age",
		"core.dna",
		"core.self_story",
		"core.lie",
		"goals.want",
		"traits.personality",
		"traits.best_trait",
		"traits.worst_trait",
		"fears.fears",
		"fears.mask",
		"psychology.strongest_trigger",
		"psychology.emotional_baseline",
		"description.speech.manner",
		"description.speech.pet_words",
		"look.signature_item.item",
	],
	author: [
		"meta.logline",
		"meta.tagline",
		"core.wound",
		"core.truth",
		"core.central_paradox",
		"core.dramatic_question",
		"core.spark_links",
		"goals.need",
		"goals.arc_goal",
		"goals.conflicting_goals",
		"goals.goal_climax",
		"identification",
		"psychology.visual_device",
		"fears.overcoming",
		"look.signature_item.how_carried",
		"destiny",
	],
	visual: ["look"],
} as const;

export function slugify(name: string): string {
	const slug = name
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "character";
}
