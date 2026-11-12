import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMethod } from "./method.js";
import { registerCreate } from "./create.js";
import { registerCheck } from "./check.js";
import { registerRole } from "./role.js";
import { registerSave } from "./save.js";
import { registerConcept } from "./concept.js";
import { registerLibrary } from "./library.js";
import { registerMedia } from "./media.js";
import { registerScene } from "./scene.js";
import { registerVoice } from "./voice.js";
import { registerTheme } from "./theme.js";
import { registerPick } from "./pick.js";
import { registerTranslate } from "./translate.js";
import { registerCosts } from "./costs.js";
import { registerNext } from "./next.js";

export function registerTools(server: McpServer) {
  registerMethod(server);
  registerCreate(server);
  registerCheck(server);
  registerRole(server);
  registerSave(server);
  registerConcept(server);
  registerLibrary(server);
  registerMedia(server);
  registerScene(server);
  registerVoice(server);
  registerTheme(server);
  registerPick(server);
  registerTranslate(server);
  registerCosts(server);
  registerNext(server);
}
