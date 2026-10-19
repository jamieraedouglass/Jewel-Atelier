import * as THREE from "three";
import { type CenterStone, type Freeform, type FreeformPart, SHAPE_RATIO } from "../design";

// Lays a freeform design out flat, in millimetres (x across, y down, h up towards the viewer), as the stones, wires,
// plates and links it is made of. The 3D builder and the sketch both draw from this, so the sketch someone approves
// is exactly what gets built.

export type Look = { gem: CenterStone["gem"]; color: string; cut: CenterStone["cut"]; shape: CenterStone["shape"] };
// `angle`: the direction of the stone's length, in radians from +x towards +y (0 lies it across; a quarter turn hangs
// it straight down, a pear's point lowest). `big` stones are set on their own (claws or a bezel); the rest are set
// in rows or pavé.
// `group` says which part (and which copy of it) a piece came from, so checks can name what is loose.
export type LaidStone = Look & { x: number; y: number; h: number; L: number; W: number; angle: number; big: boolean; setting: "claw" | "bezel" | "row"; group: string };
export type LaidWire = { pts: THREE.Vector3[]; r: number; finish: "plain" | "milgrain" | "rope"; rail?: boolean; group: string };
export type LaidPlate = { outline: THREE.Vector2[]; holes: THREE.Vector2[][]; thickness: number; dome: number; milgrain: boolean; group: string };
export type LaidLink = { a: THREE.Vector3; b: THREE.Vector3; group: string };
export type Layout = { stones: LaidStone[]; wires: LaidWire[]; plates: LaidPlate[]; links: LaidLink[]; bounds: { minX: number; maxX: number; minY: number; maxY: number } };

const ratio = (shape: CenterStone["shape"]) => SHAPE_RATIO[shape] ?? 1;
const v3 = (x: number, y: number, h = 0) => new THREE.Vector3(x, y, h);

// A smooth line through a path's points (stored as x, y, h in a Vector3), sampled evenly.
export function pathCurve(points: Freeform["paths"][number]["points"], closed: boolean) {
  const pts = points.map((p) => v3(p[0], p[1], p[2] ?? 0));
  if (pts.length === 2 && !closed) return new THREE.LineCurve3(pts[0], pts[1]) as THREE.Curve<THREE.Vector3>;
  return new THREE.CatmullRomCurve3(pts, closed, "centripetal") as THREE.Curve<THREE.Vector3>;
}

// Points along a line every `step` mm between two fractions of its length, with the direction it runs there.
function walk(curve: THREE.Curve<THREE.Vector3>, from: number, to: number, n = 240) {
  const out: { p: THREE.Vector3; t: THREE.Vector2 }[] = [];
  for (let i = 0; i <= n; i++) {
    const u = from + ((to - from) * i) / n;
    const p = curve.getPointAt(Math.min(1, Math.max(0, u)));
    const d = curve.getTangentAt(Math.min(1, Math.max(0, u)));
    out.push({ p, t: new THREE.Vector2(d.x, d.y).normalize() });
  }
  return out;
}

// The same line moved sideways (square to itself) by `off` mm: further rows of a band of stones.
function offsetLine(line: ReturnType<typeof walk>, off: number) {
  return line.map(({ p, t }) => ({ p: v3(p.x - t.y * off, p.y + t.x * off, p.z), t }));
}

const lengthOf = (line: { p: THREE.Vector3 }[]) => line.reduce((a, s, i) => (i ? a + Math.hypot(s.p.x - line[i - 1].p.x, s.p.y - line[i - 1].p.y) : 0), 0);
function at(line: ReturnType<typeof walk>, s: number) {
  let acc = 0;
  for (let i = 1; i < line.length; i++) {
    const seg = Math.hypot(line[i].p.x - line[i - 1].p.x, line[i].p.y - line[i - 1].p.y);
    if (acc + seg >= s || i === line.length - 1) {
      const f = seg ? Math.min(1, Math.max(0, (s - acc) / seg)) : 0;
      return { p: line[i - 1].p.clone().lerp(line[i].p, f), t: line[i - 1].t.clone().lerp(line[i].t, f).normalize() };
    }
    acc += seg;
  }
  return line[0];
}

