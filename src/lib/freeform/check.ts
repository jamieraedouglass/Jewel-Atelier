import * as THREE from "three";
import type { Freeform } from "../design";
import type { Layout } from "./layout";

// Checks a freeform layout the way a bench jeweller would look at a drawing: do any stones run into each other, and is
// every part joined to the rest, and through it to what it's worn from? The answers are plain sentences, given back to
// the AI to fix and shown to the person under the sketch.

type Element = { label: string; pts: THREE.Vector2[]; area?: { outline: THREE.Vector2[]; holes: THREE.Vector2[][] } };

const mm = (n: number) => Math.round(n * 10) / 10;
const where = (x: number, y: number) => `(${mm(x)}, ${mm(y)})`;
const inside = (p: THREE.Vector2, ring: THREE.Vector2[]) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};

function elements(f: Freeform, lay: Layout): Element[] {
  const byGroup = new Map<string, Element>();
  const el = (group: string, label: string) => byGroup.get(group) ?? byGroup.set(group, { label, pts: [] }).get(group)!;
  const partName = (group: string) => {
    const part = f.parts[Number.parseInt(group, 10)];
    if (!part) return "a part";
    const side = group.endsWith("m") ? " (the mirrored copy)" : "";
    if (part.kind === "row") return `the row of ${part.shape} ${part.gem}s along "${part.path}"${side}`;
    if (part.kind === "wire") return `the gold wire along "${part.path}"${side}`;
    if (part.kind === "plate") return `the plate "${part.path}"${side}`;
    if (part.kind === "link") return `the link from ${where(part.a[0], part.a[1])}${side}`;
    return `the ${part.shape} ${part.gem}${side}`;
  };
  for (const p of lay.plates) {
    const e = el(p.group, partName(p.group));
    e.pts.push(...p.outline, ...p.holes.flat());
    e.area = { outline: p.outline, holes: p.holes };
  }
  for (const s of lay.stones) {
    const e = el(s.group, partName(s.group));
    // The stone's outline, roughly: its centre and points round its edge.
    e.pts.push(new THREE.Vector2(s.x, s.y));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, lx = Math.cos(a) * s.L / 2, ly = Math.sin(a) * s.W / 2;
      e.pts.push(new THREE.Vector2(s.x + lx * Math.cos(s.angle) - ly * Math.sin(s.angle), s.y + lx * Math.sin(s.angle) + ly * Math.cos(s.angle)));
    }
  }
  for (const w of lay.wires) {
    const e = el(w.group, partName(w.group));
    for (let i = 1; i < w.pts.length; i++) {
      const a = w.pts[i - 1], b = w.pts[i], n = Math.max(1, Math.ceil(a.distanceTo(b) / 0.4));
      for (let k = 0; k <= n; k++) e.pts.push(new THREE.Vector2(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n));
    }
  }
  for (const l of lay.links) {
    const e = el(l.group, partName(l.group)), n = Math.max(1, Math.ceil(l.a.distanceTo(l.b) / 0.4));
    for (let k = 0; k <= n; k++) e.pts.push(new THREE.Vector2(l.a.x + ((l.b.x - l.a.x) * k) / n, l.a.y + ((l.b.y - l.a.y) * k) / n));
  }
  return [...byGroup.values()].filter((e) => e.pts.length);
}

// What the piece is worn from, as a test of whether a point touches it.
function wornFrom(type: string, bandMm: number, f: Freeform): (p: THREE.Vector2) => boolean {
  if (type === "ring") return (p) => Math.abs(p.y) <= bandMm / 2 + 0.3;
  if (type === "earrings") return (p) => p.length() <= 2.2;
  const n = f.neckline, reach = n.kind === "stones" ? (n.rows - 1) * (n.sizeMm + 0.3) + n.sizeMm / 2 + 0.3 : 0.8;
  return (p) => p.y <= reach;
}

export function checkLayout(f: Freeform, lay: Layout, type: string, bandMm = 2.5): string[] {
  const issues: string[] = [];

  // Stones running into each other (a little forgiveness: their outlines are approximate).
  const stones = lay.stones;
  const cell = 3, grid = new Map<string, number[]>();
  stones.forEach((s, i) => { const k = `${Math.floor(s.x / cell)},${Math.floor(s.y / cell)}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); });
  const clashes: string[] = [];
  let clashCount = 0;
  stones.forEach((s, i) => {
    const cx = Math.floor(s.x / cell), cy = Math.floor(s.y / cell), reach = Math.ceil(Math.max(s.L, s.W) / cell) + 1;
    for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) for (const j of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
      if (j <= i) continue;
      const o = stones[j], d = Math.hypot(o.x - s.x, o.y - s.y);
      if (d < (Math.min(s.L, s.W) + Math.min(o.L, o.W)) / 2 * 0.92) {
        clashCount++;
        if (clashes.length < 4) clashes.push(`${s.big ? `the ${s.shape} ${s.gem}` : `a ${mm(s.W)} mm ${s.shape}`} at ${where(s.x, s.y)} and ${o.big ? `the ${o.shape} ${o.gem}` : `a ${mm(o.W)} mm ${o.shape}`} at ${where(o.x, o.y)}`);
      }
    }
  });
  if (clashCount) issues.push(`${clashCount} pair${clashCount > 1 ? "s" : ""} of stones overlap, e.g. ${clashes.join("; ")}. Move them apart or make them smaller.`);

  // Every part joined, through the others, to what it's worn from.
  const els = elements(f, lay);
  const parent = els.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (a: number, b: number) => { parent[find(a)] = find(b); };
  const touch = 0.6, pgrid = new Map<string, number[]>();
  els.forEach((e, i) => e.pts.forEach((p) => { const k = `${Math.floor(p.x / touch)},${Math.floor(p.y / touch)}`; const l = pgrid.get(k) ?? pgrid.set(k, []).get(k)!; if (l[l.length - 1] !== i) l.push(i); }));
  els.forEach((e, i) => e.pts.forEach((p) => {
    const cx = Math.floor(p.x / touch), cy = Math.floor(p.y / touch);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of pgrid.get(`${cx + dx},${cy + dy}`) ?? []) if (j !== i && find(i) !== find(j)) join(i, j);
  }));
  // Anything lying on a plate is held by it.
  els.forEach((e, i) => { if (!e.area) return; els.forEach((o, j) => { if (j !== i && find(i) !== find(j) && o.pts.some((p) => inside(p, e.area!.outline) && !e.area!.holes.some((h) => inside(p, h)))) join(i, j); }); });
  const worn = wornFrom(type, bandMm, f);
  const held = new Set(els.map((e, i) => (e.pts.some(worn) ? find(i) : -1)).filter((r) => r >= 0));
  const loose = els.filter((_, i) => !held.has(find(i)));
  const wornName = type === "ring" ? "the band" : type === "earrings" ? "the post at (0, 0)" : "the neckline at y = 0";
  if (!held.size) issues.push(`Nothing reaches ${wornName}, so the piece has nothing to hang from. Add a link or move the top of the design to it.`);
  else if (loose.length) {
    const named = [...new Set(loose.map((e) => e.label))].slice(0, 5);
    const near = loose[0].pts[0];
    issues.push(`${named.join(", ")} ${named.length > 1 ? "are" : "is"} not joined to the rest of the piece (e.g. near ${where(near.x, near.y)}). Make it touch a neighbouring part, or add a wire or link to it.`);
  }
  return issues;
}
