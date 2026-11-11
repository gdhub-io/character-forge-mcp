import type { CharacterCard } from "./schema.js";

/** Words that usually mean the writer reached for a generic placeholder instead of a specific detail. */
const GENERIC = [
  "mysterious", "quirky", "interesting", "unique", "complex past", "troubled past", "dark past", "various", "some kind of",
  "something", "a lot of", "special", "normal", "typical", "kind-hearted", "has a heart of gold", "tough exterior",
  "strong-willed", "loves adventure", "independent woman", "lone wolf",
];
const GENERIC_RE = new RegExp(`\\b(${GENERIC.join("|")})\\b`);

export interface CheckResult {
  warnings: string[];
  questions: string[];
}

function strings(obj: unknown, path = ""): { path: string; value: string }[] {
  if (typeof obj === "string") return [{ path, value: obj }];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (obj && typeof obj === "object") return Object.entries(obj).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z']{4,}/g) ?? []);
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
  const all = strings(c).filter((s) => !s.path.startsWith("meta.brief") && !/^look\.palette\[\d+\]\.hex$/.test(s.path));

  for (const { path, value } of all) {
    const hit = GENERIC_RE.exec(value.toLowerCase())?.[1];
    if (hit) warnings.push(`${path}: generic phrase "${hit}" — replace with a concrete, filmable detail.`);
  }

  const seen = new Map<string, string>();
  for (const { path, value } of all) {
    const key = value.toLowerCase().replace(/\W+/g, " ").trim();
    if (key.length > 12 && seen.has(key)) warnings.push(`${path}: repeats ${seen.get(key)} word for word.`);
    else seen.set(key, path);
  }

  if (overlap(c.goals.want, c.goals.need) > 0.6) warnings.push("goals.want and goals.need say almost the same thing — the want should be external and pull AGAINST the need.");
  if (overlap(c.traits.best_trait, c.traits.worst_trait) > 0.6) warnings.push("traits.best_trait and traits.worst_trait are near-identical — make them two different faces of the wound.");

  const short = all.filter(
    (s) => /^(core|goals|destiny)\./.test(s.path) && s.value.split(/\s+/).length < 5,
  );
  for (const s of short) warnings.push(`${s.path}: too thin ("${s.value}") — the core, goals and destiny need full sentences.`);

  const unconscious = c.fears.fears.filter((f) => !f.conscious).length;
  if (unconscious === 0) warnings.push("fears: no unconscious fear — strong characters are driven by at least one fear they don't admit.");

  const q = [
    `WOUND → LIE: Does "${c.core.lie}" follow inevitably from "${c.core.wound}"?`,
    `LIE → FEAR: Does the fear "${c.fears.fears[0].fear}" protect the lie, and does it grow from the biggest disappointment "${c.description.biggest_disappointment}"?`,
    `DEFENSE: Is the worst trait "${c.traits.worst_trait}" the way they defend the lie — and the thing that could destroy them in the climax?`,
    `GIFT: Is the best trait "${c.traits.best_trait}" forged by the same wound? Does core.central_paradox make that visible?`,
    `WANT vs NEED: Does the want "${c.goals.want}" feed the lie, while the need "${c.goals.need}" equals the truth "${c.core.truth}"? Does the climax "${c.goals.goal_climax}" force a choice between them?`,
    `FLAWS: Do the flaws (${c.identification.flaws.map((f) => f.flaw).join("; ")}) express the defense or the wound rather than being random decoration?`,
    `QUIRKS: For each quirk, is it a scar of the wound, a ritual protecting the lie, or pure texture? At least 3 of ${c.uniqueness.quirks.length} should connect to the core.`,
    `BACKSTORY: Does the biography dramatise the wound "${c.core.wound}" as lived, specific experience? Do the 3 formative events appear in it and escalate?`,
    `WORLD: Are the boundaries "${c.backstory.world.boundaries}" the ones the character must cross in the destiny's threshold?`,
    `FIRST APPEARANCE: Does "${c.identification.first_appearance}" show the core in one image or action?`,
    `CONTRADICTIONS: Does each secondary character (${c.backstory.contradictions.map((x) => x.with_whom).join("; ")}) pressure the lie from a different side?`,
    `ARC: Is "${c.destiny.transformation}" precisely the move from the lie to the truth?`,
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
    r.warnings.length ? `RED FLAGS (${r.warnings.length}):\n${r.warnings.map((w) => `- ${w}`).join("\n")}` : "RED FLAGS: none.",
    "",
    "COHERENCE INTERVIEW — answer each honestly to yourself. Any 'no' or 'weakly' means revise that part before saving:",
    r.questions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
  ].join("\n");
}
