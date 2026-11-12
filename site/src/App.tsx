import { IconArrowRight, IconPlayerStopFilled, IconVolume, IconVolumeOff, IconWaveSine } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { possessive } from "./card";
import { themeVars, useCharacters, type Character } from "./characters";
import { CardDrawer } from "./components/CardDrawer";
import { AMBIENT_VOLUME, LoopVideo } from "./components/LoopVideo";
import { Switcher } from "./components/Switcher";
import { GUIDE_SECTIONS, HowItWorks } from "./components/HowItWorks";
import { TopNav } from "./components/TopNav";
import { useThemeMusic } from "./useThemeMusic";
import { inLang, LANGS, ui, type Lang } from "./i18n";
import { useVoice } from "./useVoice";

const AUTO_ADVANCE_MS = 30_000;

/** Hash routes: "#how-it-works" (and its section anchors, e.g. "#install") is the guide; anything else the cast. */
function useRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, "");
  const [hash, setHash] = useState(read);
  useEffect(() => {
    const on = () => setHash(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export default function App() {
  const list = useCharacters();
  const hash = useRoute();
  if (!list) return <div className="h-full bg-black" />;
  const section = GUIDE_SECTIONS.find((s) => s === hash);
  if (hash === "how-it-works" || section) {
    // The guide's pictures are Teo's; its colours stay Marta's, like the design.
    const teo = list.find((c) => c.slug === "teo-halloran") ?? list[0];
    const marta = list.find((c) => c.slug === "marta-vell") ?? list[0];
    return <HowItWorks c={{ ...teo, theme: marta.theme }} focus={section} />;
  }
  return <Showcase list={list} />;
}

function Showcase({ list }: { list: Character[] }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const c = list[index];
  // The visitor's language, remembered between visits; English is the original.
  const [lang, setLang] = useState<Lang>(() => LANGS.find((l) => l === localStorage.getItem("lang")) ?? "en");
  useEffect(() => localStorage.setItem("lang", lang), [lang]);
  const view = inLang(c, lang);
  const t = ui(lang);
  const music = useThemeMusic(c.files.theme);
  const { duck } = music;
  const onSpeaking = useCallback((speaking: boolean) => duck(speaking ? c.acoustics.musicDuck : 1), [duck, c.acoustics.musicDuck]);
  const voice = useVoice(view.voice, c.acoustics, onSpeaking);
  // Backdrops on screen: the outgoing one stays underneath until the incoming one has finished its reveal.
  const [layers, setLayers] = useState<number[]>([0]);
  const select = useCallback((i: number) => {
    setLayers((l) => (l[l.length - 1] === i ? l : [l[l.length - 1], i]));
    setIndex(i);
    setProgress(0);
  }, []);

  // Auto-advance through the cast while nobody is reading a card or listening to the voice; a pause resumes where it
  // stopped instead of starting over.
  const progressRef = useRef(0);
  progressRef.current = progress;
  useEffect(() => {
    if (list.length < 2 || open || voice.speaking) return;
    const start = performance.now() - progressRef.current * AUTO_ADVANCE_MS;
    const t = window.setInterval(() => {
      const p = (performance.now() - start) / AUTO_ADVANCE_MS;
      if (p >= 1) select((index + 1) % list.length);
      else setProgress(p);
    }, 100);
    return () => window.clearInterval(t);
  }, [index, open, voice.speaking, list.length, select]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (!open && list.length > 1 && e.key === "ArrowRight") select((index + 1) % list.length);
      if (!open && list.length > 1 && e.key === "ArrowLeft") select((index - 1 + list.length) % list.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, list.length, select]);

  const { meta } = view.card;
  const [first, ...rest] = meta.name.split(" ");
  const his = possessive(c.card);

  return (
    <main style={themeVars(c.theme)} className="relative h-full min-h-[640px] overflow-hidden bg-deep font-sans text-fg">
      {layers.map((i, n) => (
        <Backdrop key={list[i].slug} c={list[i]} sound={music.audible && i === index} entering={n === layers.length - 1 && layers.length > 1} onEntered={() => setLayers([i])} />
      ))}
      {layers.length > 1 && <div key={`seam-${c.slug}`} className="forge-seam" />}
      <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(to_right,var(--color-shade)_0%,var(--color-shade)_18%,transparent_50%)] sm:block" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[180px] bg-gradient-to-t from-black/55 to-transparent sm:block" />
      {/* Phones: the text sits over the lower half of the scene, so the shade rises from the bottom instead of the left. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-deep via-deep/85 to-transparent sm:hidden" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[110px] bg-gradient-to-b from-black/40 to-transparent" />

      <CardDrawer c={c} lang={lang} open={open} active={active} onActive={setActive} onClose={() => setOpen(false)} />

      <div className="pointer-events-none relative z-20 flex h-full flex-col justify-between px-5 pt-4 pb-3 sm:pt-7 sm:pr-10 sm:pb-8 sm:pl-12">
        <div className="pointer-events-auto">
          <TopNav page="characters" lang={lang} onLang={setLang} />
        </div>

        <section key={c.slug} className={`rise-in mt-auto mb-5 flex min-h-0 max-w-[660px] shrink flex-col justify-end gap-3 sm:mb-12 sm:gap-5.5 transition-opacity duration-300 ${open ? "opacity-0" : "pointer-events-auto"}`}>
          <div className="kicker flex items-center gap-2.5 text-[9px] text-dim sm:gap-3.5 sm:text-[11px]">
            <span className="font-bold text-accent">{String(index + 1).padStart(2, "0")}</span>
            <span className="h-px w-4 bg-dim sm:w-7" />
            {view.kicker}
          </div>
          <h1 className="font-display text-[clamp(52px,min(16vw,9vh),68px)] sm:text-[clamp(56px,min(10vw,14vh),140px)] leading-[0.86] font-medium tracking-[-0.035em] text-fg">
            {first}
            <br />
            {rest.join(" ")}
          </h1>
          <p className="max-w-[540px] font-display text-[20px] leading-tight text-accent italic sm:text-[clamp(22px,2.4vw,32px)]">{meta.tagline}</p>
          <p className="max-w-[540px] text-[14px] leading-relaxed text-dim sm:text-[17px]">{view.blurb}</p>
          <div className="flex items-center gap-2 pt-1 sm:flex-wrap sm:gap-3">
            <button
              onClick={() => {
                setActive(0);
                setOpen(true);
              }}
              className="flex flex-1 items-center justify-center gap-2.5 rounded-full bg-fg px-5.5 py-3.5 text-sm font-semibold text-deep sm:flex-none"
            >
              {t.openCard(his)} <IconArrowRight size={16} stroke={2} />
            </button>
            {view.voice && (
            <button onClick={voice.toggle} aria-label={voice.speaking ? t.stop : t.hearVoice(his)} className="flex size-[46px] shrink-0 items-center justify-center gap-2.5 rounded-full border border-line bg-white/5 text-sm font-medium text-fg backdrop-blur-md sm:size-auto sm:px-5.5 sm:py-3.5">
              {voice.speaking ? <IconPlayerStopFilled size={14} /> : <IconWaveSine size={16} stroke={1.75} />}
              <span className="hidden sm:inline">{voice.speaking ? t.stop : t.hearVoice(his)}</span>
            </button>
            )}
            <button data-music-toggle aria-label={music.on ? t.soundOff : t.soundOn} onClick={music.toggle} className="grid size-[46px] shrink-0 place-items-center rounded-full border border-line bg-white/5 text-fg backdrop-blur-md">
              {music.on ? <IconVolume size={16} stroke={1.75} /> : <IconVolumeOff size={16} stroke={1.75} />}
            </button>
          </div>
        </section>

        <footer className={`flex shrink-0 flex-col gap-2 border-t border-line pt-3.5 transition-opacity duration-300 sm:pt-6 ${open ? "opacity-0" : "pointer-events-auto"}`}>
          <Switcher list={list} lang={lang} index={index} progress={progress} onSelect={select} />
          <p className="text-center text-[9px] text-dim/70 sm:text-[11px]">{t.disclaimer}</p>
        </footer>
      </div>
    </main>
  );
}


/** One character's living backdrop: the idle loop, or the concept's front view when there is no scene yet. */
function Backdrop({ c, sound, entering, onEntered }: { c: Character; sound: boolean; entering: boolean; onEntered: () => void }) {
  // The clip's own sound follows the page's sound toggle (browsers allow it once the visitor has interacted) and fades.
  return (
    <div
      className={`absolute inset-0 ${entering ? "forge-in" : ""}`}
      onAnimationEnd={(e) => entering && e.animationName === "forge-reveal" && onEntered()}
    >
      {c.files.video || c.files.scene ? (
        <LoopVideo src={c.files.video} poster={c.files.scene} focus={c.focus} volume={sound ? AMBIENT_VOLUME : 0} />
      ) : (
        // No scene yet: the front view of the concept sheet stands in, full height on the right.
        <div className="absolute inset-0 bg-deep">
          <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
            <img src={c.files.concept} alt="" className="absolute top-0 left-1/2 h-full max-w-none -translate-x-[29%] opacity-90" />
            <div className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-deep to-transparent" />
          </div>
        </div>
      )}
    </div>
  );
}
