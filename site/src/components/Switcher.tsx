import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { avatarStyle, type Character } from "../characters";
import { inLang, ui, type Lang } from "../i18n";

const pad = (n: number) => String(n).padStart(2, "0");

export function Switcher(props: { list: Character[]; lang: Lang; index: number; progress: number; onSelect: (i: number) => void }) {
  const { list, lang, index, progress, onSelect } = props;
  const t = ui(lang);
  const many = list.length > 1;
  const step = (d: number) => onSelect((index + d + list.length) % list.length);
  return (
    <div className="flex items-center gap-4">
      <div className="flex gap-2">
        <button aria-label={t.prev} disabled={!many} onClick={() => step(-1)} className="grid size-11 place-items-center rounded-full border border-line text-fg disabled:opacity-35">
          <IconArrowLeft size={16} stroke={1.75} />
        </button>
        <button aria-label={t.next} disabled={!many} onClick={() => step(1)} className="grid size-11 place-items-center rounded-full border border-line bg-fg text-deep disabled:opacity-35">
          <IconArrowRight size={16} stroke={1.75} />
        </button>
      </div>
      <div className="flex items-end gap-1 pr-3 pl-1">
        <span className="font-display text-[28px] leading-none text-fg">{pad(index + 1)}</span>
        <span className="kicker text-dim">/ {pad(list.length)}</span>
      </div>
      {list.map((c, i) =>
        i === index ? (
          <div key={c.slug} className="relative flex w-[220px] items-center gap-3 rounded border border-line bg-white/8 p-2.5 backdrop-blur-xl">
            {many && (
              <span className="absolute top-0 left-2.5 h-0.5 w-[200px] bg-line">
                <span className="block h-full bg-accent" style={{ width: `${progress * 100}%` }} />
              </span>
            )}
            <span className="size-13 shrink-0 rounded-[3px] bg-no-repeat" style={avatarStyle(c)} />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-sm font-semibold text-fg">{inLang(c, lang).card.meta.name}</span>
              <span className="kicker truncate text-[9px] text-dim">
                {inLang(c, lang).kicker}
              </span>
            </span>
          </div>
        ) : (
          <button key={c.slug} aria-label={inLang(c, lang).card.meta.name} onClick={() => onSelect(i)} className="rounded p-1.5 opacity-70 transition-opacity hover:opacity-100">
            <span className="block size-13 rounded-[3px] bg-no-repeat" style={avatarStyle(c)} />
          </button>
        ),
      )}
    </div>
  );
}

export function shortMedium(m: string): string {
  return ({ advertising: "Ad", game: "Game", film: "Film", book: "Book", animation: "Animation", comics: "Comics", tabletop: "Tabletop" } as Record<string, string>)[m] ?? m;
}
