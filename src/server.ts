import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPrompts } from "./prompts/index.js";
import { registerTools } from "./tools/index.js";

export const VERSION: string = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

// Short on purpose: the full method and tournament protocol live in character_method (tournament.ts).
const INSTRUCTIONS = `
character-forge builds vivid, story-ready characters (film, games, ads, books): a full character card
plus an A-pose concept sheet. Characters are random in the sense "you can't guess who you'll get", but
every part of the card grows from one core (wound → lie → fear → defense/gift → truth).

Always start with character_method: it contains the method, the card format and the variant-tournament
protocol (3 variants of one concept compete; only the strongest ships). Run a single variant only if the
user asks for a quick character. In brief mode keep everything the user specified, in every variant.
Always write cards in English, whatever language the user writes in.

After a character exists, media is made only on request, one paid step at a time (ask before each): concept →
location → idle video → voice (spoken in the video's moment, every language); music after the location. When the
user asks what's next, call character_next and offer what it lists, with prices.
`.trim();

export function createServer(): McpServer {
	const server = new McpServer(
		{ name: "character-forge", version: VERSION },
		{ instructions: INSTRUCTIONS },
	);
	registerTools(server);
	registerPrompts(server);
	return server;
}
