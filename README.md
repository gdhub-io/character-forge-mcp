# character-forge-mcp

[![Character Forge MCP: a character studio inside your AI chat](https://raw.githubusercontent.com/gdhub-io/character-forge-mcp/main/site/public/og.jpg)](https://characters.gdhub.io)

[![CI](https://github.com/gdhub-io/character-forge-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/gdhub-io/character-forge-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@gdhub/character-forge-mcp)](https://www.npmjs.com/package/@gdhub/character-forge-mcp)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A character studio inside your AI chat. Ask for a character for your film, game, ad or book, and get a whole person whose story holds together: what they want, what they fear, where they come from, how they change, and how they look. Then, if you like, see them, hear them and give them their own music.

**See characters made with it: [characters.gdhub.io](https://characters.gdhub.io)**

## Install

It runs on your computer and works with Claude Code, Codex and other AI apps. You need [Node.js](https://nodejs.org) 20 or newer.

### Claude Code

Type these two commands in Claude Code:

```
/plugin marketplace add gdhub-io/character-forge-mcp
/plugin install character-forge@character-forge
```

It asks for a [fal.ai](https://fal.ai) key. You can leave it empty and add it later in `/plugin`.

### Codex

1. In a terminal, install it:

   ```bash
   npm install -g @gdhub/character-forge-mcp
   ```

2. In Codex, add an MCP server:
   - **Command to launch**:
     - Mac with Apple chip: `/opt/homebrew/bin/character-forge`
     - Mac with Intel chip, Linux: `/usr/local/bin/character-forge`
     - Windows: `C:\Users\you\AppData\Roaming\npm\character-forge.cmd`

     If it isn't there (for example, Node is installed with nvm), run `which character-forge` on Mac or Linux, or `where character-forge` on Windows, and use what it prints.
   - **Environment variables**: `CHARACTER_FORGE_DIR` = `/Users/you/character-forge` (any folder for your characters), and `FAL_KEY` = your fal.ai key, if you have one

### Other AI apps

Claude Desktop, Cursor, VS Code and other apps that run MCP servers on your computer: add this to their MCP settings.

```json
{
  "mcpServers": {
    "character-forge": {
      "command": "npx",
      "args": ["-y", "@gdhub/character-forge-mcp"],
      "env": {
        "CHARACTER_FORGE_DIR": "/Users/you/character-forge",
        "FAL_KEY": "..."
      }
    }
  }
}
```

### Remove it

- **Claude Code**: `/plugin uninstall character-forge@character-forge`, then `/plugin marketplace remove character-forge`
- **Codex**: delete the server in Codex's settings, then `npm uninstall -g @gdhub/character-forge-mcp`
- **Other apps**: delete the `character-forge` entry from their MCP settings

Your characters stay in their folder until you delete it yourself.

## Use

Restart the app and ask in the chat:

> Make me a random character for a noir film.

> A 60-year-old ex-boxer for a coffee ad, warm but stubborn.

> Here's my sketch: hero.png. She's a desert pilot who is afraid of the sea.

You get a full character card. Then ask for more, one step at a time: *"Draw the concept"*, *"Put her in her place"*, *"Bring the picture to life"*, *"Give her a voice"*, *"Write her music"*. Not sure what's next? Ask *"What's next?"*.

**Experimental: characters meet.** In Claude Code, type `/meet` with 2–5 saved characters and a situation, for example `/meet marta-vell pike-ostrander — stuck in a lift at night, the light goes out`. They meet as strangers and play the scene in turns. You get a script with each one's private thoughts under their lines, and how each one's feelings toward the others changed. Free: the chat plays the characters.

- **Free**: characters, cards, translations, and ready-made prompts you can use in any image, video, voice or music generator.
- **Paid**: pictures, video, voice and music, made with your own fal.ai key. A whole character costs about $1.50. Nothing paid happens until you ask for it.
- **Your files**: each character gets a folder in `CHARACTER_FORGE_DIR` (`~/character-forge` if you don't set it), with the card, the pictures, video and sound.

## How it works

Every character is born with a temperament and a body of their own, and one wound lands on them: it taught them a false belief, the belief breeds a fear, the fear hides behind their worst trait, and the same wound gave them their best one. The same hurt shapes a shy, sensitive child differently from a bold, thick-skinned one. Their story is learning the truth. So nothing about them is random filler.

Three versions of your idea are written. Independent reviewers check each one and argue against it, a judge keeps the strongest, a designer draws its look from the story, and an editor makes every line easy to read.

Every tool, setting and option is listed in [docs/reference.md](docs/reference.md).

## Contribute

Ideas, bug reports and pull requests are welcome. A new wound for characters to grow from is a great first contribution, and it needs a writer more than a programmer. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License and credits

[MIT](LICENSE). One exception: the character Fanya is © Dzmitry Drynau, all rights reserved; she is on the site as an example ([details](site/public/characters/fanya/LICENSE.md)).

What you generate with the paid steps is also subject to the terms of fal.ai and the companies behind each model, including commercial use and the rules about real people's faces and voices.

The character method is inspired by Sherri Sheridan's book *Developing Digital Short Films* and Michael Dougan's "one best, one worst, three other traits" formula, retold in our own words and extended. If the method works for you, read the book.
