import { type Design, type DropPart, DropPartSchema } from "./design";

type Mark = { photo?: number; x?: number; y?: number; r?: number };
type Group = { what?: string; shape?: string; cut?: string; marks?: Mark[] };
export type TraceReading = { main?: { photo?: number; x?: number; y?: number; w?: number; h?: number }; groups?: Group[] };
export type PhotoSize = { w: number; h: number };

const DROP_STYLES = new Set(["earrings:pendant", "earrings:chandelier", "necklace:drop-pendant"]);
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

// The stones the photo reading circled, placed where they are in the photo: each mark becomes a position in mm from
// the big stone's centre, scaled by the big stone's known size. Applied after every AI build or correction, so the
// layout always matches the photo from the front however the AI described it.
export function traceDrops(d: Design, reading: TraceReading | null, sizes: (PhotoSize | null)[], removed: number[] = []): Design {
  if (!reading?.main || !DROP_STYLES.has(`${d.type}:${d.style}`) || !d.drop.parts.length) return d;
  const main = reading.main, photo = main.photo ?? 0, img = sizes[photo];
  const first = d.drop.parts[0];
  if (!img || first.kind !== "stone" || ![main.x, main.y, main.w, main.h].every(num)) return d;

  // Pixels per mm, from how big the big stone's box is in the photo for its size and the way its tip points.
  const L = first.stone.lengthMm, W = first.stone.widthMm, c = ((180 - first.stone.rotation) * Math.PI) / 180;
  const ux = Math.abs(Math.sin(c)), uy = Math.abs(Math.cos(c));
  // A turned stone's box is close to an oval's (a rectangle's would make the stone look too small for its box).
  const Bw = Math.hypot(L * ux, W * uy), Bh = Math.hypot(L * uy, W * ux), bw = main.w! * img.w, bh = main.h! * img.h;
  const pxPerMm = (bw * Bw + bh * Bh) / (Bw * Bw + Bh * Bh);
  if (!(pxPerMm > 0)) return d;
  const cx = (main.x! + main.w! / 2) * img.w, cy = (main.y! + main.h! / 2) * img.h;

  const parts = d.drop.parts.map((p) => ({ ...p, small: { ...p.small } }));
  (reading.groups ?? []).forEach((g, gi) => {
    if (removed.includes(gi)) return;
    const marks = (g.marks ?? []).filter((mk) => (mk.photo ?? 0) === photo && num(mk.x) && num(mk.y));
    if (marks.length < 2) return;
    const text = `${g.what ?? ""} ${g.shape ?? ""} ${g.cut ?? ""}`.toLowerCase();
    const kind = /briolette/.test(text) ? "briolette" : /\bround\b/.test(text) ? "round" : null;
    if (!kind) return;
    const hits = parts.filter((p) => p.kind === "stone" && (kind === "briolette" ? p.small.cut === "briolette" : p.small.cut !== "briolette" && p.small.shapes.every((x) => x === "round")));
    // Stones the person marked that no part holds yet get their own part, set on the big stone.
    if (!hits.length && parts.length < 10) {
      const added = DropPartSchema.parse({ kind: "stone", stone: first.stone, showStone: false, anchor: "on", from: 0, link: "direct", gapMm: 0,
        small: { gem: "diamond", cut: kind === "briolette" ? "briolette" : "faceted", shapes: [kind === "briolette" ? "pear" : "round"] } });
      parts.push(added);
      hits.push(added);
    }
    if (hits.length !== 1) return;
    const part = hits[0] as DropPart;
    const across = marks.map((mk) => (2 * (num(mk.r) ? mk.r : 0.015) * img.w) / pxPerMm * (kind === "briolette" ? 0.75 : 1));
    const width = Math.min(20, Math.max(0.8, median(across)));
    part.small.widthMm = width;
    part.small.spots = marks.slice(0, 40).map((mk, i) => ({
      x: Math.max(-60, Math.min(60, (mk.x! * img.w - cx) / pxPerMm)),
      z: Math.max(-60, Math.min(60, (mk.y! * img.h - cy) / pxPerMm)),
      s: Math.max(0.2, Math.min(4, across[i] / width)),
    }));
    part.count = Math.min(24, part.small.spots.length);
  });
  return { ...d, drop: { ...d.drop, parts } };
}
