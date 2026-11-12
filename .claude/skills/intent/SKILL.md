---
name: intent
description: Start a piece of work by writing its intent — what is wanted, why, what must not move, and when it is done — into a GitHub issue, then open the branch linked to it. Use when picking up an issue, when asked to plan a change before building it, or when an issue's intent needs checking against what the work has become.
---

# Write the intent before the work

The issue is where a change's intent lives: it is public, contributors and agents read it, and the pull request closes it. An intent written there before any code is what the diff is judged against.

Argument: an issue number (`#14`), or a description of the work — then find or open the issue.

## 1. Find the issue, or open one

- With a number: `gh issue view N --comments`. Expect it to be thin; that is normal, not a reason to stop.
- Without one: `gh issue list --search "<words>" --state all` — half of the work has been discussed before. Use an open issue that fits; mention a closed one if it is related.
- Also look for what exists: grep the README, CLAUDE.md, `docs/` and the code for the feature's name.

## 2. Interview, briefly

Ask at most three questions, only ones whose answers change the work, with `AskUserQuestion` so they are cheap to answer. The ones that usually matter:

- **Who is it for, and what do they do today instead?** That is the whole "why".
- **What must not move?** Card fields other tools read, the tool API clients rely on, paid calls without consent, English-only product text.
- **Where does it stop?** The neighbouring thing it deliberately does not touch.

Decide everything else yourself and write down what you decided. A question the repository can answer is not asked.

## 3. Write the intent into the issue

Use this shape and keep it to a screen. Create the issue with it (`gh issue create --title … --label enhancement|bug|documentation --body …`) or replace a thin body (`gh issue edit N --body …`). Writing to GitHub is outward-facing: ask the user before the first write in a task.

```markdown
## Want
One paragraph, in terms of what changes for the person using character-forge (a writer in their chat, a contributor), not components.

## Why now
The pain this removes, concretely. If nothing hurts, the work can wait.

## Constraints
What must not move, and what must be reused rather than rebuilt.

## Done when
- [ ] Checkable statements, each true or false by using the tool, the CLI or the site.

## How to check it
Steps anyone can follow to see each "Done when" working: what to ask in the chat, which CLI command to run and what it prints, which page of the site to open. Paid steps: say so and give the cheapest way to check.

## Out of scope
The neighbouring work this deliberately does not do.

## Open questions
Each with the answer assumed for now, so the work is never blocked on one.
```

Rules that matter more than the shape:
- **Done when** items become the acceptance checks and, where they can be, the tests. Three real ones beat ten written to look thorough.
- **Out of scope** is not optional: it stops an agent from rebuilding the feature next door.
- Don't restate the stack or conventions; they are in CLAUDE.md.

## 4. Open the branch, linked to the issue

```
git switch main && git pull --ff-only
gh issue develop N --base main --name <type>/N-short-name --checkout
```

Type: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. The branch shows in the issue's Development panel, and the pull request will close the issue (`Closes #N`).

## 5. Hand off

Continue with the `contribute` skill from "Develop". Say what comes next and why: a card field → the checklist in CLAUDE.md; site UI → design in Pencil (`design/character-forge.pen`) first, then code; a new media step → `models.json` pricing and `character_next`.

## When the work is done or drifts

When the pull request is ready, comment on the issue what was decided along the way and what was deliberately **not** done (a test not written, a case not handled) — a ticked checklist without comment tells the maintainer nothing. If the work has drifted from the intent, report the drift in a sentence or two and edit the issue body: a stale intent is worse than none.

## Do not

- Do not write a full intent for a typo, a copy change or a one-file bug: open a short issue (what and why, one line each) and do the work. Every change still has an issue.
- Do not invent acceptance criteria to fill the section.
- Do not let the intent grow into a spec. When it passes a screen, the rest belongs in `docs/<feature>.md`.
