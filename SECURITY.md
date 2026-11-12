# Security policy

## Reporting a vulnerability

Please report security issues **privately**, not in public issues: use [Report a vulnerability](https://github.com/gdhub-io/character-forge-mcp/security/advisories/new) on the repository's Security tab. Describe the problem, how to reproduce it, and what it affects. You will get an answer within a week.

## Supported versions

Only the latest released version gets fixes.

## What matters most here

- **API keys.** The fal.ai key comes from the environment, a gitignored `.env`, or Claude Code's secure plugin storage. It must never be written to the character library, logs, prompts, tool results or the site.
- **Files on disk.** The server reads and writes inside the character library (`CHARACTER_FORGE_DIR`). Character ids are validated so that no path leaves it. Paths the user passes on purpose (for example their own concept image) are read as given.
- **Paid calls.** No tool should spend money without the user asking for that step.
