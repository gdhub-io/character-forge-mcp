import { readFile } from "node:fs/promises";
import path from "node:path";
import { characterDir, writeJson } from "./store.js";

/** One paid generation, as recorded in <character>/costs.json. Amounts are estimates from models.json pricing. */
export interface CostEntry {
  at: string;
  kind: "concept" | "scene" | "video" | "music" | "voice";
  model: string;
  /** What was made, e.g. "8 s, with sound" or "312 characters, ru". */
  detail: string;
  usd: number;
}

export interface CostLedger {
  totalUsd: number;
  byKind: Partial<Record<CostEntry["kind"], number>>;
  entries: CostEntry[];
}

const ledgerFile = (slug: string) => path.join(characterDir(slug), "costs.json");
const round = (n: number) => Math.round(n * 1000) / 1000;

/** The ledger file holds only the entries; totals are summed on read, so a hand edit can't leave them stale. */
export async function readCosts(slug: string): Promise<CostLedger> {
  const raw = await readFile(ledgerFile(slug), "utf8").catch(() => "");
  const entries = raw ? ((JSON.parse(raw) as { entries?: CostEntry[] }).entries ?? []) : [];
  const byKind: CostLedger["byKind"] = {};
  for (const e of entries) byKind[e.kind] = round((byKind[e.kind] ?? 0) + e.usd);
  return { totalUsd: round(entries.reduce((sum, e) => sum + e.usd, 0)), byKind, entries };
}

/** Appends one paid generation to the character's ledger. Call it only after the generation succeeded. */
export async function recordCost(slug: string, entry: Omit<CostEntry, "at">): Promise<void> {
  const { entries } = await readCosts(slug);
  entries.push({ at: new Date().toISOString(), ...entry, usd: round(entry.usd) });
  await writeJson(ledgerFile(slug), { entries });
}

export function costsToText(slug: string, l: CostLedger): string {
  if (!l.entries.length) return `${slug}: no paid generations recorded yet.`;
  const kinds = Object.entries(l.byKind).map(([k, v]) => `${k} $${v}`).join(", ");
  const lines = l.entries.map((e) => `- ${e.at.slice(0, 16).replace("T", " ")} ${e.kind} $${e.usd} — ${e.detail} (${e.model})`);
  return [`${slug}: about $${l.totalUsd} spent (${kinds})`, ...lines].join("\n");
}