function row(part: Extract<FreeformPart, { kind: "row" }>, curve: THREE.Curve<THREE.Vector3>): { stones: LaidStone[]; wires: LaidWire[] } {
  const base = walk(curve, Math.min(part.from, part.to), Math.max(part.from, part.to));
  const r = ratio(part.shape), end = part.sizeEndMm ?? part.sizeMm;
  const along = part.set === "along";
  // Rows sit side by side, as far apart as the widest stone reaches across the row.
  const reach = Math.max(part.sizeMm, end) * (along ? 1 : r);
  const stones: LaidStone[] = [], wires: LaidWire[] = [];
  for (let k = 0; k < part.rows; k++) {
    const line = offsetLine(base, (k - (part.rows - 1) / 2) * (reach + Math.max(0.3, part.gapMm)));
    const len = lengthOf(line);
    const foot = (W: number) => (along ? W * r : W);
    const sizeAt = (s: number) => part.sizeMm + (end - part.sizeMm) * (len ? s / len : 0);
    // Fit as many as the line holds, then centre them so the spare space is shared at both ends.
    const centres: { s: number; W: number }[] = [];
    for (let s = 0; centres.length < 600;) {
      const W = sizeAt(s), f = foot(W);
      if (s + f > len + 1e-6) break;
      centres.push({ s: s + f / 2, W });
      s += f + part.gapMm;
    }
    const last = centres[centres.length - 1];
    const spare = last ? (len - (last.s + foot(last.W) / 2)) / 2 : 0;
    for (const c of centres) {
      const { p, t } = at(line, c.s + spare);
      const dir = Math.atan2(t.y, t.x);
      stones.push({ gem: part.gem, color: part.color, cut: part.cut, shape: part.shape, x: p.x, y: p.y, h: p.z, W: c.W, L: c.W * r, angle: along ? dir : dir + Math.PI / 2, big: false, setting: "row", group: "" });
    }
    // A thin gold rail under the row, from its first stone to its last, ties their settings together.
    if (centres.length > 1) {
      const a = centres[0].s + spare, b = last.s + spare, n = Math.max(2, Math.ceil((b - a) / 1.5));
      wires.push({ pts: Array.from({ length: n + 1 }, (_, i) => at(line, a + ((b - a) * i) / n).p.clone()), r: Math.max(0.3, Math.min(part.sizeMm, end) * 0.14), finish: "plain", rail: true, group: "" });
    }
  }
  return { stones, wires };
}

// Shortest distance from a point to a closed outline.
function edgeDistance(p: THREE.Vector2, ring: THREE.Vector2[]) {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], ab = b.clone().sub(a);
    const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / (ab.lengthSq() || 1)));
    best = Math.min(best, a.clone().addScaledVector(ab, t).distanceTo(p));
  }
  return best;
}
const inside = (p: THREE.Vector2, ring: THREE.Vector2[]) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};

// How high a plate's top surface is at a point: its thickness, plus its dome, rising from the edge to the middle.
export function plateTop(plate: LaidPlate, x: number, y: number) {
  if (!plate.dome) return plate.thickness;
  const p = new THREE.Vector2(x, y);
  const d = Math.min(edgeDistance(p, plate.outline), ...plate.holes.map((h) => edgeDistance(p, h)));
  const inner = plateInradius(plate);
  return plate.thickness + plate.dome * Math.sin((Math.PI / 2) * Math.min(1, d / inner));
}
const inradii = new WeakMap<LaidPlate, number>();
function plateInradius(plate: LaidPlate) {
  let r = inradii.get(plate);
  if (r === undefined) {
    r = 0.5;
    const box = new THREE.Box2().setFromPoints(plate.outline), step = Math.max(0.5, Math.max(box.max.x - box.min.x, box.max.y - box.min.y) / 40);
    for (let x = box.min.x; x <= box.max.x; x += step) for (let y = box.min.y; y <= box.max.y; y += step) {
      const p = new THREE.Vector2(x, y);
      if (inside(p, plate.outline) && !plate.holes.some((h) => inside(p, h))) r = Math.max(r, Math.min(edgeDistance(p, plate.outline), ...plate.holes.map((h) => edgeDistance(p, h))));
    }
    inradii.set(plate, r);
  }
  return r;
}

