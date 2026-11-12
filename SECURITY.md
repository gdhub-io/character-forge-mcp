# Security policy

## Reporting a vulnerability

Please report security issues **privately**, not in public issues: use [Report a vulnerability](https://github.com/gdhub-io/character-forge-mcp/security/advisories/new) on the repository's Security tab. Describe the problem, how to reproduce it, and what it affects. You will get an answer within a week.

## Supported versions

Only the latest released version gets fixes.

## What matters most here

- **API keys.** The fal.ai key comes from the environment, a gitignored `.env` (which may set the key and nothing else), or Claude Code's secure plugin storage. It is only ever sent to fal.ai's own https hosts and never written to the character library, logs, prompts, tool results or the site.
- **Files on disk.** The server reads and writes inside the character library (`CHARACTER_FORGE_DIR`). Character ids are validated so that no path leaves it. Pictures the user names (their own concept, a pose reference) must be real PNG, JPEG or WebP images, and links must be https to a public host, so a crafted card can't pull other files or internal addresses into the chat.
- **Paid calls.** No tool should spend money without the user asking for that step.
