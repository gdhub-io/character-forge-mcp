import { useEffect, useState } from "react";
import type { Card } from "./card";
import showcase from "./showcase.json";

export interface Theme {
  accent: string;
  accentInk: string;
  deep: string;
  shade: string;
  text: string;
}

/** How the place colours the character's voice: a small room reverb, a softened top end, and how far the music ducks. */
export interface Acoustics {
  reverbSeconds: number;
  wet: number;
  lowpassHz: number;
  musicDuck: number;
}

export interface Character {
  slug: string;
  kicker: string;
  /** Translated site texts per language (see i18n.ts). */
  i18n?: Partial<Record<"ru", { kicker: string; blurb: string }>>;
  /** card.ru.json, when the character has been translated. */
  cardRu?: Card;
  blurb: string;
  focus: string;
  avatar: { x: number; y: number; w: number };
  theme: Theme;
  acoustics: Acoustics;
  card: Card;
  /** Optional media is missing until it has been generated; the page adapts. */
  files: { concept: string; scene?: string; video?: string; theme?: string; voice?: string; voiceRu?: string };
}

const base = (slug: string) => `${import.meta.env.BASE_URL}characters/${slug}`;

/**
 * A static file exists (the dev server answers missing files with index.html, hence the content-type check).
 * Returns its URL tagged with the file's version, so a regenerated asset (same name) isn't served from the cache.
 */
async function exists(url: string): Promise<string | undefined> {
  const r = await fetch(url, { method: "HEAD", cache: "no-store" }).catch(() => null);
  if (!r?.ok || r.headers.get("content-type")?.includes("text/html")) return undefined;
  const v = r.headers.get("etag") ?? r.headers.get("last-modified");
  return v ? `${url}?v=${encodeURIComponent(v.replace(/[W/"]/g, ""))}` : url;
}

/** Loads every showcased character's card.json; files are synced into public/ by scripts/sync-characters.mjs. */
export function useCharacters(): Character[] | null {
  const [list, setList] = useState<Character[] | null>(null);
  useEffect(() => {
    Promise.all(
      showcase.map(async (s) => {
        const dir = base(s.slug);
        const card = (await (await fetch(`${dir}/card.json`, { cache: "no-store" })).json()) as Card;
        const [concept, scene, video, theme, voice, voiceRu, cardRu] = await Promise.all([
          ...["concept.png", "scene.png", "idle.mp4", "theme.mp3", "voice.mp3", "voice.ru.mp3"].map((f) => exists(`${dir}/${f}`)),
          // One GET; a missing file comes back as the dev server's index.html, which isn't JSON.
          fetch(`${dir}/card.ru.json`, { cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<Card>) : undefined)).catch(() => undefined),
        ]);
        return { ...s, card, cardRu: cardRu as Card | undefined, files: { concept: (concept as string | undefined) ?? `${dir}/concept.png`, scene: scene as string | undefined, video: video as string | undefined, theme: theme as string | undefined, voice: voice as string | undefined, voiceRu: voiceRu as string | undefined } };
      }),
    ).then(setList);
  }, []);
  return list;
}

/** Background style that crops a face out of the concept sheet (crop box in fractions of the image width/height). */
export function avatarStyle(c: Character, imageAspect = 1.5): React.CSSProperties {
  const { x, y, w } = c.avatar;
  const h = w * imageAspect;
  return {
    backgroundImage: `url(${c.files.concept})`,
    backgroundSize: `${100 / w}% auto`,
    backgroundPosition: `${(x / (1 - w)) * 100}% ${(y / (1 - h)) * 100}%`,
  };
}

export function themeVars(t: Theme): React.CSSProperties {
  return {
    "--c-accent": t.accent,
    "--c-accent-ink": t.accentInk,
    "--c-deep": t.deep,
    "--c-shade": t.shade,
    "--c-text": t.text,
  } as React.CSSProperties;
}
