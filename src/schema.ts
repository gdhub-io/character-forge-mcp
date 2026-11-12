import { z } from "zod";
import { MEDIUMS } from "./methodology.js";

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

const CoreSchema = z.object({
	wound: text("The formative wound everything grows from."),
	lie: text("The false belief the wound taught them, in their own words."),
	truth: text("The truth they must learn — the need, stated as a belief."),
	central_paradox: text(
		"The contradiction that makes them vivid: how their best and worst traits are two faces of the same wound.",
	),
	dramatic_question: text(
		"The yes/no question the story answers about them, e.g. 'Will she ring the bell for the man who drowned her town?'",
	),
	spark_links: text(
		"How the surprising elements (job, world, archetype, look) grew out of the wound — the 'inevitable but unexpected' logic.",
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

const DescriptionSchema = z.object({
	name_meaning: text("Why this name: etymology, metaphor, sound."),
	age: text("Age or apparent age."),
	gender: text("Gender / presentation."),
	species: text("Human or otherwise."),
	cultural_background: text(
		"Cultural / ethnic / regional background and how it shows.",
	),
	physical: z
		.object({
			height_build: text("Height, weight, body type."),
			face: text("Face, eyes, skin."),
			hair: text("Hair."),
			first_impression: text("Overall impression at first glance."),
		})
		.describe(
			"Body basics. Marks, movement and clothing live in the look section.",
		),
	life_events: z
		.array(
			z.object({
				age: text("Age when it happened."),
				event: text("What happened."),
				effect: text("How it changed them."),
			}),
		)
		.length(3)
		.describe("Exactly 3 formative life events."),
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
	energy: text("Energy level."),
	temperament: text("Temperament: reaction speed, excitability."),
	social: text("Introvert / extravert."),
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

const scale = (min: number, max: number, describe: string) =>
	z.number().min(min).max(max).describe(describe);

/** Proportions and asymmetries: they build the pose skeleton, so every body is the character's own, not a template. */
const BodySchema = z
	.object({
		head_heights: scale(
			3,
			10,
			"Standing height in head lengths, as drawn in the art style: ~4 small child, ~6 teen or stocky, 7-7.5 average adult, 8+ tall and elongated, 9.5-10 fashion-sketch extreme.",
		),
		shoulders: scale(
			0.6,
			1.6,
			"Shoulder width vs an average adult of their sex: 1 average, 0.8 narrow, 1.3 broad.",
		),
		hips: scale(
			0.6,
			1.6,
			"Hip width vs an average adult of their sex: 1 average, 0.8 narrow, 1.3 wide.",
		),
		legs: scale(
			0.8,
			1.2,
			"Leg length vs average: 0.9 short-legged, 1.1 long-legged.",
		),
		arms: scale(0.85, 1.15, "Arm length vs average: 0.9 short, 1.1 long."),
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
			"Where these proportions and asymmetries come from (genes, work, injury, age, habit), each tied to the story.",
		),
	})
	.describe(
		"The body's own proportions and imperfections. Not idealized: average is fine, symmetry is rare.",
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
				hair: z
					.string()
					.regex(/^#[0-9a-fA-F]{6}$/)
					.describe("Hair colour."),
				skin: z
					.string()
					.regex(/^#[0-9a-fA-F]{6}$/)
					.describe("Skin (or fur / scales) colour."),
				top: z
					.string()
					.regex(/^#[0-9a-fA-F]{6}$/)
					.describe("Main colour of the upper body and arms (sleeves)."),
				bottom: z
					.string()
					.regex(/^#[0-9a-fA-F]{6}$/)
					.describe("Main colour of the lower body and legs."),
				footwear_left: z
					.string()
					.regex(/^#[0-9a-fA-F]{6}$/)
					.describe("Footwear on the character's LEFT foot."),
				footwear_right: z
					.string()
					.regex(/^#[0-9a-fA-F]{6}$/)
					.describe("Footwear on the character's RIGHT foot."),
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
							color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
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
					mark: text("Scar, tattoo, prosthetic, imperfection..."),
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
					hex: z
						.string()
						.regex(/^#[0-9a-fA-F]{6}$/)
						.describe("#RRGGBB"),
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

export type CharacterCard = z.infer<typeof CharacterCardSchema>;

export function slugify(name: string): string {
	const slug = name
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "character";
}
