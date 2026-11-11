---
name: forge-character
description: Create a strong, coherent character (film, game, ad, book) with the character-forge MCP. Runs a variant tournament — 3 variants of the same concept, independent coherence reviewers and critics argue against each, the author defends once, a judge picks the strongest, which gets a T-pose concept. Use when the user asks for a character, hero, NPC, mascot, protagonist or villain, random or from a brief.
---

# Forge a character (variant tournament)

You are the AUTHOR. Independent agents review your work; they have fresh context and owe you nothing.
Requires the `character-forge` MCP server (tools named `character_*`).

## 0. Setup
- Call `character_method` once (method + protocol).
- Decide the mode:
  - **Random**: the user gave little or nothing. Anchor = the role they named, if any.
  - **Brief**: the user described what matters. Every variant must keep ALL of it. Anchor = the role from the brief; fix medium/genre/setting from the brief.
  - **Quick**: only if the user explicitly asks for one fast character — `variants: 1`, skip steps 3–7, but still run `character_check` and the designer.

## 1. Roll
`character_roll` with `variants: 3` (+ `anchor`, `medium`, `genre`, `setting` when known).
All variants share the anchor and world but have different cores — "all fishermen, but different fishermen".

## 2. Write
Write 3 full cards and give each a full, honest effort (a tournament with a straw man is useless).
Each card: `meta.group` = the roll seed, `meta.variant` = A/B/C, `meta.seed` = variant seed, `meta.mode`, `meta.brief` if any.
Save each with `character_save`; note each id and its `card.json` path.

## 3. Coherence review — 3 agents in parallel
Spawn the `character-coherence` agent once per variant, all in one message (never more than 4 at once).
Prompt: the card.json path, the variant letter and the brief/anchor. Nothing else — do not tell them what you think of the card.
Fix every BROKEN link they report; re-save with `overwrite: true`.

## 4. Prosecution — 3 agents in parallel
Spawn the `character-critic` agent once per variant (same rules: path + brief/anchor only).

## 5. Defense — you
Call `character_role` with `role: "author"` and follow it: for each critique, fix the card (re-save with overwrite) or rebut in one line with a quote. One round only. Keep the rebuttals.

## 6. Judgment — 1 agent
Spawn the `character-judge` agent with the 3 card.json paths, the brief/anchor, all critics' cases and your rebuttals.
Optionally fold the judge's "steal" idea into the winner and re-save.

## 7. Record
Write `meta.verdict` (`winner` / `runner-up` / `rejected`, score, summary) into every variant and re-save with overwrite.

## 8. Look & concept — winner only
Spawn the `character-designer` agent with the winner's card.json path. Merge its `look` (and any `description.physical` changes), re-save with overwrite.
Call `character_concept` for the WINNER only.

## 9. Report to the user (in their language)
- Winner: name, logline, why it won (2–3 sentences), signature item, path to card.html (and concept.png).
- One line per losing variant: who they were and their fatal flaw.
- Keep it short; the card itself is in the files.
