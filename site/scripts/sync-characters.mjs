// Copies the showcased characters from the character-forge library into public/, so the site serves them statically.
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const library = path.resolve(here, "../../characters");
const out = path.resolve(here, "../public/characters");
const showcase = JSON.parse(await readFile(path.resolve(here, "../src/showcase.json"), "utf8"));
const FILES = ["card.json", "assets/idle.mp4", "assets/scene.png", "assets/concept.png", "assets/theme.mp3", "assets/voice/reference.mp3"];
// Translations are optional: copied when present, no warning when not.
const OPTIONAL = ["card.ru.json", "assets/voice/reference.ru.mp3"];
const SITE_NAME = { "assets/voice/reference.mp3": "voice.mp3", "assets/voice/reference.ru.mp3": "voice.ru.mp3" };

// The hero block sits on a fixed bottom row; longer text would push it around, so texts are written to fit, never cut.
const LIMITS = { blurb: 160, tagline: 40 };
const tooLong = [];

for (const { slug, blurb, i18n } of showcase) {
  for (const [lang, text] of [["en", blurb], ...Object.entries(i18n ?? {}).map(([l, t]) => [l, t.blurb])]) {
    if (text.length > LIMITS.blurb) tooLong.push(`${slug}: ${lang} blurb is ${text.length} characters (max ${LIMITS.blurb}) — rewrite it shorter in showcase.json`);
  }
  await mkdir(path.join(out, slug), { recursive: true });
  for (const f of OPTIONAL) {
    const src = path.join(library, slug, f);
    if (existsSync(src)) await copyFile(src, path.join(out, slug, SITE_NAME[f] ?? path.basename(f)));
  }
  for (const f of FILES) {
    const src = path.join(library, slug, f);
    if (!existsSync(src)) {
      console.warn(`  ${slug}: no ${f}`);
      continue;
    }
    await copyFile(src, path.join(out, slug, SITE_NAME[f] ?? path.basename(f)));
  }
  console.log(`synced ${slug}`);
}

for (const { slug } of showcase) {
  const card = JSON.parse(await readFile(path.join(out, slug, "card.json"), "utf8").catch(() => "{}"));
  const tagline = card.meta?.tagline ?? "";
  if (tagline.length > LIMITS.tagline) tooLong.push(`${slug}: tagline is ${tagline.length} characters (max ${LIMITS.tagline}) — shorten meta.tagline in the card`);
  const ru = JSON.parse(await readFile(path.join(out, slug, "card.ru.json"), "utf8").catch(() => "{}"));
  const ruTagline = ru.meta?.tagline ?? "";
  if (ruTagline.length > LIMITS.tagline) tooLong.push(`${slug}: ru tagline is ${ruTagline.length} characters (max ${LIMITS.tagline}) — shorten meta.tagline in card.ru.json`);
}
if (tooLong.length) {
  console.error(`\nText too long for the hero block:\n${tooLong.map((l) => `  - ${l}`).join("\n")}`);
  process.exit(1);
}