function plate(part: Extract<FreeformPart, { kind: "plate" }>, outline: THREE.Curve<THREE.Vector3>, holes: THREE.Curve<THREE.Vector3>[]): { plates: LaidPlate[]; stones: LaidStone[] } {
  const ring = (c: THREE.Curve<THREE.Vector3>) => c.getSpacedPoints(160).slice(0, -1).map((p) => new THREE.Vector2(p.x, p.y));
  const pl: LaidPlate = { outline: ring(outline), holes: holes.map(ring), thickness: part.thicknessMm, dome: part.domeMm, milgrain: part.edge === "milgrain", group: "" };
  const stones: LaidStone[] = [];
  if (part.pave) {
    // Pavé: a honeycomb of stones over the plate, kept clear of its edges and cut-outs.
    const s = part.pave.sizeMm, pitch = s + 0.25, rowH = pitch * Math.sqrt(3) / 2, margin = s / 2 + 0.45;
    const box = new THREE.Box2().setFromPoints(pl.outline);
    for (let j = 0, y = box.min.y + margin; y <= box.max.y - margin + 1e-6; j++, y += rowH) {
      for (let x = box.min.x + margin + (j % 2 ? pitch / 2 : 0); x <= box.max.x - margin + 1e-6; x += pitch) {
        const p = new THREE.Vector2(x, y);
        if (!inside(p, pl.outline) || pl.holes.some((h) => inside(p, h))) continue;
        if (edgeDistance(p, pl.outline) < margin || pl.holes.some((h) => edgeDistance(p, h) < margin)) continue;
        stones.push({ ...part.pave, shape: "round", x, y, h: 0, W: s, L: s, angle: 0, big: false, setting: "row", group: "" });
        if (stones.length > 900) break;
      }
    }
  }
  return { plates: [pl], stones };
}

// Copies of a part's pieces turned round a point.
function turned(lay: Omit<Layout, "bounds">, count: number, around: [number, number]): Omit<Layout, "bounds"> {
  const out: Omit<Layout, "bounds"> = { stones: [], wires: [], plates: [], links: [] };
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const rot = (x: number, y: number) => [around[0] + (x - around[0]) * c - (y - around[1]) * s, around[1] + (x - around[0]) * s + (y - around[1]) * c];
    const r3 = (p: THREE.Vector3) => { const [x, y] = rot(p.x, p.y); return v3(x, y, p.z); };
    const r2 = (p: THREE.Vector2) => { const [x, y] = rot(p.x, p.y); return new THREE.Vector2(x, y); };
    const g = (x: { group: string }) => `${x.group}.${k}`;
    out.stones.push(...lay.stones.map((st) => { const [x, y] = rot(st.x, st.y); return { ...st, x, y, angle: st.angle + a, group: g(st) }; }));
    out.wires.push(...lay.wires.map((w) => ({ ...w, pts: w.pts.map(r3), group: g(w) })));
    out.plates.push(...lay.plates.map((p) => ({ ...p, outline: p.outline.map(r2), holes: p.holes.map((h) => h.map(r2)), group: g(p) })));
    out.links.push(...lay.links.map((l) => ({ a: r3(l.a), b: r3(l.b), group: g(l) })));
  }
  return out;
}

// The left half: everything drawn on the right copied across the centre line. Anything that already reaches across
// it (a centred plate, a stone on the line) stays as it is, once.
function mirrored(lay: Omit<Layout, "bounds">): Omit<Layout, "bounds"> {
  const flip3 = (p: THREE.Vector3) => v3(-p.x, p.y, p.z), flip2 = (p: THREE.Vector2) => new THREE.Vector2(-p.x, p.y);
  const right = (xs: number[], half = 0) => Math.min(...xs) - half > -0.3 && Math.max(...xs) > 0.3;
  const out: Omit<Layout, "bounds"> = { stones: [...lay.stones], wires: [...lay.wires], plates: [...lay.plates], links: [...lay.links] };
  for (const st of lay.stones) {
    // Half the stone's reach across: a stone sitting on the line would overlap its own copy.
    const half = Math.abs(Math.cos(st.angle)) * st.L / 2 + Math.abs(Math.sin(st.angle)) * st.W / 2;
    if (st.x - half > -0.05) out.stones.push({ ...st, x: -st.x, angle: Math.PI - st.angle, group: `${st.group}m` });
  }
  for (const w of lay.wires) if (right(w.pts.map((p) => p.x))) out.wires.push({ ...w, pts: w.pts.map(flip3).reverse(), group: `${w.group}m` });
  for (const p of lay.plates) if (right(p.outline.map((q) => q.x))) out.plates.push({ ...p, outline: p.outline.map(flip2).reverse(), holes: p.holes.map((h) => h.map(flip2).reverse()), group: `${p.group}m` });
  for (const l of lay.links) if (right([l.a.x, l.b.x])) out.links.push({ a: flip3(l.a), b: flip3(l.b), group: `${l.group}m` });
  return out;
}

