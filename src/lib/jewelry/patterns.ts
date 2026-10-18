import * as THREE from "three";
import { type CenterStone, type Design, GEM_LOOK, type Gem, estimateDims } from "../design";
import { outlineFn } from "../ringModel";
import { Y, v3 } from "./common";
import { type Mats } from "./materials";
import { setStone } from "./stones";
import { ASPECT, type Item, accents, backingPlate, balls } from "./elements";
import { wrap } from "./curves";

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
  up?: (u: number) => THREE.Vector3;
  offset?: (u: number) => THREE.Vector3;
  maxW?: number;
  gap?: number;
  closed?: boolean;
  gemAt?: (i: number, pos: THREE.Vector3, count: number) => { gem: Gem; color: string; cut: CenterStone["cut"]; shape?: CenterStone["shape"]; turn?: number; scale?: number } | null;
  dome?: number;
  vary?: number;
  onPlace?: (pos: THREE.Vector3, quat: THREE.Quaternion, W: number, L: number, shape: CenterStone["shape"]) => void;
  fade?: "start" | "middle";
  editKey?: string;
};

export function ombreAt(stops: string[], t: number) {
  if (stops.length < 2) return stops[0] ?? "#ffffff";
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x));
  const c = new THREE.Color(stops[i]).lerp(new THREE.Color(stops[i + 1]), Math.round((x - i) * 6) / 6);
  return `#${c.getHexString()}`;
}

const SPINE = new Set(["round", "old-mine"]);

