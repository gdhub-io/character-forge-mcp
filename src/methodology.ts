/**
 * Character-development methodology as data.
 *
 * Based on Sherri Sheridan, "Developing Digital Short Films" (character chapter)
 * and Michael Dougan's "one best / one worst / three other traits" method.
 * The lists feed `referenceLists()` (menus the model picks from); MEDIUMS…ARCHETYPES are also rolled.
 * The coherent core chains that rolls are built on live in engine.ts.
 */

export const POPULAR_ARC_GOALS = [
  "Let go of the past",
  "Take responsibility for their own actions",
  "Find happiness",
  "Find peace of mind",
  "Let go in order to sacrifice for something",
  "Believe in something worthwhile",
  "Find a new version of themselves",
  "Find balance between extremes",
  "Let go of suicidal thoughts",
  "Fit into a new world",
  "Find love",
  "Change a core belief",
  "Come of age",
  "See the beauty in themselves and others",
  "Release all fears and trust that things will be fine",
  "Master something",
  "Change how they perceive the world",
  "Be honest with themselves and others",
  "Resolve a conflict between inner beliefs",
  "Learn compassion for others",
  "See the world in a new way",
  "Find their own truth",
  "Make peace with the past",
  "Overcome an old trauma",
  "Gain self-confidence",
  "Redefine who they are in relation to the world",
  "Reach a new level of understanding",
  "Overcome a fear of something",
  "Find a purpose in life",
  "Understand something that changes their view of life",
  "Become a leader",
  "Create their life instead of being swept along by circumstance",
  "Trust intuition over logic",
] as const;

export const IDENTIFICATION_METHODS = [
  { key: "best_qualities", label: "Best qualities", hint: "Expert in their field, brilliant, wise, very talented, inventive, respected." },
  { key: "shared_desires", label: "Shared opinions / desires", hint: "The audience knows this world and wants what the character wants." },
  { key: "flaws", label: "Flaws", hint: "Physical, emotional, spiritual, psychological or personality flaws. A character at war with themselves is fascinating." },
  { key: "superpower", label: "Superpower", hint: "Something amazing they can do, balanced by a specific vulnerability (their kryptonite)." },
  { key: "visual_appeal", label: "Visual appeal", hint: "Memorable, readable, attractive to look at (not necessarily pretty)." },
  { key: "early_intro", label: "Introduced early", hint: "We meet the protagonist as soon as possible." },
  { key: "sympathy", label: "Sympathy", hint: "We feel for them, especially when they are treated unfairly." },
  { key: "jeopardy", label: "Jeopardy", hint: "The audience loves to worry: put them in emotional or physical danger." },
  { key: "familiar_places", label: "Familiar places", hint: "Universal yet specific settings: family dinner, classroom, office." },
  { key: "audience_eyes", label: "Audience's eyes", hint: "They discover the new world at the same time as we do." },
  { key: "active", label: "Active", hint: "Makes decisions and acts. A passive hero is boring." },
  { key: "underemployed", label: "Underemployed", hint: "Destined for greatness but stuck in a dull job, or out of work." },
  { key: "humor", label: "Sense of humor", hint: "Witty, makes us laugh." },
  { key: "helps_others", label: "Helps others", hint: "Helps people or animals." },
  { key: "loves", label: "Loves someone", hint: "Loves children, family, pets (or, comically, only themselves)." },
  { key: "creativity", label: "Creativity", hint: "Makes or deeply appreciates art." },
  { key: "calling", label: "Calling", hint: "Fully devoted to a higher purpose, selfless." },
] as const;

export const FLAWS = {
  physical: [
    "missing limb", "prominent scars", "unconventional, 'ugly' face", "bad teeth", "heavily overweight",
    "disfigured", "one leg shorter than the other", "chronic stammer", "poor eyesight", "frail body",
  ],
  emotional: [
    "violent mood swings", "constant cries for attention", "emotionally numb", "laughs at the wrong things",
    "uncontrollable anger", "deeply insecure", "afraid of everything", "clingy", "emotionally volatile",
  ],
  spiritual: [
    "religious fanatic", "cult follower", "mostly malicious", "unafraid to kill",
    "believes the world is going downhill", "extremely superstitious", "always trying to change other people",
    "lost all faith",
  ],
  psychological: [
    "impulsive", "hears voices", "manic-depressive", "addict", "split personality",
    "losing their mind", "memory problems", "obsessive-compulsive", "paranoid", "panic attacks",
  ],
  personality: [
    "arrogant", "rude", "delusional", "self-destructive", "barely alive inside", "ego-maniac",
    "clumsy", "foolish", "compulsive liar", "control freak",
  ],
} as const;

