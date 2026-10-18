// Learning from people's corrections to the photo reading: what they added or took away, and where, summed up into a
// few lines the next readings are told.

type Mark = { photo?: number; x?: number; y?: number; r?: number };
type Group = { what?: string; marks?: Mark[] };
type Box = { photo?: number; x?: number; y?: number; w?: number; h?: number };
export type CorrectionGroup = { what: string; found: number; added: number; removed: number; where: string[] };

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const same = (a: Mark, b: Mark) => (a.photo ?? 0) === (b.photo ?? 0) && a.x === b.x && a.y === b.y;

// Where a stone sits relative to the main stone's box: on it, just round its edge, or further out (sides, shoulders).
function placeOf(mk: Mark, main?: Box) {
  if (!main || !num(main.x) || !num(main.y) || !num(main.w) || !num(main.h) || !num(mk.x) || !num(mk.y) || (mk.photo ?? 0) !== (main.photo ?? 0)) return "elsewhere";
  const cx = main.x + main.w / 2, cy = main.y + main.h / 2;
  const d = Math.max(Math.abs(mk.x - cx) / (main.w / 2), Math.abs(mk.y - cy) / (main.h / 2));
  return d < 0.85 ? "over the main stone" : d < 1.6 ? "round the main stone's edge" : "out towards the edges and sides";
}

export function correctionsOf(before: Group[], after: Group[], main?: Box): CorrectionGroup[] {
  return after.map((g, i) => {
    const was = before[i]?.marks ?? [], now = g.marks ?? [];
    const added = now.filter((mk) => !was.some((w) => same(w, mk)));
    const removed = was.filter((w) => !now.some((mk) => same(w, mk)));
    return { what: (g.what ?? "").slice(0, 80), found: was.length, added: added.length, removed: removed.length, where: added.slice(0, 40).map((mk) => placeOf(mk, main)) };
  }).filter((g) => g.what && (g.added || g.removed));
}

const KINDS: [RegExp, string][] = [
  [/briolette/i, "briolettes"], [/leaf|leaves|marquise/i, "leaf and marquise stones"], [/round|brilliant|pav/i, "small round stones"],
  [/pear/i, "pear stones"], [/pearl/i, "pearls"], [/cabochon|sugarloaf/i, "cabochons"], [/baguette/i, "baguettes"],
];
const kindOf = (what: string) => KINDS.find(([re]) => re.test(what))?.[1] ?? "other stones";

export function lessonsFrom(rows: { groups: unknown }[]): string {
  const tally = new Map<string, { pieces: number; added: number; removed: number; found: number; where: Map<string, number> }>();
  for (const row of rows) {
    if (!Array.isArray(row.groups)) continue;
    for (const g of row.groups as CorrectionGroup[]) {
      if (!g || typeof g.what !== "string") continue;
      const k = kindOf(g.what), t = tally.get(k) ?? { pieces: 0, added: 0, removed: 0, found: 0, where: new Map() };
      t.pieces++; t.added += Number(g.added) || 0; t.removed += Number(g.removed) || 0; t.found += Number(g.found) || 0;
      for (const w of Array.isArray(g.where) ? g.where : []) t.where.set(w, (t.where.get(w) ?? 0) + 1);
      tally.set(k, t);
    }
  }
  const lines: string[] = [];
  for (const [k, t] of [...tally.entries()].sort((a, b) => b[1].added - a[1].added)) {
    const missedShare = t.found + t.added ? Math.round((t.added / (t.found + t.added)) * 100) : 0;
    const where = [...t.where.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (t.added >= 2) lines.push(`- ${k}: readings missed about ${missedShare}% of them${where ? `, mostly ${where}` : ""}. Look there again and mark every one.`);
    if (t.removed >= 2) lines.push(`- ${k}: about ${Math.round(t.removed / t.pieces)} marks per piece were wrong (not a stone). Only mark stones you can see.`);
  }
  return lines.length ? `What people have had to correct in earlier readings:\n${lines.slice(0, 8).join("\n")}` : "";
}
