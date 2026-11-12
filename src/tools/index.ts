import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCheck } from "./check.js";
import { registerConcept } from "./concept.js";
import { registerCosts } from "./costs.js";
import { registerCreate } from "./create.js";
import { registerLibrary } from "./library.js";
import { registerMedia } from "./media.js";
import { registerMethod } from "./method.js";
import { registerNext } from "./next.js";
import { registerPick } from "./pick.js";
import { registerRole } from "./role.js";
import { registerSave } from "./save.js";
import { registerScene } from "./scene.js";
import { registerTheme } from "./theme.js";
import { registerTranslate } from "./translate.js";
import { registerVoice } from "./voice.js";

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