export function layoutFreeform(f: Freeform): Layout {
  const curves = new Map(f.paths.map((p) => [p.id, { curve: pathCurve(p.points, p.closed), closed: p.closed }]));
  let all: Omit<Layout, "bounds"> = { stones: [], wires: [], plates: [], links: [] };
  for (const part of f.parts) {
    let lay: Omit<Layout, "bounds"> = { stones: [], wires: [], plates: [], links: [] };
    if (part.kind === "row" || part.kind === "wire" || part.kind === "plate") {
      const c = curves.get(part.path);
      if (!c) continue;
      if (part.kind === "row") lay = { ...lay, ...row(part, c.curve) };
      else if (part.kind === "wire") {
        const line = walk(c.curve, Math.min(part.from, part.to), Math.max(part.from, part.to), 120);
        lay.wires.push({ pts: line.map(({ p }) => v3(p.x, p.y, p.z + part.widthMm / 2)), r: part.widthMm / 2, finish: part.finish, group: "" });
      } else {
        const holes = part.holes.map((id) => curves.get(id)?.curve).filter((x): x is THREE.Curve<THREE.Vector3> => !!x);
        lay = { ...lay, ...plate(part, c.curve, holes) };
      }
    } else if (part.kind === "stone") {
      lay.stones.push({ gem: part.gem, color: part.color, cut: part.cut, shape: part.shape, x: part.at[0], y: part.at[1], h: part.at[2] ?? 0, L: part.lengthMm, W: part.widthMm, angle: Math.PI / 2 + (part.rotation * Math.PI) / 180, big: true, setting: part.setting, group: "" });
    } else {
      lay.links.push({ a: v3(part.a[0], part.a[1], part.a[2] ?? 0), b: v3(part.b[0], part.b[1], part.b[2] ?? 0), group: "" });
    }
    const g = String(f.parts.indexOf(part));
    for (const x of [...lay.stones, ...lay.wires, ...lay.plates, ...lay.links]) x.group = g;
    if (part.repeat) lay = turned(lay, part.repeat.count, [part.repeat.around[0], part.repeat.around[1]]);
    all = { stones: [...all.stones, ...lay.stones], wires: [...all.wires, ...lay.wires], plates: [...all.plates, ...lay.plates], links: [...all.links, ...lay.links] };
  }
  // Stones set on a plate sit on its surface, a little into it so their settings are part of it; the rail under a row
  // that runs over a plate rises with it.
  const plateUnder = (x: number, y: number) => all.plates.find((p) => inside(new THREE.Vector2(x, y), p.outline) && !p.holes.some((h) => inside(new THREE.Vector2(x, y), h)));
  for (const st of all.stones) {
    const under = plateUnder(st.x, st.y);
    if (under) st.h = Math.max(st.h, plateTop(under, st.x, st.y) - (st.big ? 0 : 0.35));
  }
  for (const w of all.wires) if (w.rail) for (const p of w.pts) { const under = plateUnder(p.x, p.y); if (under) p.z = Math.max(p.z, plateTop(under, p.x, p.y) - 0.35); }
  // Pavé leaves room for any larger stone set on the same plate.
  const own = all.stones.filter((s) => s.big || !all.plates.some((p) => p.group === s.group));
  all.stones = all.stones.filter((s) => s.big || !all.plates.some((p) => p.group === s.group) || !own.some((o) => o !== s && o.group !== s.group && Math.hypot(o.x - s.x, o.y - s.y) < (Math.max(o.L, o.W) + s.W) / 2 + 0.2));
  if (f.mirror) all = mirrored(all);
  const xs = [...all.stones.flatMap((s) => [s.x - s.L / 2, s.x + s.L / 2]), ...all.wires.flatMap((w) => w.pts.map((p) => p.x)), ...all.plates.flatMap((p) => p.outline.map((q) => q.x)), ...all.links.flatMap((l) => [l.a.x, l.b.x]), 0];
  const ys = [...all.stones.flatMap((s) => [s.y - s.L / 2, s.y + s.L / 2]), ...all.wires.flatMap((w) => w.pts.map((p) => p.y)), ...all.plates.flatMap((p) => p.outline.map((q) => q.y)), ...all.links.flatMap((l) => [l.a.y, l.b.y]), 0];
  return { ...all, bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) } };
}
