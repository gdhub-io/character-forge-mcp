---
name: meet
description: Experimental. Put 2-5 saved character-forge characters into one situation as strangers, each with a reason to be there, and watch where they end up between a fight and love. Each round every character thinks (feelings toward each other, what they want to say, hide or ask), then speaks, acts or stays silent; sudden twists can be planned or thrown in live. Use when the user asks characters to meet, talk, or be put together in a scene.
---

# Characters meet (experimental)

Arguments: character ids (2–5), a situation, and optionally a task per character and twists, e.g.
`/meet marta-vell pike-ostrander — stuck in a lift at night, the light goes out. Marta: she must reach the roof before the storm. At round 3 the cable snaps.`

1. If ids are missing or unknown, call `character_list` and ask which ones. Translate the situation, tasks and twists into English, keeping every detail the user gave.
2. Give every character a task: why they are here right now and what they need. Keep the user's; write the missing ones from the character's card (`goals.want`) to fit the situation, one line each, and tell the user which ones you wrote.
3. Call `character_meet` with the ids, the situation, the tasks and any planned twists (`events`, each with its round). It returns the director's protocol: follow it exactly.
4. Each character is one `character-player` subagent: spawn it on the character's first turn with the packet only, and continue the same agent with the next packet (SendMessage) on later turns. Never put anything into a packet yourself, and never show one character another's thoughts or task.
5. If the user asks for a twist while the scene runs, call `character_meet_event` and hand the packet it returns to the next speaker.
6. When the scene ends, follow the protocol's last step: scene.md, then a short, plain retelling in the user's language.
