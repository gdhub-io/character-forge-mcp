import { IconArrowRight, IconPlayerStopFilled, IconVolume, IconVolumeOff, IconWaveSine } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { possessive } from "./card";
import { themeVars, useCharacters, type Character } from "./characters";
import { CardDrawer } from "./components/CardDrawer";
import { AMBIENT_VOLUME, LoopVideo } from "./components/LoopVideo";
import { Switcher } from "./components/Switcher";
import { TopNav } from "./components/TopNav";
import { useThemeMusic } from "./useThemeMusic";
import { inLang, ui, type Lang } from "./i18n";
import { useVoice } from "./useVoice";

const AUTO_ADVANCE_MS = 30_000;

export default function App() {
  const list = useCharacters();
  if (!list) return <div className="h-full bg-black" />;
  return <Showcase list={list} />;
}

function Showcase({ list }: { list: Character[] }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const c = list[index];
  // The visitor's language, remembered between visits; English is the original.
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("lang") === "ru" ? "ru" : "en"));
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
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-shade)_0%,var(--color-shade)_18%,transparent_50%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[180px] bg-gradient-to-t from-black/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[110px] bg-gradient-to-b from-black/40 to-transparent" />

      <CardDrawer c={c} lang={lang} open={open} active={active} onActive={setActive} onClose={() => setOpen(false)} />

      <div className="pointer-events-none relative z-20 flex h-full flex-col justify-between px-6 pt-7 pb-8 sm:pr-10 sm:pl-12">
        <div className="pointer-events-auto">
          <TopNav lang={lang} onLang={setLang} />
        </div>

        <section key={c.slug} className={`rise-in mt-auto mb-12 flex min-h-0 max-w-[660px] shrink flex-col justify-end gap-5.5 transition-opacity duration-300 ${open ? "opacity-0" : "pointer-events-auto"}`}>
          <div className="kicker flex items-center gap-3.5 text-dim">
            <span className="font-bold text-accent">{String(index + 1).padStart(2, "0")}</span>
            <span className="h-px w-7 bg-dim" />
            {t.medium[meta.medium] ?? meta.medium} · {t.genre[meta.genre] ?? meta.genre} · {view.kicker}
          </div>
          <h1 className="font-display text-[clamp(56px,min(10vw,14vh),140px)] leading-[0.86] font-medium tracking-[-0.035em] text-fg">
            {first}
            <br />
            {rest.join(" ")}
          </h1>
          <p className="max-w-[540px] font-display text-[clamp(22px,2.4vw,32px)] leading-tight text-accent italic">{meta.tagline}</p>
          <p className="max-w-[540px] text-[17px] leading-relaxed text-dim">{view.blurb}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => {
                setActive(0);
                setOpen(true);
              }}
              className="flex items-center gap-2.5 rounded-full bg-fg px-5.5 py-3.5 text-sm font-semibold text-deep"
            >
              {t.openCard(his)} <IconArrowRight size={16} stroke={2} />
            </button>
            {view.voice && (
            <button onClick={voice.toggle} className="flex items-center gap-2.5 rounded-full border border-line bg-white/5 px-5.5 py-3.5 text-sm font-medium text-fg backdrop-blur-md">
              {voice.speaking ? <IconPlayerStopFilled size={14} /> : <IconWaveSine size={16} stroke={1.75} />}
              {voice.speaking ? t.stop : t.hearVoice(his)}
            </button>
            )}
            <button data-music-toggle aria-label={music.on ? t.soundOff : t.soundOn} onClick={music.toggle} className="grid size-[46px] place-items-center rounded-full border border-line bg-white/5 text-fg backdrop-blur-md">
              {music.on ? <IconVolume size={16} stroke={1.75} /> : <IconVolumeOff size={16} stroke={1.75} />}
            </button>
          </div>
        </section>

        <footer className={`flex shrink-0 items-end border-t border-line pt-6 transition-opacity duration-300 ${open ? "opacity-0" : "pointer-events-auto"}`}>
          <Switcher list={list} lang={lang} index={index} progress={progress} onSelect={select} />
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
