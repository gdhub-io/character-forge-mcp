# Contributing to character-forge-mcp

Thanks for helping. Bug reports, ideas, new core chains and code are all welcome.

## Ways to help

- **Report a bug or suggest an idea**: open an [issue](https://github.com/gdhub-io/character-forge-mcp/issues/new/choose).
- **Add a core chain**: the wounds in `src/engine.ts` are hand-curated so that every chain (wound → lie → fear → defense / gift → truth) holds by construction. A new, well-built chain is one of the best contributions.
- **Fix or build something**: comment on an issue first if the change is large, so we agree on the approach before you spend time on it.

## Set up

Requires Node.js 20+ (and `ffmpeg` only if you generate video or audio).

```bash
git clone https://github.com/gdhub-io/character-forge-mcp.git && cd character-forge-mcp
npm install
npm test          # builds, then runs unit tests and an end-to-end MCP client/server test
npm run lint      # Biome: lint + formatting
npm run format    # fix what Biome can fix
```

Inside the repo, Claude Code picks up the local server from `.mcp.json` and writes characters to `./characters` (gitignored). The architecture is described in [CLAUDE.md](CLAUDE.md).

**Tests never call paid APIs.** Keep it that way: anything that would reach fal.ai must be mocked or skipped. Never commit an API key; put `FAL_KEY` in a gitignored `.env`.

## Run your local build

- **Claude Code in this repo** picks up the local server from [`.mcp.json`](.mcp.json) (`node dist/index.js`) and saves characters to `./characters` (gitignored). The skills and agents in `skills/` and `agents/` are linked into `.claude/`, so they load too. Run `npm run build` after every change, then `/mcp` → reconnect. Don't install the plugin while working here, or everything loads twice.
- **Any other client**: point it at your build instead of npm:

  ```bash
  claude mcp add character-forge-dev -e CHARACTER_FORGE_DIR=~/character-forge -- node /abs/path/to/character-forge-mcp/dist/index.js
  ```

- **MCP Inspector**: `npm run inspect` opens the server in a browser to call tools by hand.

## The showcase site

`site/` is the website at [characters.gdhub.io](https://characters.gdhub.io) (Vite, React, Tailwind). Every push to `main` that touches `site/` builds it and publishes it on GitHub Pages.

```bash
cd site && npm install
npm run dev        # starts Vite on http://localhost:5173
```

The characters it shows are listed in `site/src/showcase.json`; their media live in `site/public/characters/` and are committed. `npm run dev` and `npm run build` refresh them from your local library (`../characters`) when it exists, and use the committed copies when it doesn't. `SITE_URL` (set in the Pages workflow) fills canonical links, the share image, the sitemap and `llms.txt`.

## Project layout

- `src/engine.ts`: curated core chains (wound → lie → fear → defense/gift → truth), occupations, visible marks. PRs that extend these are welcome.
- `src/methodology.ts`: the method as data (arc goals, flaws, fears, archetypes, trait lists…)
- `src/random.ts`: seeded rolls and variant sets
- `src/schema.ts`: the card schema (zod); `src/render.ts`: Markdown card rendering; `src/check.ts`: coherence red flags and questions
- `src/tournament.ts`: rubric and role instructions (coherence, critic, judge, author, designer, editor)
- `src/media.ts`: rules and card material for generation prompts
- `src/concept.ts`, `src/pose.ts`: the concept pipeline and the A-pose figure; `src/scene.ts`: location and video; `src/voice.ts`; `src/theme.ts`
- `src/fal.ts`, `src/ffmpeg.ts`, `src/config.ts` (models.json), `src/costs.ts` (the ledger), `src/next.ts` (next steps)
- `src/store.ts`: the character library on disk
- `src/tools/`: one file per MCP tool; `src/prompts/`: MCP prompts; `src/server.ts`; `src/index.ts`: CLI and stdio entry
- `skills/` and `agents/`: the plugin's skills and reviewer agents; `.claude-plugin/`: the plugin manifest
- `site/`: the showcase website; `design/`: its Pencil design
- `examples/`: complete reference cards; `docs/character-anatomy.md`: diagrams of the method

The full list of tools, the CLI and the media options are in [docs/reference.md](docs/reference.md).

## The workflow: issue → branch → develop → refactor → review → pull request

Nobody pushes to `main`. Every change, including the maintainers', answers an issue and goes through a pull request that closes it.

1. **Issue with the intent.** Find the issue for what you want to change, or [open one](https://github.com/gdhub-io/character-forge-mcp/issues/new/choose). For anything bigger than a small fix, it states the intent: what you want and why, what must not change, when it is done, how to check it, and what is out of scope. One concern per issue.
2. **Branch** from the issue: the "Create a branch" link in the issue's Development panel, or `gh issue develop <number> --checkout`. Name it `<type>/<number>-short-name`, e.g. `fix/14-voice-cut-off`.
3. **Develop.** Add or update tests for behavior you change.
4. **Refactor.** Before review, simplify what you wrote: no dead code, no duplicated helpers, comments only where the code can't speak for itself.
5. **Review.** Re-read your diff as a stranger. `npm run lint` and `npm test` must pass.
6. **Pull request.** Fill in the template and start the description with `Closes #<number>`: a check requires it, and merging closes the issue. The title must follow [Conventional Commits](https://www.conventionalcommits.org); see [Commit and PR titles](#commit-and-pr-titles).

With [Claude Code](https://claude.com/claude-code), run `/contribute` in the repo: `/intent` writes the intent into the issue and branches from it, then and walks through the rest, including `/simplify` for the refactor and `/code-review` for the review.

## Commit and PR titles

[Conventional Commits](https://www.conventionalcommits.org): `type(optional scope): what it does`, imperative, lower case, under 70 characters. Choose the type by **who the change is for**: only changes that people using character-forge will notice make a release.

| Type | For | Release |
|---|---|---|
| `feat` | Something new for users: a tool, a CLI command, a card field, a media step | yes (minor; patch while on 0.x) |
| `fix` | A bug users can hit | yes (patch) |
| `perf` | Faster or cheaper for users, same behavior | yes (patch) |
| `docs` | README, CONTRIBUTING, comments, the site's text | no |
| `refactor` | Code changes with no behavior change | no |
| `test` | Tests only | no |
| `ci` | GitHub Actions, checks | no |
| `build` | Packaging, dependencies (Dependabot uses `chore(deps)`) | no |
| `chore` | The development workflow, skills for contributors, repo settings, anything else | no |

Add `!` after the type (`feat!: …`) when users must change something on their side: a renamed tool, a removed field, a new required setting. Scopes are optional, for example `feat(voice): …` or `fix(site): …`.

Examples: `feat: start a character from a concept image`, `fix(voice): keep long Russian lines from being cut off`, `ci: run tests on Node 24`, `chore: add the intent skill`, `docs: add the share image to the README`.

## Versions and releases

You don't bump versions or edit `CHANGELOG.md` by hand. PRs are squash-merged, so each PR title becomes one commit on `main`. [Release Please](https://github.com/googleapis/release-please) reads those commits and keeps a release PR open: `feat` raises the minor version, `fix` the patch, `!` the major (while we are on 0.x, a breaking change raises the minor). Merging the release PR tags the version, writes the changelog, creates the GitHub release and publishes the package to npm.

## Content rules

- All product text (cards, prompts, docs, the site) is English.
- Cards and prompts are written for people who are not developers: plain words, no jargon.
- Don't add a field to the card without following the checklist in [CLAUDE.md](CLAUDE.md) (schema → render → example → check → method).

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE), and to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
