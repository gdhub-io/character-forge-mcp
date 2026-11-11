import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RollOptionsSchema, rollToText } from "../random.js";
import { reply } from "./util.js";

export function registerRoll(server: McpServer) {
  server.registerTool(
    "character_roll",
    {
      title: "Roll character engine(s)",
      description:
        "Rolls a random but coherent character ENGINE (wound → lie → fear → worst trait / best trait → truth → arc) plus surprising SPARKS. With variants ≥ 2 it rolls competing variants of the SAME concept: shared anchor/world, different cores — for the variant tournament. Same seed = same roll.",
      inputSchema: RollOptionsSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const r = rollToText(args);
      return reply(r.text, r.data as unknown as Record<string, unknown>);
    },
  );
}