export type FlawCategory = keyof typeof FLAWS;

export const FEARS = [
  "Fear of losing someone or something very precious",
  "Fear of being ridiculed",
  "Fear of being unable to love or be loved",
  "Fear of failure",
  "Fear of being vulnerable",
  "Fear that past traumas will return",
  "Phobia of a creature (snakes, spiders, dogs, crocodiles, sharks, killer bees...)",
  "Fear of injury",
  "Fear that things will only get worse",
  "Fear of loneliness",
  "Fear of not knowing how to do something",
  "Fear of making a mistake",
  "Fear of physical pain",
  "Fear of illness",
  "Fear of rejection",
  "Fear of becoming poor or homeless",
  "Fear that someone will discover a big secret or insecurity",
  "Fear of being caught for something they did in the past",
  "Fear of a specific person, object or situation from the past",
] as const;

export const FEAR_OVERCOMING = [
  "Faces the fear head-on and succeeds, winning the audience's trust",
  "Hits rock bottom and asks others for help, or realises there is nothing left to lose",
  "Fear paralyses them until they are close to death and no option but action remains",
  "Takes one small step forward, grows bolder, and keeps moving step by step",
  "Simply starts taking action",
  "Hides the fear hard, then breaks when the truth arrives — and finds the feared thing is not frightening at all",
  "Cracks under the pressure of the fear and ends up freer than before",
  "Realises the fear costs too much and lets it go",
  "Wants to help others, acts for them, and forgets the fear",
  "Relives the past",
] as const;

export const ARCHETYPES = [
  "rebel", "saint", "madman", "hero", "sinner", "soldier", "mother", "cowboy", "detective", "gangster",
  "fortune teller", "thief", "drunkard", "shopkeeper", "businessperson", "orphan", "mentor", "trickster",
  "outcast", "caregiver", "explorer", "lover", "ruler", "innocent", "jester", "creator", "magician",
] as const;

export const UNIQUENESS_QUESTIONS = [
  "What weird hobby do they have? Which two odd hobbies could merge into one?",
  "Where do they shop — thrift stores or boutiques?",
  "Strange taste in music, food, films, shows?",
  "Romantic quirks: how do they show love, what relationships do they prefer?",
  "What strange little thing upsets them or hits a sore spot?",
  "Food preferences, or an unusual way of ordering food?",
  "How do they drive, and what do they drive?",
  "Unusual talents?",
  "Odd non-verbal tics: grinding teeth, blinking, constantly turning their head?",
  "What kind of clothes do they wear?",
  "How do they react to stress — overeat, chop wood, take apart clocks?",
  "How do they practice spirituality — rituals, meditations, sects?",
  "What does their dream vacation look like?",
] as const;

export const BEST_TRAITS = [
  "champion", "professional", "master", "top of their field", "model", "warrior", "hunk / bombshell",
  "brave", "rich", "charming", "talented", "well-educated", "mentor", "happy", "caretaker", "childlike",
  "funny", "compassionate", "loving", "artistic", "independent", "enlightened", "enthusiastic", "heroic",
  "imaginative", "inspiring", "passionate", "integrity", "king / queen", "leader", "survivor", "wise",
  "miracle", "psychic",
] as const;

export const OTHER_TRAITS = [
  "smart", "athletic", "tender", "scary", "restless", "bold", "positive", "average", "loyal", "melancholic",
  "competitive", "creative", "conservative", "embarrassed", "dark humor", "delicate", "misguided",
  "discontented", "calm", "anxious", "cowboy", "anal-retentive", "drifter", "maternal", "selfish",
  "fashionable", "street-smart", "heartbroken", "cheap", "observant", "stubborn", "storyteller", "modern",
  "worldly", "goofy", "aloof", "middle-class", "beatnik", "gypsy soul", "thief", "intuitive", "bitter",
  "bookish", "know-it-all", "liberal", "ex-convict", "dishonest", "curious", "fugitive", "forgetful",
  "silly", "freak", "gentleman", "modest", "hood", "saintly", "intense", "lucky", "logical", "loud",
  "lonely", "musical", "simple", "stressed", "apathetic", "alien", "soft", "fake", "activist", "sullen",
  "corporate", "homeless", "hippie", "cold", "redneck", "trashy", "cultured", "boring", "picky",
  "nature lover", "mysterious", "nervous", "unpleasant", "outlaw", "animal lover", "peaceful", "very young",
  "very old", "political", "playboy", "perfectionist", "genius", "sexy", "cheerful", "responsible",
  "small-town", "shy", "superficial", "high-strung", "tough", "wild", "biker",
] as const;

