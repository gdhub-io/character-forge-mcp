---
name: contribute
description: Take a change to character-forge-mcp from intent to pull request — an issue for the intent, a branch linked to it, develop with tests, refactor (/simplify), review (/code-review), and a PR that closes the issue on merge. Use when asked to implement, fix or change something in this repo, or to "make a PR".
---

# Contribute: issue → branch → develop → refactor → review → pull request

Nobody pushes to `main`; it is protected. Every change answers an issue, and its pull request closes that issue when it is squash-merged (the PR title becomes the commit Release Please reads). Follow the steps in order and tell the user, briefly, where you are. Creating issues, pushing and opening PRs are outward-facing: ask the user before the first one in a task.

## 1–2. Intent and branch
Run the `intent` skill: it finds or opens the issue, writes the intent into it (want, why, constraints, done when, how to check, out of scope), and opens a branch linked to the issue with `gh issue develop N`. A typo or one-file fix gets a short issue instead of a full intent, but always an issue.

If the working tree has unrelated changes, stop and ask what to do with them.

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

## 6. Pull request that closes the issue
- `git push -u origin <branch>`, then `gh pr create` with:
  - **Title** in Conventional Commits, typed by who the change is for (CONTRIBUTING.md, "Commit and PR titles"): `feat`/`fix`/`perf` only for changes users of the tool notice (they make a release); `docs`, `refactor`, `test`, `ci`, `build`, `chore` otherwise. `!` only when users must change something. Imperative, under 70 characters.
  - **Body** from `.github/pull_request_template.md`, starting with `Closes #N`. The "Linked issue" check fails without it, and on merge GitHub closes the issue. "How to verify" comes from the intent's "How to check it".
- Comment on the issue what was decided along the way and what was deliberately not done.
- Report the PR link. Then wait for CI; if it fails, read the logs (`gh pr checks`, `gh run view --log-failed`) and fix on the same branch.
- If the work turns out to need more, open follow-up issues instead of growing the PR.

Merging is the maintainer's call: don't merge unless asked.
