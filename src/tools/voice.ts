import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { designVoice, speakLine, speakReference, VOICE_LANGUAGES } from "../voice.js";
import { reply } from "./util.js";

export function registerVoice(server: McpServer) {
  server.registerTool(
    "character_voice",
    {
      title: "Design the character's voice (on request, paid)",
      description:
        "ONLY on request; confirm the cost first. Creates the character's own voice from a description and a reference script (write both with character_prompt kind 'voice'). Adults: ElevenLabs Voice Design, a saved voice and its reference take (≈$0.10 per 1000 characters of the script). Under 18: Qwen 3 Voice Design, deepened by pitch_semitones and cloned into a speaker embedding (≈$0.03). Saves assets/voice/.",
      inputSchema: {
        id: z.string(),
        description: z.string().min(20).max(1000).describe("Who they are and how they sound: history, how they talk and to whom, then age, gender, timbre, pace, recording."),
        text: z.string().min(100).max(1000).describe("Reference script in their natural speaking voice (not a whisper). Eleven v3 tags like [sighs] are allowed; they are dropped for minors."),
        pitch_semitones: z.number().min(-6).max(6).optional().describe("Minors only: deepen (negative) or lighten the designed voice. Default -2."),
        text_ru: z.string().min(50).max(1000).optional().describe("The same monologue translated into Russian, spoken in the same voice → voice/reference.ru.mp3 (the site's Russian version). Write it whenever the site shows the character, so both languages are made at once."),
      },
    },
    async ({ id, description, text: script, pitch_semitones, text_ru }) => {
      const r = await designVoice(id, { description, text: script, pitchSemitones: pitch_semitones, translations: text_ru ? { ru: text_ru } : undefined });
      return reply(`Voice designed (${r.engine}):\n${r.files.join("\n")}`, { ...r });
    },
  );

  server.registerTool(
    "character_voice_translation",
    {
      title: "The voice monologue in another language (paid)",
      description: "ONLY on request, after character_voice: speaks the reference monologue, translated, in the same voice → voice/reference.<lang>.mp3, which the site plays in that language. Same price as a line.",
      inputSchema: {
        id: z.string(),
        lang: z.enum(Object.keys(VOICE_LANGUAGES).filter((l) => l !== "en") as [string, ...string[]]),
        text: z.string().min(20).max(1000).describe("The reference monologue translated, keeping its meaning, rhythm, pauses and the character's voice."),
      },
    },
    async ({ id, lang, text: line }) => {
      const file = await speakReference(id, line, lang as keyof typeof VOICE_LANGUAGES);
      return reply(`Saved: ${file}`, { file });
    },
  );

  server.registerTool(
    "character_voice_line",
    {
      title: "Speak one line in the character's voice (paid)",
      description: "ONLY on request, after character_voice; one line per call, confirm the cost (≈$0.10 per 1000 characters). Saves assets/voice/lines/<name>.mp3.",
      inputSchema: {
        id: z.string(),
        text: z.string().min(1).max(600).describe("The line. Adults: Eleven v3 delivery tags like [whispering], [nervous laugh]. Minors: shape delivery with punctuation (… — !)."),
        name: z.string().min(1).describe("File name, e.g. '01-to-the-radio'."),
      },
    },
    async ({ id, text: line, name }) => {
      const file = await speakLine(id, { text: line, name });
      return reply(`Line saved: ${file}`, { file });
    },
  );
}
