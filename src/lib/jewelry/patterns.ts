import * as THREE from "three";
import { type CenterStone, type Design, type Gem, estimateDims } from "../design";
import { outlineFn } from "../ringModel";
import { Y, v3 } from "./common";
import { type Mats } from "./materials";
import { setStone } from "./stones";
import { ASPECT, type Item, accents, backingPlate, balls } from "./elements";
import { wrap } from "./curves";

/* ================= accent patterns ================= */

/** the accent pattern's stones: width and length of each shape at the chosen carat weight */
function patternDims(d: Design, maxW?: number) {
  return d.accents.shapes.map((shape, i) => {
    const e = estimateDims(d.accents.gem, d.accents.cut, shape, d.accents.sizeCt);
    const w0 = e.widthMm * (d.accents.sizes[i] ?? 1);
    const W = maxW ? Math.min(w0, maxW) : w0;
    return { shape, W, L: W * ASPECT[shape] };
  });
}
export const patternMaxW = (d: Design, maxW?: number) => Math.max(...patternDims(d, maxW).map((x) => x.W));

export type RunOpts = {
  /** which way the stones face at curve param u (default up, +Y) */
  up?: (u: number) => THREE.Vector3;
  /** extra offset from the curve at u */
  offset?: (u: number) => THREE.Vector3;
  maxW?: number;
  gap?: number;
  /** a full loop: trim to whole repeats of the pattern so it meets itself cleanly */
  closed?: boolean;
  /** pick a gem for the stone at position i (stripes of two gems); default: the accent gem */
  gemAt?: (i: number) => { gem: Gem; color: string; cut: CenterStone["cut"]; shape?: CenterStone["shape"] } | null;
  /** called for every stone placed (e.g. to add a halo round each one) */
  onPlace?: (pos: THREE.Vector3, quat: THREE.Quaternion, W: number, L: number, shape: CenterStone["shape"]) => void;
};

/**
 * Lay the accent pattern along a curve between params from..to (to may exceed 1 to wrap a closed curve).
 * Honours the repeating shape list and the direction (along / across / alternate), spacing stones by their real footprint.
 */
export function patternRun(d: Design, m: Mats, curve: THREE.Curve<THREE.Vector3>, from: number, to: number, opts: RunOpts = {}) {
  const dims0 = patternDims(d, opts.maxW);
  // in a mix of shapes, a stone turned across the line is no wider than the line itself
  // (a baguette across between rounds is about as long as the rounds are wide)
  if (!opts.maxW && new Set(dims0.map((x) => x.shape)).size > 1) opts = { ...opts, maxW: Math.max(...dims0.map((x) => x.W)) };
  const dims = opts.maxW ? patternDims(d, opts.maxW) : dims0;
  const orient = d.accents.orientation;
  const along = (i: number) => orient === "along" || (orient === "alternate" && i % 2 === 0);
  const turnOf = (i: number) => THREE.MathUtils.degToRad(d.accents.turns[i % dims.length] ?? 0);
  // extent of a stone along the line and across it, once pointed along/across and given its own turn
  const ext = (s: (typeof dims)[number], i: number) => {
    const a = along(i) ? s.L : s.W, b = along(i) ? s.W : s.L, t = turnOf(i), c = Math.abs(Math.cos(t)), n = Math.abs(Math.sin(t));
    return { line: c * a + n * b, cross: c * b + n * a };
  };
  // stones turned across a narrow band are shrunk so they still fit it
  const fit = (s: (typeof dims)[number], i: number) => { const x = ext(s, i).cross; return opts.maxW && x > opts.maxW ? opts.maxW / x : 1; };
  const foot = (s: (typeof dims)[number], i: number) => ext(s, i).line * fit(s, i);
  const curveLen = curve.getLength();
  const total = curveLen * (to - from);
  const gap = opts.gap ?? Math.max(0.15, Math.min(...dims.map((x) => x.W)) * 0.08);
  const seq: typeof dims = [];
  for (let used = 0, i = 0; i < 2000; i++) {
    const s = dims[i % dims.length];
    if (used + foot(s, i) + (opts.closed ? gap : 0) > total) break;
    seq.push(s); used += foot(s, i) + gap;
  }
  if (opts.closed) {
    const cycle = orient === "alternate" && dims.length % 2 ? dims.length * 2 : dims.length;
    while (seq.length > cycle && seq.length % cycle) seq.pop();
  }
  const usedLen = seq.reduce((a, s, i) => a + foot(s, i), 0) + gap * Math.max(0, seq.length - (opts.closed ? 0 : 1));
  const spare = (total - usedLen) / Math.max(1, opts.closed ? seq.length : seq.length + 1);
  const byShape = new Map<string, Item[]>();
  let at = opts.closed ? 0 : spare;
  const basis = new THREE.Matrix4();
  seq.forEach((s, i) => {
    const f = foot(s, i);
    const u = wrap(from + (at + f / 2) / curveLen);
    const up = (opts.up?.(u) ?? Y).clone().normalize();
    const t = curve.getTangentAt(u);
    const tp = t.clone().addScaledVector(up, -t.dot(up)).normalize();
    const Z = along(i) ? tp : new THREE.Vector3().crossVectors(up, tp).normalize();
    const X = new THREE.Vector3().crossVectors(up, Z).normalize();
    basis.makeBasis(X, up, Z);
    const pos = curve.getPointAt(u).add(opts.offset?.(u) ?? new THREE.Vector3());
    const quat = new THREE.Quaternion().setFromRotationMatrix(basis).multiply(new THREE.Quaternion().setFromAxisAngle(Y, turnOf(i)));
    const cols = d.accents.colors;
    const gm = opts.gemAt?.(i) ?? (cols.length ? { gem: d.accents.gem, color: cols[i % cols.length], cut: d.accents.cut } : null);
    const shape = gm?.shape ?? s.shape;
    const key = `${shape}|${gm ? `${gm.gem}|${gm.color}|${gm.cut}` : ""}`;
    const push = (it: Item) => (byShape.get(key) ?? byShape.set(key, []).get(key)!).push(it);
    const dia = s.W * fit(s, i);
    if (d.accents.twins[i % dims.length]) {
      // two stones side by side across the line
      for (const k of [-1, 1]) push({ pos: pos.clone().addScaledVector(X, k * dia * 0.26), dia: dia * 0.48, quat });
    } else push({ pos, dia, quat });
    opts.onPlace?.(pos, quat, dia, dia * ASPECT[shape], shape);
    at += f + gap + spare;
  });
  const g = new THREE.Group();
  byShape.forEach((items, key) => {
    const [shape, gem, color, cut] = key.split("|");
    g.add(gem ? accents(m, gem as Gem, color, cut as CenterStone["cut"], items, shape as CenterStone["shape"]) : accents(m, d.accents.gem, d.accents.color, d.accents.cut, items, shape as CenterStone["shape"]));
  });
  return { group: g, maxW: Math.max(...dims.map((x) => x.W)), count: seq.length };
}