export const WORST_TRAITS = [
  "insane", "attitude problem", "dead inside", "mean", "alcoholic", "negative", "poor", "annoying",
  "depressed", "crazy", "corrupt", "greedy", "obsessed", "evil", "clumsy", "gossip", "hothead",
  "hypochondriac", "ignorant", "impulsive", "jerk", "irresponsible", "maniac", "neurotic", "cruel",
  "cynical", "psychotic", "possessive", "violent", "zombie", "burned out", "useless", "broken", "lazy",
] as const;

export const ENERGY = ["very low", "low", "medium", "high", "explosive"] as const;
export const TEMPERAMENT = ["choleric", "sanguine", "phlegmatic", "melancholic"] as const;
export const SOCIAL = ["strong introvert", "introvert", "ambivert", "extravert", "strong extravert"] as const;

export const MEDIUMS = ["film", "game", "animation", "advertising", "book", "comics", "tabletop"] as const;

export const GENRES = [
  "drama", "comedy", "thriller", "horror", "sci-fi", "fantasy", "noir", "romance", "adventure",
  "western", "post-apocalyptic", "cyberpunk", "fairy tale", "satire", "mystery", "slice of life",
] as const;

export const SETTINGS = [
  "a dying seaside town", "a megacity slum in 2090", "a 1920s traveling circus", "a remote research station",
  "a suburban cul-de-sac", "a floating sky archipelago", "a monastery in the mountains", "a night market",
  "a generation ship", "a war-torn border village", "a luxury hotel in decline", "a forest kingdom of beasts",
  "a corporate tower", "a school for the gifted", "a desert caravan route", "an underwater colony",
  "a provincial hospital", "a pirate port", "a ghost-infested apartment block", "a city of living machines",
] as const;

export const SPECIES = [
  "human", "human", "human", "human", "android", "talking animal", "spirit", "elf-like folk", "alien",
  "mutant", "robot", "insect-person", "golem",
] as const;

export const AGE_BANDS = ["child (8-12)", "teen (13-18)", "young adult (19-29)", "adult (30-45)", "middle-aged (46-60)", "elder (61+)"] as const;

/** Compact methodology text the model reads before writing a card. */
/** The konspekt's lists, offered to the model as menus to choose from (not rolled). */
export function referenceLists(): string {
  const flaws = (Object.keys(FLAWS) as FlawCategory[]).map((k) => `  ${k}: ${FLAWS[k].join(", ")}`).join("\n");
  return [
    "REFERENCE LISTS — menus for inspiration; pick, combine or twist, never copy blindly.",
    `Popular inner arcs: ${POPULAR_ARC_GOALS.join("; ")}.`,
    `Identification methods: ${IDENTIFICATION_METHODS.map((m) => m.label).join("; ")}.`,
    `Flaws by category:\n${flaws}`,
    `Fears: ${FEARS.join("; ")}.`,
    `Ways to overcome fear: ${FEAR_OVERCOMING.join("; ")}.`,
    `Archetypes: ${ARCHETYPES.join(", ")}.`,
    `Uniqueness questions: ${UNIQUENESS_QUESTIONS.join(" ")}`,
    `Best traits: ${BEST_TRAITS.join(", ")}.`,
    `Worst traits: ${WORST_TRAITS.join(", ")}.`,
    `Other traits: ${OTHER_TRAITS.join(", ")}.`,
    `Energy: ${ENERGY.join(", ")} · Temperament: ${TEMPERAMENT.join(", ")} · Social: ${SOCIAL.join(", ")}.`,
  ].join("\n\n");
}

