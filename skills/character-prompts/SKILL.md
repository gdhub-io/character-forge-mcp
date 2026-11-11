---
name: character-prompts
description: Write generation prompts for a saved character-forge character, only the kinds the user asks for — concept (T-pose sheet), illustration (a key-art scene from their story), voice (TTS voice design + audition script), video (Seedance-style clip), song (Suno style + lyrics), theme (instrumental leitmotif for a looping background, as an ElevenLabs Music composition plan). Prompts only; no generator is called. Use when the user asks for a prompt, a voice, a video, a song, background music / a theme or an illustration of a character.
---

# Generation prompts for a character (on request only)

Requires the `character-forge` MCP server (tools named `character_*`).

Make ONLY the kinds the user asked for. Never produce the whole set unprompted, and never add this step to creating a character.

1. Find the character id (`character_list` if unclear). If the user didn't say which kind, ask: concept, illustration, voice, video, song or theme.
2. For each requested kind:
   - Call `character_prompt` with `id` and `kind`. It returns that target's rules and the card material to use.
   - Write the prompt in English, following the rules exactly: limits, required sections, no artist or actor names. Use only facts from the card; the look must match the card's `look` section (marks with sides, signature item, palette).
   - Self-check against the rules, then call `character_prompt_save` with `id`, `kind` and the named `sections`.
3. Show the user the finished prompt text, ready to copy, plus the saved file path. Explain anything in the user's language; keep the prompt itself in English.

If the user asks for changes, rewrite and save again; the file for that kind is overwritten.
