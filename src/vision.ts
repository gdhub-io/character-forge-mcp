import { config } from "./config.js";
import { type CostEntry, recordCost } from "./costs.js";
import { falQueueJson } from "./fal.js";

/** One question about one picture to the vision model; its answer as written, its cost in the ledger under `kind`. */
export async function askVision(
	id: string,
	question: string,
	imageUrl: string,
	what: string,
	kind: CostEntry["kind"],
): Promise<string> {
	const vision = config().models.vision;
	const out = await falQueueJson<{
		output?: string;
		usage?: { cost?: number };
	}>(vision.model, {
		model: vision.llm,
		prompt: question,
		image_urls: [imageUrl],
		// The router's default model refuses requests with reasoning off ("Reasoning is mandatory").
		reasoning: true,
		max_tokens: 2000,
		temperature: 0,
	});
	const text = (out.output ?? "").trim();
	if (!text) throw new Error(`The vision model said nothing (${what}).`);
	await recordCost(id, {
		kind,
		model: `${vision.model} (${vision.llm})`,
		detail: what,
		usd: out.usage?.cost ?? config().pricing.vision.call,
	});
	return text;
}

/** An answer as one line: list markers dropped, lines joined with "; ", cut to `max` characters. */
export const oneLine = (text: string, max: number) =>
	text
		.split("\n")
		.map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
		.filter(Boolean)
		.join("; ")
		.slice(0, max);