/**
 * The accent pattern at fixed spots (graduated climbers, stations, wings): shapes cycle through the pattern,
 * each spot keeps its own width, and elongated stones point along or across `tan`.
 */
export function patternAt(d: Design, m: Mats, spots: { pos: THREE.Vector3; dia: number; tan: THREE.Vector3; up?: THREE.Vector3 }[]) {
  const orient = d.accents.orientation;
  const byShape = new Map<string, Item[]>();
  const basis = new THREE.Matrix4();
  const cols = d.accents.colors;
  spots.forEach((sp, i) => {
    const shape0 = d.accents.shapes[i % d.accents.shapes.length];
    const shape = (cols.length ? `${shape0}|${cols[i % cols.length]}` : shape0) as CenterStone["shape"];
    const along = orient === "along" || (orient === "alternate" && i % 2 === 0);
    const up = (sp.up ?? Y).clone().normalize();
    const tp = sp.tan.clone().addScaledVector(up, -sp.tan.dot(up)).normalize();
    const Z = along ? tp : new THREE.Vector3().crossVectors(up, tp).normalize();
    basis.makeBasis(new THREE.Vector3().crossVectors(up, Z).normalize(), up, Z);
    const turn = THREE.MathUtils.degToRad(d.accents.turns[i % d.accents.shapes.length] ?? 0);
    (byShape.get(shape) ?? byShape.set(shape, []).get(shape)!).push({ pos: sp.pos, dia: sp.dia * (d.accents.sizes[i % d.accents.shapes.length] ?? 1), quat: new THREE.Quaternion().setFromRotationMatrix(basis).multiply(new THREE.Quaternion().setFromAxisAngle(Y, turn)) });
  });
  const g = new THREE.Group();
  byShape.forEach((items, key) => { const [shape, color] = key.split("|"); g.add(accents(m, d.accents.gem, color ?? d.accents.color, d.accents.cut, items, shape as CenterStone["shape"])); });
  return g;
}

/** a closed curve following a stone's outline, pushed outward by `gap` */
export function outlineCurve(c: CenterStone, gap: number, y: number) {
  const fn = outlineFn(c.shape, c.lengthMm, c.widthMm);
  const pts = Array.from({ length: 160 }, (_, i) => {
    const [x, z] = fn(i / 160); const r = Math.hypot(x, z) || 1; const k = (r + gap) / r;
    return v3(x * k, y, z * k);
  });
  return new THREE.CatmullRomCurve3(pts, true, "centripetal");
}

