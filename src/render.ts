import type { CharacterCard } from "./schema.js";

/**
 * One description of the card's content (sections → blocks), two serializers (Markdown, HTML).
 * Adding or moving a field happens once, in `sections()`.
 */

type Item = string | { lead: string; text: string };
type Block =
  | { rows: [string, string][] }
  | { list: Item[]; title?: string; timeline?: boolean }
  | { quotes: string[] }
  | { cards: { label: string; text: string; tone?: "best" | "worst" }[]; kind: "chain" | "states" | "traits" }
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
  const side = (v: number, lower: string) => (v === 0 ? "" : `${v > 0 ? "right" : "left"} ${lower} ${Math.abs(v)}`);
  const parts = [
    `${b.head_heights} heads`,
    `shoulders ×${b.shoulders}`, `hips ×${b.hips}`, `legs ×${b.legs}`, `arms ×${b.arms}`,
    side(b.shoulder_tilt, "shoulder lower"), side(b.head_tilt, "head tilt"),
    b.stoop ? `stoop ${b.stoop}` : "", b.knees === "straight" ? "" : `${b.knees} knees`,
  ].filter(Boolean);
  return `${parts.join(", ")} — ${b.why}`;
}

function sections(c: CharacterCard): { main: Section[]; visual: Section } {
  const { core, goals: g, identification: id, psychology: p, description: d, fears: f, uniqueness: u, backstory: b, traits: t, destiny: ds, look: lk } = c;
  const life = u.lifestyle;
  const main: Section[] = [
    { n: "00", title: "Core", blocks: [
      { kind: "chain", cards: [{ label: "Wound", text: core.wound }, { label: "Lie", text: q(core.lie) }, { label: "Truth", text: q(core.truth) }] },
      { rows: [["Central paradox", core.central_paradox], ["Dramatic question", core.dramatic_question], ["Why these sparks", core.spark_links]] },
    ] },
    { n: "01", title: "Goals", blocks: [
      { rows: [["Want", g.want], ["Need", g.need], ["Motivation", g.motivation], ["Inner arc", g.arc_goal], ["Conflicting goals", g.conflicting_goals], ["Goal climax", g.goal_climax], ["Scene goal example", g.scene_goal_example]] },
    ] },
    { n: "02", title: "Audience identification", blocks: [
      { list: id.methods.map((m) => ({ lead: m.method, text: m.how })) },
      { title: "Flaws", list: id.flaws.map((x) => ({ lead: `${x.flaw} (${x.category})`, text: x.how_it_shows })) },
      { rows: [["Superpower", id.superpower], ["Vulnerability", id.vulnerability], ["Sympathy hook", id.sympathy_hook], ["First appearance", id.first_appearance], ["Jeopardy", id.jeopardy]] },
    ] },
    { n: "03", title: "Psychological profile", blocks: [
      { kind: "states", cards: [{ label: "Passive", text: p.states.passive }, { label: "Reactive", text: p.states.reactive }, { label: "Active", text: p.states.active }] },
      { quotes: p.inner_monologue.map(q) },
      { rows: [["Emotional baseline", p.emotional_baseline], ["Interprets experience", p.interprets_experience], ["Psychological issues", p.psychological_issues], ["Insecurity", p.insecurity], ["Strong beliefs", p.strong_beliefs], ["Strongest trigger", p.strongest_trigger], ["Childhood", p.childhood], ["Showing the inner state", p.visual_device]] },
    ] },
    { n: "04", title: "Description", blocks: [
      { rows: [["Name", d.name_meaning], ["Age", d.age], ["Gender", d.gender], ["Species", d.species], ["Cultural background", d.cultural_background]] },
      { title: "Body", list: [d.physical.height_build, d.physical.face, d.physical.hair] },
      { note: d.physical.first_impression },
      { title: "Formative events", timeline: true, list: d.life_events.map((e) => ({ lead: e.age, text: `${e.event} → ${e.effect}` })) },
      { rows: [["Speech", d.speech.manner], ["Pet words", d.speech.pet_words.map(q).join(", ")]] },
      { quotes: d.speech.sample_lines },
      { title: "Sociology", list: [
        { lead: "Status", text: d.sociology.status }, { lead: "Education", text: d.sociology.education }, { lead: "Money", text: d.sociology.money },
        { lead: "Friends & family", text: d.sociology.friends_family }, { lead: "Place", text: d.sociology.place }, { lead: "World events", text: d.sociology.world_events },
      ] },
      { rows: [["Hobbies & interests", d.hobbies.join("; ")], ["Biggest disappointment", d.biggest_disappointment], ["Values most", d.most_valued], ["Secret dream & future", d.secret_dream], ["Missing from life", d.missing]] },
    ] },
    { n: "05", title: "Fears", blocks: [
      { list: f.fears.map((x) => ({ lead: x.conscious ? x.fear : `${x.fear} (unconscious)`, text: x.root })) },
      { rows: [["Mask", f.mask], ["Source of courage", f.courage_source], ["Overcoming", f.overcoming]] },
    ] },
    { n: "06", title: "Universal & unique", blocks: [
      { rows: [["Archetype", u.archetype], ["Twist", u.twist]] },
      { title: "Quirks", list: u.quirks },
      { title: "Lifestyle", list: [
        { lead: "Tastes", text: life.tastes }, { lead: "Shopping", text: life.shopping }, { lead: "Food", text: life.food }, { lead: "Vehicle", text: life.vehicle },
        { lead: "Love", text: life.love_style }, { lead: "Sore spot", text: life.sore_spot }, { lead: "Non-verbal tics", text: life.nonverbal_tics },
        { lead: "Talents", text: life.talents }, { lead: "Spirituality", text: life.spirituality },
      ] },
      { rows: [["Stress relief", u.stress_relief], ["Dream vacation", u.dream_vacation]] },
    ] },
    { n: "07", title: "Backstory & world", blocks: [
      { title: "Biography", prose: b.biography },
      { title: "World", list: [
        { lead: "Who rules", text: b.world.who_rules }, { lead: "Boundaries", text: b.world.boundaries }, { lead: "Hierarchy", text: b.world.hierarchy },
        { lead: "Good and bad", text: b.world.good_and_bad }, { lead: "Worth dying for", text: b.world.worth_dying_for }, { lead: "Worth living for", text: b.world.worth_living_for },
        { lead: "Best and worst", text: b.world.best_and_worst }, { lead: "Survival vs comfort", text: b.world.survival_vs_comfort },
      ] },
      { rows: [["Tie to the past", b.connection_to_past], ["Compared to peers", b.distance_from_peers], ["Daily life", b.daily_life], ["Decision-making", b.decision_style]] },
      { title: "Key locations", list: b.key_locations },
      { title: "Contradictions", list: b.contradictions.map((x) => ({ lead: x.with_whom, text: x.behavior })) },
    ] },
    { n: "08", title: "Character traits", blocks: [
      { kind: "traits", cards: [
        { label: "Best trait", text: t.best_trait, tone: "best" }, { label: "Worst trait", text: t.worst_trait, tone: "worst" },
        ...t.other_traits.map((x) => ({ label: "Other trait", text: x })),
      ] },
      { rows: [["Energy", t.energy], ["Temperament", t.temperament], ["Social", t.social], ["Habits", t.habits.join("; ")]] },
      { title: "Reactions", list: t.reactions.map((r) => ({ lead: r.situation, text: r.reaction })) },
      { title: "What others say", list: t.others_say.map(q) },
    ] },
    { n: "09", title: "Destiny", blocks: [
      { timeline: true, list: [
        { lead: "Ordinary world", text: ds.ordinary_world }, { lead: "The void", text: ds.void }, { lead: "Threshold", text: ds.threshold },
        { lead: "Ordeal", text: ds.ordeal }, { lead: "Transformation", text: ds.transformation }, { lead: "Ending", text: ds.ending },
      ] },
    ] },
  ];
  const visual: Section = { n: "", title: "Look", blocks: [
    { palette: lk.palette },
    { title: "Reads in 3 seconds", list: lk.story_reads },
    { rows: [["Shape language", lk.shape_language], ["Silhouette", lk.silhouette], ["Perfection", lk.perfection], ["Body", bodyLine(lk.body)]] },
    { title: "Signature item", list: [{ lead: lk.signature_item.item, text: `${lk.signature_item.story} — ${lk.signature_item.how_carried}` }] },
    { title: "Marks", list: lk.marks.map((m) => ({ lead: `${m.mark} (${m.location})`, text: m.origin })) },
    { title: "Movement", list: [
      { lead: "Gait", text: lk.movement.gait }, { lead: "Idle", text: lk.movement.idle_pose },
      { lead: "Gesture", text: lk.movement.signature_gesture }, { lead: "Under stress", text: lk.movement.under_stress },
    ] },
    { title: "Outfit", list: lk.outfit.map((o) => ({ lead: o.piece, text: o.why })) },
    { rows: [["Props", lk.props.join("; ") || "—"], ["Art style", lk.art_style], ["Turnaround notes", lk.turnaround_notes]] },
  ] };
  return { main, visual };
}