export const METHOD_GUIDE = `
CHARACTER METHOD. A strong character is ONE causal system, not a list of traits.

0. CORE — build this first; every other section must trace back to it.
   WOUND: the formative hurt. LIE: the false belief the wound taught them.
   FEAR: what the lie makes them dread. DEFENSE: how they protect the lie = their WORST trait.
   GIFT: what the same wound forged = their BEST trait. Best and worst are two faces of one wound:
   that is the CENTRAL PARADOX that makes them vivid. TRUTH: what they must learn = the NEED.
   WANT feeds the lie; NEED is the truth; the climax forces a choice between them.
   Surprising elements (job, world, look, archetype) must grow out of the core: unexpected, yet inevitable.

Then fill the 9 sections; the card schema mirrors them.

1. GOALS — The audience must grasp what the character wants in the first minutes.
   WANT: conscious external goal; may change during the story.
   NEED: inner, often unconscious; does NOT change; it carries the theme.
   MOTIVATION: why they choose based on want/need. The bigger the external goal,
   the deeper the inner change must be. The goal's climax coincides with the story climax.
   Strongest when want and need are MUTUALLY EXCLUSIVE (e.g. avenge partner vs. love the
   woman who killed him). In every scene the character has a scene goal.

2. IDENTIFICATION — why the audience bonds: best qualities, shared desires, flaws
   (physical / emotional / spiritual / psychological / personality), superpower balanced by
   a vulnerability, visual appeal, sympathy, jeopardy, familiar places, discovering the world
   through their eyes, being active, underemployed greatness, humor, helping others,
   loving someone, creativity, a calling. Pick at least three and say HOW each shows.
   Introduce the protagonist AS EARLY AS POSSIBLE, in a first appearance that shows who they are.
   Audiences love to worry: name the JEOPARDY (emotional or physical) that keeps them worried.

3. PSYCHOLOGY — three states: PASSIVE (no goal), REACTIVE (has a goal, needs a push),
   ACTIVE (fully committed). Emotional baseline; inner monologue (exactly 3 lines in their
   own voice); how they interpret experience (blame self / never responsible);
   psychological problems; insecurity; strong beliefs; strongest emotional trigger;
   childhood family climate; a VISUAL / AUDIO device to show their inner state on screen.

4. DESCRIPTION — a name that means something (etymology, metaphor of a trait — e.g. Nettly Frost:
   stinging nettle + cold); physical look (height, weight, hair, eyes, clothing, posture, scars,
   imperfections, cultural background, first impression); 3 formative life events, one sentence
   each (age + event + how it changed their view of life); hobbies (travel, music, weekends,
   collections, sport); speech (manner, pet words, sample lines); sociology (status, education,
   money, friends, family traditions, place, how world events affect them); biggest
   disappointment; most valued thing; secret dream and how they see their future; what is missing.

5. FEARS — fear grows from the biggest disappointment. The more they fear, the less they act.
   Some fears are unconscious; some characters wear a mask of fearlessness.
   Show what motivates them to push through, and HOW they overcome it.

6. UNIVERSAL + UNIQUE — an archetype we all recognise, then a twist that makes it
   unique (a detective who can't remember anything). At least 5 specific, filmable quirks.
   Answer the uniqueness questions as LIFESTYLE: tastes (music, food, films), shopping, food
   ordering, vehicle and driving, how they show love, sore spot, non-verbal tics, talents,
   spirituality. How they relieve stress. Dream vacation.

7. BACKSTORY & WORLD — write a short BIOGRAPHY (80-200 words, birth → start of the story) that
   dramatises the wound; ground it in real-feeling personal experience so it is plausible.
   The backstory is the past events that drive their emotional stake in the plot.
   The world must be as interesting as the hero: who rules and who makes the big decisions,
   the BOUNDARIES of their world (the audience will watch those borders; crossing them creates
   conflict), the social hierarchy, what is good/bad here, what is worth dying and living for, best/worst that
   can happen, survival vs. manicured nails. How the character connects to past events of
   this world; how far they have gone compared to people from their hometown; how they shop,
   eat, love, work, exercise and pray; key places (home, street, workplace) as a sketch.
   Show decision-making visually (throwing stones into water while thinking), and how it
   changes under pressure. CONTRADICTIONS: they behave differently with
   mom, friend, lover, boss — give at least 2 secondary characters that reveal other sides.

8. CHARACTER TRAITS — energy, temperament, introvert/extravert, habits.
   Dougan's formula: ONE best trait (what they do better than anyone in the world),
   ONE worst trait (could bring their downfall), THREE other traits for texture.
   Character is revealed through choices, actions, reactions, own dialogue and what others
   say about them. Make them VIVID, DEFINITE, PLAUSIBLE, WHOLE and COMPLEX.

9. DESTINY — the hero lives in an ordinary world with a VOID nothing there can fill;
   searches at home, fails, crosses into another world, overcomes obstacles, returns
   changed forever — master of two worlds (even if they die).
   Every scene moves the hero one step closer to the goal; villains, too, show who they are by
   moving toward theirs, not by standing still. Ideally every line of dialogue changes their fate.

LOOK — derived from the story, never invented beside it: shape language, silhouette, how perfect or
   flawed they are, the body's own proportions and asymmetries (never an idealized template), ONE signature item (their attribute) from the backstory, marks with origins,
   movement (gait, idle pose, gesture, under stress), outfit pieces with reasons, a palette with meanings,
   and 3 things a stranger reads in 3 seconds. Every element shows a part of the story.

QUALITY BAR: specific over generic ("collects broken umbrellas from bus stops" beats
"has a quirky hobby"). Every element should create story pressure. Contradictions are
good when they are motivated. Avoid clichés unless you twist them.
`.trim();
