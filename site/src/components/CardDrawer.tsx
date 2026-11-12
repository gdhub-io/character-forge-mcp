import { IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useRef } from "react";
import { sections } from "../card";
import { avatarStyle, type Character } from "../characters";
import { Blocks } from "./Blocks";
import { inLang, localizeSections, ui, type Lang } from "../i18n";

export function CardDrawer(props: { c: Character; lang: Lang; open: boolean; active: number; onActive: (i: number) => void; onClose: () => void }) {
  const { c, lang, open, active, onActive, onClose } = props;
  const card = inLang(c, lang).card;
  const t = ui(lang);
  const list = useMemo(() => localizeSections(sections(card, c.files.concept), lang), [c, card, lang]);
  const s = list[active] ?? list[0];
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [active, c]);

  return (
    <aside
      aria-hidden={!open}
      className={`absolute top-16 bottom-0 left-0 z-10 flex w-full max-w-[740px] flex-col gap-4 border-r border-line bg-glass px-5 pt-5 pb-5 backdrop-blur-[40px] sm:top-[94px] sm:gap-6 sm:pt-7 sm:pr-10 sm:pb-7 transition-transform duration-500 ease-out sm:pl-12 ${open ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <span className="size-12 rounded-[3px] bg-no-repeat" style={avatarStyle(c)} />
          <span className="flex flex-col gap-0.5">
            <span className="font-display text-[22px] leading-tight text-fg sm:text-[26px]">{card.meta.name}</span>
            <span className="kicker text-[10px] text-dim">{t.medium[card.meta.medium] ?? card.meta.medium}</span>
          </span>
        </div>
        <button aria-label={t.close} onClick={onClose} className="grid size-10 place-items-center rounded-full border border-line text-fg">
          <IconX size={16} stroke={1.75} />
        </button>
      </div>

      {/* Phones: the section list becomes a row of tabs above the content. */}
      <nav className="-mx-5 flex shrink-0 gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:hidden">
        {list.map((x, i) => (
          <button
            key={x.n}
            onClick={() => onActive(i)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] ${i === active ? "border-accent bg-white/7 font-semibold text-fg" : "border-line text-dim"}`}
          >
            {x.nav}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1 gap-9">
        <nav className="hidden w-[150px] shrink-0 flex-col gap-0.5 pt-1 sm:flex">
          {list.map((x, i) => (
            <button
              key={x.n}
              onClick={() => onActive(i)}
              className={`relative flex items-center gap-2.5 rounded-[3px] px-2.5 py-[7px] text-left text-[13px] ${i === active ? "bg-white/7 font-semibold text-fg" : "text-dim hover:text-fg"}`}
            >
              {i === active && <span className="absolute top-2 left-0 h-4 w-0.5 bg-accent" />}
              <span className={`kicker text-[9px] ${i === active ? "text-accent" : "text-dim"}`}>{x.n}</span>
              {x.nav}
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={scroller} className="thin-scroll -mr-4 flex-1 overflow-y-auto pr-4">
            <div className="flex flex-col gap-2 pb-6">
              <span className="kicker text-accent">{s.kicker}</span>
              {s.title && <h2 className="font-display text-[26px] leading-[1.05] tracking-tight text-fg sm:text-[32px]">{s.title}</h2>}
            </div>
            <Blocks blocks={s.blocks} downloadLabel={t.download} />
          </div>
        </div>
      </div>
    </aside>
  );
}