const tags = (c: CharacterCard) => [c.meta.medium, c.meta.genre, c.uniqueness.archetype, c.description.age, c.description.species];

// ---------- Markdown ----------

function mdBlock(b: Block): string {
  if ("rows" in b) return b.rows.map(([k, v]) => `**${k}:** ${v}`).join("\n\n");
  if ("list" in b) {
    const items = b.list.map((i) => `- ${typeof i === "string" ? i : `**${i.lead}** — ${i.text}`}`).join("\n");
    return b.title ? `**${b.title}:**\n${items}` : items;
  }
  if ("quotes" in b) return b.quotes.map((x) => `> ${x}`).join("\n>\n");
  if ("cards" in b) return b.cards.map((x) => `- **${x.label}:** ${x.text}`).join("\n");
  if ("prose" in b) return b.title ? `**${b.title}:**\n\n${b.prose}` : b.prose;
  if ("note" in b) return `*${b.note}*`;
  return `**Palette:**\n${b.palette.map((x) => `- ${x.name} \`${x.hex}\` — ${x.meaning}`).join("\n")}`;
}

const mdSection = (s: Section) => [`## ${s.n ? `${Number(s.n)}. ` : ""}${s.title}`, ...s.blocks.map(mdBlock)].join("\n\n");

export function renderMarkdown(c: CharacterCard, opts: { conceptFile?: string } = {}): string {
  const { main, visual } = sections(c);
  return `${[
    `# ${c.meta.name}`,
    `*${c.meta.tagline}*`,
    `> ${c.meta.logline}`,
    tags(c).map((t) => `\`${t}\``).join(" · "),
    opts.conceptFile ? `![T-pose concept](${opts.conceptFile})` : "",
    ...main.map(mdSection),
    mdSection(visual),
  ]
    .filter(Boolean)
    .join("\n\n")}\n`;
}

// ---------- HTML ----------

/** Relative luminance (WCAG) of a #RRGGBB colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The first palette colour readable as text on white (contrast ≥ 4.5), else the darkest one. */
function accentOf(palette: { hex: string }[]): string {
  const readable = palette.find((p) => 1.05 / (luminance(p.hex) + 0.05) >= 4.5);
  return (readable ?? [...palette].sort((a, b) => luminance(a.hex) - luminance(b.hex))[0]).hex;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function htmlBlock(b: Block): string {
  if ("rows" in b) return `<dl>${b.rows.map(([k, v]) => `<div class="row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;
  if ("list" in b) {
    const tag = b.timeline ? "ol" : "ul";
    const items = b.list
      .map((i) => {
        if (typeof i === "string") return `<li>${esc(i)}</li>`;
        return b.timeline ? `<li><b>${esc(i.lead)}</b><span>${esc(i.text)}</span></li>` : `<li><b>${esc(i.lead)}</b> — ${esc(i.text)}</li>`;
      })
      .join("");
    return `${b.title ? `<h3>${esc(b.title)}</h3>` : ""}<${tag}${b.timeline ? ' class="timeline"' : ""}>${items}</${tag}>`;
  }
  if ("quotes" in b) return `<blockquote>${b.quotes.map((x) => `<p>${esc(x)}</p>`).join("")}</blockquote>`;
  if ("cards" in b) {
    return `<div class="cards ${b.kind}">${b.cards.map((x) => `<div${x.tone ? ` class="${x.tone}"` : ""}><small>${esc(x.label)}</small>${esc(x.text)}</div>`).join("")}</div>`;
  }
  if ("prose" in b) return `${b.title ? `<h3>${esc(b.title)}</h3>` : ""}<p class="prose">${esc(b.prose)}</p>`;
  if ("note" in b) return `<p class="note">${esc(b.note)}</p>`;
  return `<div class="palette">${b.palette.map((x) => `<div><i style="background:${x.hex}"></i><span title="${esc(x.meaning)}">${esc(x.name)}<br><code>${x.hex}</code></span></div>`).join("")}</div>`;
}

const htmlSection = (s: Section) => `<section><h2>${s.n ? `<span>${s.n}</span>` : ""}${esc(s.title)}</h2>${s.blocks.map(htmlBlock).join("")}</section>`;

export function renderHtml(c: CharacterCard, opts: { conceptFile?: string } = {}): string {
  const { main, visual } = sections(c);
  const concept = opts.conceptFile
    ? `<figure class="concept"><img src="${esc(opts.conceptFile)}" alt="T-pose concept"><figcaption>T-pose concept</figcaption></figure>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.meta.name)} — character card</title>