export function patternRun(d: Design, m: Mats, curve: THREE.Curve<THREE.Vector3>, from: number, to: number, opts: RunOpts = {}): { group: THREE.Group; maxW: number; count: number; path?: THREE.Curve<THREE.Vector3> } {
  if (d.accents.layout === "wave") {
    const W = patternMaxW(d, opts.maxW), len = curve.getLength();
    const A = Math.max(1.4, W * 0.7), lam = len / Math.max(1, Math.round(len / Math.max(42, W * 14)));
    const closed = (curve as THREE.CatmullRomCurve3).closed ?? false;
    const n = 720, pts: THREE.Vector3[] = [];
    for (let i = 0; i < (closed ? n : n + 1); i++) {
      const u = i / n, t = curve.getTangentAt(u), up = (opts.up?.(u) ?? Y).clone().normalize();
      const side = new THREE.Vector3().crossVectors(up, t).normalize();
      pts.push(curve.getPointAt(u).addScaledVector(side, A * Math.sin((2 * Math.PI * u * len) / lam)));
    }
    const path = new THREE.CatmullRomCurve3(pts, closed, "centripetal");
    const run = patternRun({ ...d, accents: { ...d.accents, layout: "line" } }, m, path, from, to, { ...opts, gap: Math.min(opts.gap ?? 0.2, 0.2) });
    return { ...run, path };
  }
  const dims0 = patternDims(d, opts.maxW);
  if (!opts.maxW && new Set(dims0.map((x) => x.shape)).size > 1) opts = { ...opts, maxW: Math.max(...dims0.map((x) => x.W)) };
  const dims = opts.maxW ? patternDims(d, opts.maxW) : dims0;
  const orient = d.accents.orientation;
  const along = (i: number) => orient === "along" || (orient === "alternate" && i % 2 === 0);
  const turnOf = (i: number) => THREE.MathUtils.degToRad(d.accents.turns[i % dims.length] ?? 0);
  const ext = (s: (typeof dims)[number], i: number) => {
    const a = along(i) ? s.L : s.W, b = along(i) ? s.W : s.L, t = turnOf(i), c = Math.abs(Math.cos(t)), n = Math.abs(Math.sin(t));
    return { line: c * a + n * b, cross: c * b + n * a };
  };
  const fit = (s: (typeof dims)[number] & { edited?: boolean }, i: number) => { const x = ext(s, i).cross; return !s.edited && opts.maxW && x > opts.maxW ? opts.maxW / x : 1; };
  const prefix = opts.editKey ? `${opts.editKey}:` : null;
  const edits = new Map(prefix ? d.stoneEdits.filter((e) => e.key.startsWith(prefix)).map((e) => [Number(e.key.slice(prefix.length)), e] as const) : []);
  const withEdit = (s: (typeof dims)[number], i: number) => {
    const e = edits.get(i);
    if (!e || (e.shape === undefined && e.scale === undefined)) return s;
    const shape = e.shape ?? s.shape, W = s.W * fit(s, i) * (e.scale ?? 1);
    return { shape, W, L: W * ASPECT[shape], edited: true };
  };
  const layout = d.accents.layout;
  const onSpine = (s: (typeof dims)[number]) => SPINE.has(s.shape) && dims.some((x) => !SPINE.has(x.shape));
  const foot = (s: (typeof dims)[number], i: number) => ext(s, i).line * fit(s, i) * (layout === "garland" && !onSpine(s) ? 0.46 : 1);
  const curveLen = curve.getLength();
  const total = curveLen * (to - from);
  const gap = opts.gap ?? Math.max(0.15, Math.min(...dims.map((x) => x.W)) * 0.08);
  const seq: typeof dims = [];
  for (let used = 0, i = 0; i < 2000; i++) {
    const s = withEdit(dims[i % dims.length], i);
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
  const spineW = Math.max(0, ...dims.filter((x) => onSpine(x)).map((x) => x.W));
  let leaf = 0, seed = 29;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
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
    let yaw = turnOf(i);
    if (layout !== "line") {
      const side = new THREE.Vector3().crossVectors(up, tp).normalize();
      const s0 = at + f / 2;
      if (!onSpine(s)) {
        const sign = (leaf++ % 2 ? -1 : 1);
        pos.addScaledVector(side, sign * (s.W * 0.42 + spineW * 0.3));
        yaw -= sign * 0.62;
      }
    }
    const quat = new THREE.Quaternion().setFromRotationMatrix(basis).multiply(new THREE.Quaternion().setFromAxisAngle(Y, yaw));
    const cols = d.accents.colors, fadeCols = d.accents.ombre;
    const pos01 = seq.length > 1 ? i / (seq.length - 1) : 0;
    const fadeT = opts.fade === "start" ? pos01 : opts.closed ? 2 * Math.min(pos01, 1 - pos01) : Math.abs(pos01 - 0.5) * 2;
    const gm = opts.gemAt?.(i, pos, seq.length) ?? (fadeCols.length ? { gem: d.accents.gem, color: ombreAt(fadeCols, fadeT), cut: d.accents.cut } : cols.length ? { gem: d.accents.gem, color: cols[i % cols.length], cut: d.accents.cut } : null);
    const ed = edits.get(i);
    const look = ed && (ed.gem || ed.color || ed.cut)
      ? { gem: ed.gem ?? gm?.gem ?? d.accents.gem, color: ed.color ?? (ed.gem ? GEM_LOOK[ed.gem].color : gm?.color ?? d.accents.color), cut: ed.cut ?? gm?.cut ?? d.accents.cut }
      : gm;
    const shape = ed?.shape ?? gm?.shape ?? s.shape;
    const key = `${shape}|${look ? `${look.gem}|${look.color}|${look.cut}` : ""}`;
    const push = (it: Item) => (byShape.get(key) ?? byShape.set(key, []).get(key)!).push(it);
    const turn = gm && "turn" in gm ? gm.turn : undefined;
    if (turn) quat.multiply(new THREE.Quaternion().setFromAxisAngle(Y, THREE.MathUtils.degToRad(turn)));
    const vary = opts.vary ?? 0;
    if (vary && !turn) quat.multiply(new THREE.Quaternion().setFromAxisAngle(Y, (rnd() * 2 - 1) * vary * 1.6));
    const dia = s.W * fit(s, i) * (gm && "scale" in gm ? gm.scale ?? 1 : 1) * (vary ? 1 + (rnd() * 2 - 1) * vary * 0.6 : 1);
    const stretch = vary && !turn ? 1 + (rnd() * 2 - 1) * vary : undefined;
    if (d.accents.twins[i % dims.length]) {
      for (const k of [-1, 1]) push({ pos: pos.clone().addScaledVector(X, k * dia * 0.26), dia: dia * 0.48, quat });
    } else push({ pos, dia, quat, stretch, ...(prefix ? { key: `${prefix}${i}` } : {}) });
    opts.onPlace?.(pos, quat, dia, dia * ASPECT[shape], shape);
    at += f + gap + spare;
  });
  const g = new THREE.Group();
  byShape.forEach((items, key) => {
    const [shape, gem, color, cut] = key.split("|");
    g.add(gem ? accents(m, gem as Gem, color, cut as CenterStone["cut"], items, shape as CenterStone["shape"], opts.dome) : accents(m, d.accents.gem, d.accents.color, d.accents.cut, items, shape as CenterStone["shape"], opts.dome));
  });
  return { group: g, maxW: Math.max(...dims.map((x) => x.W)), count: seq.length };
}

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

export function outlineCurve(c: CenterStone, gap: number, y: number) {
  const fn = outlineFn(c.shape, c.lengthMm, c.widthMm);
  const pts = Array.from({ length: 160 }, (_, i) => {
    const [x, z] = fn(i / 160); const r = Math.hypot(x, z) || 1; const k = (r + gap) / r;
    return v3(x * k, y, z * k);
  });
  return new THREE.CatmullRomCurve3(pts, true, "centripetal");
}

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
  const rimR = R * 0.93 + 0.2;
  const rim = new THREE.CatmullRomCurve3(Array.from({ length: 96 }, (_, i) => { const a = (i / 96) * Math.PI * 2; return v3(Math.cos(a) * rimR, R * 0.82, Math.sin(a) * rimR); }), true);
  const rimRun = patternRun(d, m, rim, 0, 1, { closed: true, maxW: R * 0.25, gap: 0.3, up: (u) => rim.getPointAt(u).setY(0).normalize() });
  g.add(rimRun.group);
  const n = Math.max(12, rimRun.count);
  g.add(balls(m.metal, Array.from({ length: n * 2 }, (_, i) => { const a = (i / (n * 2)) * Math.PI * 2; return { pos: v3(Math.cos(a) * R, R * 1.12, Math.sin(a) * R), dia: 0.55 }; })));
  g.rotation.x = Math.PI / 2;
  return { group: g, rimZ: R * 1.12, R };
}
