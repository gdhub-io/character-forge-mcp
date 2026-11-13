---
name: concept-art
description: Generate concept art for a saved character-forge character on fal.ai — a front/back A-pose model sheet posed by a figure built on the character's own proportions, or the character in the pose of any picture the user gives. Checks every result against the card's look and iterates. Use when the user asks for a concept, model sheet, turnaround or character pose image.
---

# Concept art via fal (A-pose model sheet)

Requires the `character-forge` MCP server and `FAL_KEY` (in the environment or in a `.env` in the working directory).
The tool draws an A-pose figure from the card's body (the DNA frame, as life events changed it, plus `look.body` posture) and gives it to the image model as the pose reference, with the card's full look. It costs **about $0.02 per sheet**, and each retry costs the same.

1. **Prepare.** Find the id (`character_list`). The card needs a `look` section; if it's weak or missing, suggest the `design-look` skill first.
2. **Show the prompt.** Call `character_concept` with `dry_run: true` and skim it. Fix anything in the card's look, not by hand in the prompt.
3. **Generate.**
   - **A-pose sheet** (default): call `character_concept` with `views: "front-back"` (or `"front"`). The result becomes `concept.png` in the card.
   - **Custom pose**: the user supplies a picture (path or URL) whose pose to copy. Call `character_concept` with `pose_image`. The pose is extracted from it, and the result is saved as `concept-pose.png`, next to the A-pose sheet rather than replacing it.
4. **Check the result** by reading the PNG. Compare it with the card's `look`: left/right asymmetry, marks on the correct side, signature item beside the figure, palette, silhouette, and an A-pose with the arms clear of the body.
5. **Iterate, at most 2 retries unless the user asks for more.**
   - If the details are wrong, add a short `extra` note, e.g. "scar behind the LEFT ear, hair covering it".
   - To vary the design, use a new `seed`. To keep the design and only tweak the prompt, reuse the returned `seed`.
6. **Report** to the user in their language: the image path, the seed, what matches the look, what doesn't, and the total spend so far.
