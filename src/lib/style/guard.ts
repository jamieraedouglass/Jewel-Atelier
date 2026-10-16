import { GEMS, METALS, gemLabel, label, type Gem } from "../design";
import type { StylePrefs } from "./profile";

/**
 * A check on the designer's suggestions before anyone sees them: a suggestion that would put an avoided gem in the
 * piece is dropped (the instructions say never to, this makes sure), and one in a metal they don't wear is flagged.
 */

const GEM_KEYS = new Set(["gem", "paveGem"]);

/** every gem a suggested change would put in the piece, wherever it sits (main stone, accents, parts, frames…) */
export function gemsIn(patch: unknown): Gem[] {
  const found = new Set<Gem>();
  const walk = (v: unknown, key = "") => {
    if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(x, k));
    else if (GEM_KEYS.has(key) && typeof v === "string" && (GEMS as readonly string[]).includes(v)) found.add(v as Gem);
  };
  walk(patch);
  return [...found];
}

export type Proposal = { title: string; why: string; patch: Record<string, unknown>; note?: string };

export function screenProposals(proposals: Proposal[], prefs: StylePrefs) {
  const kept: Proposal[] = [], dropped: { title: string; gems: Gem[] }[] = [];
  for (const p of proposals) {
    const avoided = gemsIn(p.patch).filter((g) => prefs.avoidGems.includes(g));
    if (avoided.length) { dropped.push({ title: p.title, gems: avoided }); continue; }
    const metal = typeof p.patch.metal === "string" && (METALS as readonly string[]).includes(p.patch.metal) ? (p.patch.metal as (typeof METALS)[number]) : null;
    kept.push(metal && prefs.metals.length && !prefs.metals.includes(metal)
      ? { ...p, note: `In ${label(metal).toLowerCase()}, which isn't one of your metals.` }
      : p);
  }
  return { kept, dropped };
}

/** a line for the reply when suggestions were held back */
export const droppedNote = (dropped: { title: string; gems: Gem[] }[]) =>
  dropped.length
    ? `(I left out ${dropped.length === 1 ? "a suggestion" : `${dropped.length} suggestions`} using ${[...new Set(dropped.flatMap((d) => d.gems))].map((g) => gemLabel(g).toLowerCase()).join(", ")}, which your profile says to avoid.)`
    : "";
