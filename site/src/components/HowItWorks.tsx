import {
  IconArrowRight,
  IconBrandGithub,
  IconDeviceGamepad2,
  IconKey,
  IconMessages,
  IconMusic,
  IconPlayerPlayFilled,
  IconScale,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { themeVars, type Character } from "../characters";
import { ui } from "../i18n";
import { GITHUB_URL, REPO, TopNav } from "./TopNav";

const CARD = [
  ["What they want", "And what they really need."],
  ["Why we care", "What makes an audience root for them."],
  ["How they think", "Their inner voice and what sets them off."],
  ["Who they are", "Name, past, the way they talk."],
  ["What they fear", "And the mask they hide it behind."],
  ["What sets them apart", "A familiar type with a twist, and odd habits."],
  ["Where they come from", "Their world and the people in it."],
  ["Best and worst", "Their strongest and weakest sides."],
  ["How they change", "The journey the story takes them on."],
];

/** One price list for the steps and the commands (estimates from models.json pricing). Paid steps need a fal.ai key. */
/** Section anchors other pages can link to (the router sends them here). */
export const GUIDE_SECTIONS = ["install", "commands"];

const FREE = "Free";
const PRICE = { concept: "≈ $0.02", scene: "≈ $0.05", video: "≈ $0.67", voice: "≈ $0.03", music: "≈ $0.60" };
const needsKey = (c: { cost: string }) => c.cost !== FREE;

interface Command {
  label: string;
  tool: string;
  text: string;
  /** What to type, optionally with what it starts from. */
  ask: (string | [string, string])[];
  get: string;
  cost: string;
}

const COMMANDS: Command[] = [
  {
    label: "Create a character",
    tool: "character_create",
    text: "Start from nothing, from a few words, from a picture, or from a picture and a few words. Three different versions of your idea are written and compared, and the strongest one becomes your character. If you gave a picture, their story explains everything in it, and it becomes their concept.",
    ask: [
      ["Nothing", "Surprise me: a character for a noir film."],
      ["A few words", "A 60-year-old ex-boxer for a coffee ad, warm but stubborn."],
      ["A picture", "Here’s my sketch: hero.png. Make her a character."],
      ["Both", "Here’s my sketch: hero.png. She’s a desert pilot who is afraid of the sea."],
    ],
    get: "A character card",
    cost: FREE,
  },
  {
    label: "Draw the concept",
    tool: "character_concept",
    text: "A picture of how they look, from the front and the back, drawn from what their card says about them: build, clothes, marks and the things they carry.",
    ask: ["Draw the concept for Marta."],
    get: "A concept picture",
    cost: PRICE.concept,
  },
  {
    label: "Put them in their place",
    tool: "character_scene",
    text: "The character appears in a place from their own story, standing the way they usually stand.",
    ask: ["Put Marta in her place."],
    get: "A picture of the scene",
    cost: PRICE.scene,
  },
  {
    label: "Bring the picture to life",
    tool: "character_video",
    text: "A short clip of that scene: they breathe and look around, and the world moves around them.",
    ask: ["Bring Marta’s scene to life."],
    get: "An 8-second video",
    cost: PRICE.video,
  },
  {
    label: "Give them a voice",
    tool: "character_voice",
    text: "A voice made for them, saying a few lines about the moment you see in the video. Every language gets its own performance.",
    ask: ["Give Marta a voice.", "Now make her speak Spanish too."],
    get: "A voice recording",
    cost: `${PRICE.voice} a language`,
  },
  {
    label: "Write their music",
    tool: "character_theme",
    text: "A short piece of music written for them, from their story and the place they live in.",
    ask: ["Write Marta’s music."],
    get: "A music track",
    cost: PRICE.music,
  },
  {
    label: "Get a prompt",
    tool: "character_prompt",
    text: "A ready prompt for a picture, video, voice or song, written from their card. Use it in any generator you like.",
    ask: ["Give me a prompt for a song about Marta."],
    get: "A prompt",
    cost: FREE,
  },
  {
    label: "Translate the card",
    tool: "character_translate",
    text: "The whole card in another language, retold naturally rather than word for word.",
    ask: ["Translate Marta’s card into French."],
    get: "The card in another language",
    cost: FREE,
  },
  {
    label: "What’s next?",
    tool: "character_next",
    text: "Not sure what to do next? It looks at what is already made for the character and suggests the next step, with its price.",
    ask: ["What’s next for Marta?"],
    get: "A list of next steps",
    cost: FREE,
  },
  {
    label: "What did it cost?",
    tool: "character_costs",
    text: "Everything spent on a character so far, step by step.",
    ask: ["How much has Marta cost so far?"],
    get: "A cost summary",
    cost: FREE,
  },
];

const Kicker = ({ children, accent }: { children: React.ReactNode; accent?: boolean }) => <p className={`kicker ${accent ? "text-accent" : "text-dim"}`}>{children}</p>;

const Section = ({ id, children, className = "" }: { id?: string; children: React.ReactNode; className?: string }) => (
  <section id={id} className={`scroll-mt-6 border-t border-line px-5 py-14 sm:px-12 sm:py-20 lg:px-30 ${className}`}>
    {children}
  </section>
);

const Bars = ({ heights }: { heights: number[] }) => (
  <div className="flex items-center gap-[3px]">
    {heights.map((h, i) => (
      <span key={i} className={`w-1 rounded-sm ${i % 3 === 1 ? "bg-accent" : "bg-dim"}`} style={{ height: h }} />
    ))}
  </div>
);

export function HowItWorks({ c, focus }: { c: Character; focus?: string }) {
  const [tab, setTab] = useState(0);
  const cmd = COMMANDS[tab];

  useEffect(() => {
    if (focus) document.getElementById(focus)?.scrollIntoView();
    else document.getElementById("top")?.scrollIntoView();
  }, [focus]);

  return (
    <main style={themeVars(c.theme)} className="thin-scroll h-full overflow-y-auto bg-deep font-sans text-fg">
      <div id="top" className="px-5 pt-4 sm:px-12 sm:pt-7">
        <TopNav page="how" />
      </div>

      <header className="px-5 pt-16 pb-14 sm:px-12 sm:pt-22 sm:pb-18 lg:px-30">
        <Kicker accent>What it is</Kicker>
        <h1 className="mt-6 max-w-[1000px] font-display text-[44px] leading-[1.04] font-medium tracking-[-0.02em] sm:text-[68px]">
          A character studio <br className="hidden sm:block" />
          inside your AI chat.
        </h1>
        <p className="mt-6 max-w-[680px] text-[16px] leading-relaxed text-dim sm:text-[18px]">
          Describe the character you need — or ask for a surprise. You get a whole person with a story that holds together, and then you can see them, hear them and give them their own music.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {[
            [IconMessages, "Claude Code, Claude Desktop, Cursor…"],
            [IconScale, "Free · MIT"],
            [IconDeviceGamepad2, "Film, games, ads, books"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof IconMessages;
            return (
              <span key={label as string} className="flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-[13px]">
                <I size={14} stroke={1.75} className="text-accent" /> {label as string}
              </span>
            );
          })}
        </div>
      </header>

      <Section className="grid gap-12 lg:grid-cols-[360px_1fr] lg:gap-20">
        <div>
          <Kicker accent>Step 1</Kicker>
          <h2 className="mt-4 font-display text-[32px] leading-[1.12] sm:text-[38px]">First, we write who they are</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-dim">Ask in your chat: “a lighthouse keeper for my game” or just “surprise me”. You get a character card that answers nine questions about them.</p>
        </div>
        <ol className="grid gap-x-10 sm:grid-cols-2">
          {CARD.map(([title, text], i) => (
            <li key={title} className="flex gap-5 border-b border-line py-4.5">
              <span className="w-8 shrink-0 font-display text-[28px] leading-none text-accent italic">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="mt-1 block text-[14px] text-dim">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <Kicker accent>Step 2</Kicker>
        <h2 className="mt-4 font-display text-[32px] sm:text-[44px]">Then, see them come alive</h2>
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 md:flex md:gap-2.5">
          {[
            ["Concept", PRICE.concept, "See them from the front and the back.", <img src={c.files.concept} alt="" loading="lazy" decoding="async" className="size-full object-cover" />],
            ["Their place", PRICE.scene, "They step into a place from their story.", <img src={c.files.scene ?? c.files.concept} alt="" loading="lazy" decoding="async" className="size-full object-cover" />],
            [
              "Living picture",
              PRICE.video,
              "They breathe, and the world moves around them.",
              c.files.video ? <PlayWhenVisible src={c.files.video} poster={c.files.scene} /> : <IconPlayerPlayFilled size={20} />,
            ],
            ["Their voice", PRICE.voice, "They speak a few lines, in any language.", <Bars heights={[10, 22, 36, 18, 44, 28, 52, 30, 14, 40, 24, 48, 20, 34, 12]} />],
            ["Their music", PRICE.music, "A short theme written for them.", <IconMusic size={34} stroke={1.5} className="text-accent" />],
          ].map(([title, price, text, media], i, all) => (
            <div key={title as string} className="contents">
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="grid h-[150px] place-items-center overflow-hidden rounded-[10px] border border-line bg-glass">{media}</div>
                <p className="font-mono text-[11px] text-dim">{price}</p>
                <h3 className="font-display text-[22px] leading-none">{title}</h3>
                <p className="text-[13px] leading-relaxed text-dim">{text}</p>
              </div>
              {i < all.length - 1 && (
                <div className="hidden h-[150px] w-5 shrink-0 place-items-center text-accent md:grid">
                  <IconArrowRight size={16} stroke={1.75} />
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section id="install">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_640px] lg:gap-16">
          <div>
            <Kicker accent>Start</Kicker>
            <h2 className="mt-5 font-display text-[36px] leading-[1.06] sm:text-[44px]">Add it to your chat</h2>
            <p className="mt-5 max-w-[520px] text-[16px] leading-relaxed text-dim">Copy one line into Claude or Cursor, then just ask for a character. It’s free.</p>
            <a href={GITHUB_URL} className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-5.5 py-3.5 text-sm font-semibold text-accent-ink">
              <IconBrandGithub size={15} stroke={1.75} /> GitHub
            </a>
          </div>
          <Terminal />
        </div>

        <div className="mt-12 rounded-[14px] border border-line bg-glass p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <IconKey size={20} stroke={1.75} className="shrink-0 text-accent" />
            <h3 className="font-display text-[22px] sm:text-[24px]">Pictures, video, voice and music need a fal.ai key</h3>
          </div>
          <div className="mt-6 grid gap-8 md:grid-cols-3">
            <KeyStep n="01" title="Get a key">
              <p>Sign up at fal.ai, open API keys and create one. You pay fal.ai only for what you make: about $1.50 for a whole character.</p>
            </KeyStep>
            <KeyStep n="02" title="Add it">
              <p>Claude Code asks for it when you install the plugin. Paste it there — it’s hidden and kept in your computer’s secure storage, not in the chat.</p>
              <p>Skipped it? Add it any time in /plugin → character-forge. Claude Desktop, Cursor: put it in the “env” of the server, as shown above.</p>
            </KeyStep>
            <KeyStep n="03" title="No key?">
              <p>Leave the key empty. You can still create characters and their full cards, and ask for a ready prompt for a picture, video, voice or song to use in any generator you like.</p>
              <p>Works in chats that run on your computer: Claude Code, Claude Desktop, Cursor. Browser chats can’t connect to it.</p>
            </KeyStep>
          </div>
        </div>
      </Section>

      <Section id="commands">
        <Kicker accent>Commands</Kicker>
        <h2 className="mt-3 font-display text-[32px] sm:text-[40px]">What you can ask for</h2>
        <div className="mt-9 grid gap-8 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr] lg:gap-10">
          <div role="tablist" aria-orientation="vertical" className="flex flex-col border-l border-line">
            {COMMANDS.map((x, i) => (
              <button
                key={x.tool}
                role="tab"
                aria-selected={i === tab}
                onClick={() => setTab(i)}
                className={`-ml-px flex flex-col gap-1 border-l-2 px-5 py-3 text-left transition-colors ${i === tab ? "border-accent bg-glass" : "border-transparent hover:bg-white/5"}`}
              >
                <span className={`text-[15px] ${i === tab ? "font-semibold text-fg" : "text-dim"}`}>{x.label}</span>
                <span className={`font-mono text-[11px] ${i === tab ? "text-accent" : "text-dim/70"}`}>
                  {x.tool}
                  {needsKey(x) && " · needs key"}
                </span>
              </button>
            ))}
          </div>
          <div role="tabpanel" className="flex flex-col gap-6 self-start rounded-[14px] border border-line bg-glass p-6 sm:p-10">
            <p className="font-mono text-[12px] text-accent">{cmd.tool}</p>
            <h3 className="-mt-2 font-display text-[30px] sm:text-[34px]">{cmd.label}</h3>
            <p className="text-[16px] leading-relaxed text-dim">{cmd.text}</p>
            <div className="flex flex-col gap-2.5">
              <Kicker>Ask like this</Kicker>
              {cmd.ask.map((a) => {
                const [from, q] = typeof a === "string" ? [undefined, a] : a;
                return (
                  <p key={q} className="flex flex-col gap-1 rounded-[10px] bg-white/5 px-4 py-3 text-[14px] sm:flex-row sm:items-baseline sm:gap-4">
                    {from && <span className="kicker w-28 shrink-0 text-[10px] text-accent">{from}</span>}
                    <span className="italic">“{q}”</span>
                  </p>
                );
              })}
            </div>
            <dl className="flex flex-wrap gap-x-8 gap-y-4 pt-2">
              {[
                ["You get", cmd.get],
                ["Cost", cmd.cost],
                ["fal key", needsKey(cmd) ? "Needed" : "Not needed"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="kicker text-dim">{k}</dt>
                  <dd className="mt-1.5 text-[15px] font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      <footer className="flex flex-col justify-between gap-2 border-t border-line px-5 py-6 text-[11px] text-dim sm:flex-row sm:px-12">
        <span className="font-mono">character-forge-mcp · MIT</span>
        <span>{ui("en").disclaimer}</span>
      </footer>
    </main>
  );
}

function KeyStep({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 text-[14px] leading-relaxed text-dim">
      <span className="kicker text-accent">{n}</span>
      <h4 className="text-[16px] font-semibold text-fg">{title}</h4>
      {children}
    </div>
  );
}

function Terminal() {
  const lines: [string, "comment" | "cmd" | "code" | "ask" | "gap"][] = [
    ["# Claude Code", "comment"],
    [`/plugin marketplace add ${REPO}`, "cmd"],
    ["/plugin install character-forge@character-forge", "cmd"],
    ["", "gap"],
    ["# Claude Desktop, Cursor, any MCP client", "comment"],
    ['"character-forge": {', "code"],
    ['  "command": "npx",', "code"],
    [`  "args": ["-y", "github:${REPO}"],`, "code"],
    ['  "env": { "FAL_KEY": "…" }', "code"],
    ["}", "code"],
    ["", "gap"],
    ["# Then just ask", "comment"],
    ["> Make me a random character for a noir film.", "ask"],
  ];
  return (
    <div className="min-w-0 overflow-hidden rounded-[14px] border border-line bg-[#0B0F11]">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        {["#E06C5A", "#E3B23C", "#6FA27F"].map((c) => (
          <span key={c} className="size-2.5 rounded-full opacity-70" style={{ background: c }} />
        ))}
        <span className="ml-1 font-mono text-[11px] text-dim">install</span>
      </div>
      <pre className="thin-scroll overflow-x-auto px-6 py-5 font-mono text-[12px] leading-[1.9] sm:text-[13px]">
        {lines.map(([t, k], i) =>
          k === "gap" ? (
            <br key={i} />
          ) : (
            <div key={i} className={k === "comment" ? "text-dim" : k === "ask" ? "text-accent" : "text-fg"}>
              {k === "cmd" && <span className="mr-2.5 text-accent">›</span>}
              {t}
            </div>
          ),
        )}
      </pre>
    </div>
  );
}

/** A muted loop that loads and plays only while it is on screen. */
function PlayWhenVisible({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? void v.play().catch(() => {}) : v.pause()));
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return <video ref={ref} src={src} poster={poster} muted loop playsInline preload="none" className="size-full object-cover" />;
}