/** halo of accents around the main stone, on a gold rim */
export function halo(d: Design, m: Mats, c: CenterStone, rings = 1) {
  const g = new THREE.Group();
  const fn = outlineFn(c.shape, c.lengthMm, c.widthMm);
  const dia = patternMaxW(d);
  let gap = 0.45;
  for (let r = 0; r < rings; r++) {
    g.add(patternRun(d, m, outlineCurve(c, gap + dia / 2, -0.25), 0, 1, { closed: true, gap: 0.22 }).group);
    gap += dia + 0.3;
  }
  const r0 = Math.max(c.lengthMm, c.widthMm) / 2;
  g.add(backingPlate(m, fn, (r0 + gap) / r0, -0.35, 0.7));
  return { group: g, extent: gap };
}

/** kundan flower: centre stone, a ring of petal stones, a gold plate, optional enamel rim */
export function flower(d: Design, m: Mats, c: CenterStone, scale = 1) {
  const g = new THREE.Group();
  g.add(setStone(c, "bezel", m, scale));
  const R = (Math.max(c.lengthMm, c.widthMm) * scale) / 2;
  const petal = Math.max(1.4, R * 0.75);
  const n = Math.max(6, Math.round((2 * Math.PI * (R + petal / 2 + 0.5)) / (petal + 0.4)));
  const items: Item[] = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { pos: v3(Math.cos(a) * (R + petal / 2 + 0.6), -0.2, Math.sin(a) * (R + petal / 2 + 0.6)), dia: petal };
  });
  g.add(accents(m, d.accents.gem, d.accents.color, d.accents.gem === "diamond" ? "polki" : d.accents.cut, items));
  const outer = R + petal + 1.1;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(outer, outer, 0.8, 64), m.metal);
  plate.position.y = -0.75;
  g.add(plate);
  if (d.enamel.enabled) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(outer + 0.9, outer + 0.9, 0.5, 64), m.enamel);
    rim.position.y = -1.1;
    g.add(rim);
  }
  g.add(balls(m.metal, Array.from({ length: Math.round(outer * 4) }, (_, i) => { const a = (i / Math.round(outer * 4)) * Math.PI * 2; return { pos: v3(Math.cos(a) * outer, -0.4, Math.sin(a) * outer), dia: 0.45 }; })));
  return { group: g, radius: outer + (d.enamel.enabled ? 0.9 : 0) };
}

/** gold coin (temple jewellery): disc, beaded rim, raised centre */
export function coin(m: Mats, r: number) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.7, 48), m.metal);
  disc.position.y = -0.35;
  g.add(disc);
  g.add(balls(m.metal, Array.from({ length: Math.round(r * 7) }, (_, i) => { const a = (i / Math.round(r * 7)) * Math.PI * 2; return { pos: v3(Math.cos(a) * r * 0.86, 0.05, Math.sin(a) * r * 0.86), dia: 0.42 }; })));
  const boss = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), m.metal);
  boss.scale.y = 0.35;
  g.add(boss);
  return g;
}

/** jhumka bell lying on its side, opening toward +Z */
export function bell(d: Design, m: Mats, R: number) {
  const g = new THREE.Group();
  const prof = [[0.4, 0], [R * 0.3, R * 0.05], [R * 0.62, R * 0.25], [R * 0.86, R * 0.6], [R * 0.98, R * 1.0], [R, R * 1.12]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(prof, 64);
  const outer = new THREE.Mesh(geo, m.metal);
  const inner = new THREE.Mesh(geo, d.enamel.enabled ? m.enamel : m.metal);
  (inner.material as THREE.Material).side = THREE.BackSide;
  const inside = new THREE.Mesh(geo, inner.material.clone());
  (inside.material as THREE.Material).side = THREE.BackSide;
  g.add(outer, inside);
  // rim stones and ribs
  const rimR = R * 0.93 + 0.2;
  const rim = new THREE.CatmullRomCurve3(Array.from({ length: 96 }, (_, i) => { const a = (i / 96) * Math.PI * 2; return v3(Math.cos(a) * rimR, R * 0.82, Math.sin(a) * rimR); }), true);
  const rimRun = patternRun(d, m, rim, 0, 1, { closed: true, maxW: R * 0.25, gap: 0.3, up: (u) => rim.getPointAt(u).setY(0).normalize() });
  g.add(rimRun.group);
  const n = Math.max(12, rimRun.count);
  g.add(balls(m.metal, Array.from({ length: n * 2 }, (_, i) => { const a = (i / (n * 2)) * Math.PI * 2; return { pos: v3(Math.cos(a) * R, R * 1.12, Math.sin(a) * R), dia: 0.55 }; })));
  g.rotation.x = Math.PI / 2; // axis Y → Z (opening toward +Z)
  return { group: g, rimZ: R * 1.12, R };
}
