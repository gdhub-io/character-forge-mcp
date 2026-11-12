export const text = (t: string) => ({ type: "text" as const, text: t });

/**
 * A tool result. Some clients (Claude Code) show the model only structuredContent when it is present, so the
 * message travels in it too; otherwise instructions written for the model (role guides, build steps) never arrive.
 */
export const reply = (message: string, data: Record<string, unknown> = {}) => ({
	content: [text(message)],
	structuredContent: { ...data, message },
});
