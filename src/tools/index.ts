import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMethod } from "./method.js";
import { registerRoll } from "./roll.js";
import { registerCheck } from "./check.js";
import { registerRole } from "./role.js";
import { registerSave } from "./save.js";
import { registerConcept } from "./concept.js";
import { registerLibrary } from "./library.js";
import { registerMedia } from "./media.js";

export function registerTools(server: McpServer) {
  registerMethod(server);
  registerRoll(server);
  registerCheck(server);
  registerRole(server);
  registerSave(server);
  registerConcept(server);
  registerLibrary(server);
  registerMedia(server);
}
