---
name: translate-character
description: Translate a saved character-forge character into another language (Russian for now) — the whole card, written as the character's editor would write it in that language, and the voice monologue spoken in the same voice. English stays the original. Use when the user asks to translate a character, add a language, or make a Russian version.
---

# Translate a character

English is always the source. A translation is an extra layer next to it: `card.<lang>.json` and `assets/voice/reference.<lang>.mp3`. Requires the `character-forge` MCP server.

## 1. Card — free
1. `character_get` the character and read the whole card.
2. Translate every free-text field into the target language. Write it as the editor would in that language: plain, clear narration a stranger understands on first read, in a voice tuned to the character, not a word-for-word copy. The character's own lines (pet words, sample lines, inner monologue, what others say) keep their manner: slang stays slang, a stammer stays a stammer, broken grammar stays broken.
3. Keep exactly: the structure and every list's length, numbers, `#colours`, lowercase ids and enums (`film`, `left_shoulder`, `knock`…), names of people and places unless the language has a settled form.
4. `character_translate` with `id`, `lang` and the translated card. It rejects any change to the structure or fixed values; fix and resend.
   - The card is long: in Claude Code, hand the translation to a subagent with the card path and these rules, have it write the JSON to a file, then save it with `character_translate` (or the CLI: `character-forge translate <id> <file> --lang ru`).

## 2. Voice — paid, ask first
Only if the character already has a voice (`assets/voice/voice.json`).
1. Read `prompts/voice.md` ("Sample script"). Translate the monologue for the same moment the scene shows: same place, same mood, same length and pauses, in the character's own way of speaking.
2. Tell the user the price (about the same as the original line: ElevenLabs ≈ $0.10 per 1000 characters, Qwen for minors ≈ $0.03) and wait for a yes.
3. `character_voice_translation` with `id`, `lang` and the translated monologue → `assets/voice/reference.<lang>.mp3`, the same voice.
   - New voices: `character_voice` takes `text_ru` and records both languages in one call.

## 3. Website — if the character is on the site
Add the translated `kicker` and `blurb` under `i18n.<lang>` in `site/src/showcase.json` (blurb ≤ 160 characters, written to fit, never cut), then `npm run sync` in `site/`.

## 4. Report (in the user's language)
What was translated, the voice file, the cost, and anything that couldn't be translated faithfully.
