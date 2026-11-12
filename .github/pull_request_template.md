Closes #

## What and why

<!-- What this changes and why. The line above links the issue and closes it on merge: put its number there. -->

## How to verify

<!-- The steps a reviewer (human or agent) follows to see it working: what to ask in the chat, the CLI command and its output, the site page. Plus the tests added or updated. -->

## Checklist

- [ ] The description starts with `Closes #<issue>`
- [ ] The title follows Conventional Commits (`feat: …`, `fix: …`, `docs: …`); `!` for a breaking change
- [ ] `npm run lint` and `npm test` pass
- [ ] Simplified before review: no dead code, no duplicated helpers
- [ ] Docs updated if behavior changed (README, CLAUDE.md, skills)
- [ ] No API keys, no paid API calls in tests, no files from `characters/`
