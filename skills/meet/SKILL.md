---
name: meet
description: Experimental. Put 2-5 saved character-forge characters into one situation as strangers, each with a reason to be there, and watch where they end up between a fight and love. Each round every character thinks (feelings toward each other, what they want to say, hide or ask), then speaks, acts or stays silent; sudden twists can be planned or thrown in live. Use when the user asks characters to meet, talk, or be put together in a scene.
---

# Characters meet (experimental)

Arguments: character ids (2–5), a situation, and optionally a task per character and twists, e.g.
`/meet marta-vell pike-ostrander — stuck in a lift at night, the light goes out. Marta: she must reach the roof before the storm. At round 3 the cable snaps.`

1. If ids are missing or unknown, call `character_list` and ask which ones. Translate the situation, tasks and twists into English, keeping every detail the user gave.
2. Call `character_meet` with the ids, the situation, the user's tasks and planned twists (`events`, each with its round). It returns the director's protocol: follow it exactly. It covers the tasks you still have to write, the `character-player` subagents, twists asked for mid-scene (`character_meet_event`) and the retelling at the end.