<style>
  :root { --accent: ${accentOf(c.look.palette)}; --ink: #1c1917; --muted: #78716c; --line: #e7e5e4; --paper: #fafaf9; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); background: var(--paper); }
  header { padding: 48px 56px 32px; border-bottom: 1px solid var(--line); background: #fff; }
  header h1 { font: 700 44px/1.1 Georgia, "Times New Roman", serif; margin: 0 0 6px; letter-spacing: -0.01em; }
  header .tagline { font-style: italic; color: var(--accent); font-size: 18px; margin: 0 0 16px; }
  header .logline { max-width: 820px; font-size: 17px; margin: 0 0 16px; }
  .tag { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px; margin: 0 6px 6px 0; font-size: 12px; color: var(--muted); }
  main { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 40px; padding: 32px 56px 64px; }
  @media (max-width: 1000px) { main { grid-template-columns: 1fr; padding: 24px; } header { padding: 32px 24px; } aside { order: -1; } }
  section { padding: 8px 0 24px; border-bottom: 1px solid var(--line); }
  h2 { font: 700 22px/1.2 Georgia, serif; margin: 20px 0 12px; display: flex; gap: 12px; align-items: baseline; }
  h2 span { font: 600 12px ui-monospace, monospace; color: var(--accent); }
  h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 18px 0 6px; }
  dl { margin: 8px 0; }
  .row { display: grid; grid-template-columns: 190px 1fr; gap: 12px; padding: 6px 0; border-top: 1px dashed var(--line); }
  .row:first-child { border-top: 0; }
  dt { color: var(--muted); font-size: 13px; }
  dd { margin: 0; }
  ul { padding-left: 18px; margin: 6px 0; }
  li { margin: 3px 0; }
  blockquote { margin: 8px 0; padding: 6px 14px; border-left: 3px solid var(--accent); background: #fff; font-style: italic; }
  blockquote p { margin: 2px 0; }
  .prose { font: 16px/1.65 Georgia, serif; max-width: 70ch; }
  .note { font-style: italic; color: var(--muted); }
  .timeline { list-style: none; padding: 0; }
  .timeline li { display: grid; grid-template-columns: 140px 1fr; gap: 12px; padding: 8px 0; border-top: 1px dashed var(--line); }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin: 8px 0 12px; }
  .cards.chain, .cards.states { grid-template-columns: repeat(3, 1fr); }
  .cards > div { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
  .cards.chain > div, .cards.traits > div { font-weight: 600; }
  .cards small { display: block; font-weight: 400; font-size: 11px; color: var(--accent); text-transform: uppercase; letter-spacing: .05em; }
  .cards .best { border-color: #16a34a; } .cards .worst { border-color: #dc2626; }
  aside { position: sticky; top: 16px; align-self: start; }
  aside section { border: 0; }
  aside .row { grid-template-columns: 110px 1fr; }
  .concept { margin: 0 0 16px; background: #fff; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .concept img { display: block; width: 100%; }
  .concept figcaption { font-size: 12px; color: var(--muted); padding: 6px 10px; }
  .palette { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
  .palette div { display: flex; gap: 8px; align-items: center; font-size: 12px; }
  .palette i { width: 32px; height: 32px; border-radius: 6px; border: 1px solid rgba(0,0,0,.1); flex: none; }
  footer { padding: 16px 56px 40px; color: var(--muted); font-size: 12px; }
  @media print { aside { position: static; } body { background: #fff; } }
</style>
</head>
<body>
<header>
  <h1>${esc(c.meta.name)}</h1>
  <p class="tagline">${esc(c.meta.tagline)}</p>
  <p class="logline">${esc(c.meta.logline)}</p>
  <div>${tags(c).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
</header>
<main>
  <div>${main.map(htmlSection).join("\n")}</div>
  <aside>${concept}${htmlSection(visual)}</aside>
</main>
<footer>character-forge-mcp${c.meta.seed !== undefined ? ` · seed ${c.meta.seed}` : ""}</footer>
</body>
</html>
`;
}
