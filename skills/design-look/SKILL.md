---
name: design-look
description: Design or redesign the look of a saved character-forge character from its story — signature item, marks with origins, movement, silhouette, perfection vs. flaws, palette — then regenerate the T-pose concept. Use when the user asks to design, rework or improve a character's appearance, costume, attribute or concept art.
---

# Design a character's look from the story

Requires the `character-forge` MCP server (tools named `character_*`).

1. Find the character: `character_list`, then `character_get` with `format: "json"` for the chosen id. Note the card.json path, which is `<library>/<id>/card.json`.
2. Spawn the `character-designer` agent. Give it only the card.json path and anything the user asked for (style, medium constraints). Do not tell it what you think the look should be.
3. Merge its `look` JSON, and any `description.physical` changes, into the card. Save with `character_save` and `overwrite: true` (keep `meta.slug`).
4. Run `character_check` with the id. If the LOOK or RESTRAINT questions expose weak links, fix them and save again.
5. Call `character_concept` with the id (and the user's `style`/`views`, if given).
6. Report to the user in their language: the signature item, and the 3 things a stranger reads in 3 seconds. Include the paths to card.html and concept.png, or say the prompt was returned because no image key is set.
