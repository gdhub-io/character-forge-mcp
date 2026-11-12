---
name: contribute
description: Take a change to character-forge-mcp from intent to pull request — clarify the intent, branch, develop with tests, refactor (/simplify), review (/code-review), open a PR with a Conventional Commits title. Use when asked to implement, fix or change something in this repo, or to "make a PR".
---

# Contribute: intent → develop → refactor → review → pull request

Nobody pushes to `main`; it is protected. Every change goes through a pull request that is squash-merged, so the PR title becomes the commit Release Please reads for the next version. Follow the steps in order and tell the user, briefly, where you are.

## 1. Intent
- Restate in one or two sentences what changes and why. If an issue exists, read it (`gh issue view N`) and link it.
- One concern per PR. If the request mixes several, propose splitting it.
- If the goal or the approach is unclear, ask before writing code.

## 2. Branch
- Start from an up-to-date `main`: `git switch main && git pull --ff-only`.
- Branch name by type: `feat/…`, `fix/…`, `docs/…`, `refactor/…`, `test/…`, `chore/…` (short, kebab-case).
- If the working tree has unrelated changes, stop and ask what to do with them.

## 3. Develop
- Follow CLAUDE.md (architecture, the card-field checklist, English-only product text, `.js` import extensions).
- Add or update tests for the behavior you change. Tests never call paid APIs.
- Don't bump versions or edit CHANGELOG.md: Release Please does that.
- Commit in small steps with Conventional Commit messages.

## 4. Refactor
- Run the `simplify` skill on the branch's diff and apply what it finds (or note why a finding was skipped).

## 5. Review
- `npm run lint` and `npm test` must pass (one at a time; they are heavy for this machine).
- Run the `code-review` skill on the branch and fix confirmed findings.
- Re-read the full diff (`git diff main...HEAD`) as a stranger: no debug leftovers, no keys, nothing from `characters/`.

## 6. Pull request
- Ask the user before pushing and opening the PR (it is outward-facing).
- `git push -u origin <branch>`, then `gh pr create` with:
  - **Title** in Conventional Commits: `feat: …`, `fix: …`, `docs: …`; `!` for breaking (`feat!: …`). Imperative, under 70 characters.
  - **Body** from `.github/pull_request_template.md`: what and why (with `Closes #N`), how it was checked, the checklist.
- Report the PR link. Then wait for CI; if it fails, read the logs (`gh pr checks`, `gh run view --log-failed`) and fix on the same branch.

Merging is the maintainer's call: don't merge unless asked.
