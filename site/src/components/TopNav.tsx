import { IconArrowUpRight, IconBrandGithub, IconHammer } from "@tabler/icons-react";

import { LANGS, ui, type Lang } from "../i18n";

export function TopNav({ lang, onLang }: { lang: Lang; onLang: (l: Lang) => void }) {
  const t = ui(lang);
  return (
    <header className="flex items-center justify-between">
      <a href="/" className="flex items-center gap-2.5 text-fg">
        <IconHammer size={20} stroke={1.75} />
        <span className="font-mono text-xs font-bold tracking-[0.14em]">CHARACTER FORGE</span>
      </a>
      <nav className="hidden items-center gap-9 md:flex">
        {t.nav.map((l, i) => (
          <a key={l} href="#" className="flex flex-col items-center gap-1.5 text-sm">
            <span className={i === 0 ? "font-semibold text-fg" : "text-dim transition-colors hover:text-fg"}>{l}</span>
            <span className={`h-0.5 w-4 ${i === 0 ? "bg-accent" : "bg-transparent"}`} />
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <div role="group" aria-label="Language" className="flex rounded-full border border-line p-0.5 text-[12px] font-semibold">
          {LANGS.map((l) => (
            <button key={l} onClick={() => onLang(l)} aria-pressed={l === lang} className={`rounded-full px-2.5 py-1.5 uppercase ${l === lang ? "bg-fg text-deep" : "text-dim hover:text-fg"}`}>
              {l}
            </button>
          ))}
        </div>
        <a href="#" className="hidden items-center gap-2 rounded-full border border-line px-3.5 py-2.5 text-[13px] text-fg sm:flex">
          <IconBrandGithub size={16} stroke={1.75} /> {t.star}
        </a>
        <a href="#" className="flex items-center gap-2 rounded-full bg-accent px-4.5 py-2.5 text-[13px] font-semibold text-accent-ink">
          {t.forge} <IconArrowUpRight size={14} stroke={2} />
        </a>
      </div>
    </header>
  );
}
