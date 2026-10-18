import * as THREE from "three";
import { NO_CHARACTER, type CenterStone, type Design, type DropPart } from "../design";
import { outlineFn } from "../ringModel";
import { COLORLESS, v3 } from "./common";
import { type Mats } from "./materials";
import { setStoneRaw, tube } from "./stones";
import { ASPECT, backingPlate, chainAlong, jumpRing } from "./elements";
import { outlineCurve, patternRun } from "./patterns";

const PAVE_CUTS = new Set(["faceted", "polki", "rose-cut"]);
const briolRatio = (shape: CenterStone["shape"], cut: CenterStone["cut"]) => (cut === "briolette" ? 2 : ASPECT[shape]);

function paveDesign(d: Design, p: DropPart): Design {
  const cut = PAVE_CUTS.has(p.small.cut) ? (p.small.cut as "faceted" | "polki" | "rose-cut") : "faceted";
  return { ...d, accents: { ...d.accents, gem: p.small.gem, color: p.small.color, cut, sizeCt: 6, shapes: [p.haloShape], orientation: "along", turns: [], colors: [] } };
}
function partStone(d: Design, p: DropPart): CenterStone {
  const short = Math.min(p.stone.widthMm, p.stone.lengthMm);
  const domeMm = p.stone.cut === "faceted" ? Math.max(p.stone.domeMm, short * 0.15) : p.stone.cut === "cabochon" ? Math.max(p.stone.domeMm, short * 0.32) : p.stone.domeMm;
  return { ...d.center, ...NO_CHARACTER, ...p.stone, domeMm, carat: null, label: "", photoPath: null, none: false, rotation: 0 };
}
function smallStone(d: Design, p: DropPart, shape: CenterStone["shape"]): CenterStone {
  const W = p.small.widthMm, cut = p.small.cut;
  return {
    ...d.center, ...NO_CHARACTER, gem: p.small.gem, cut, shape, widthMm: W, lengthMm: W * briolRatio(shape, cut), domeMm: cut === "cabochon" ? W * 0.4 : W * 0.16,
    color: p.small.color, clarity: COLORLESS.has(p.small.gem) ? 0.95 : 0.6, carat: null, label: "", photoPath: null, none: false, rotation: 0,
  };
}
// sizes run with the shapes (one per shape in the repeat); a longer list gives each stone its own size, spread over the count.
function sizeAt(p: DropPart, i: number, n: number, slot: number) {
  const z = p.small.sizes;
  if (!z.length) return 1;
  if (z.length <= p.small.shapes.length) return z[slot] ?? 1;
  const t = n > 1 ? (i / (n - 1)) * (z.length - 1) : 0, a = Math.floor(t), b = Math.min(z.length - 1, a + 1);
  return z[a] + (z[b] - z[a]) * (t - a);
}
const setFor = (d: Design, c: CenterStone, p?: DropPart) => (p && p.setting !== "auto" ? p.setting : c.cut === "cabochon" ? "bezel" : Math.max(c.lengthMm, c.widthMm) < 4.5 ? "four-claw" : d.setting.style);

type Built = { g: THREE.Group; top?: number; hang?: number };

// skirt: room left round the stone's edge for a row of small stones set on it by a later part, so drops hang outside that row.
type Skirt = { from: number; to: number; room: number }[];
function dropStonePart(d: Design, m: Mats, p: DropPart, skirt: Skirt = []): Built {
  const g = new THREE.Group();
  const cs = partStone(d, p);
  const theta = THREE.MathUtils.degToRad(p.stone.rotation);
  const core = new THREE.Group();
  let Lh = 1, Wh = 1;
  if (p.showStone) {
    core.add(setStoneRaw(cs, setFor(d, cs, p), m));
    Lh = cs.lengthMm / 2; Wh = cs.widthMm / 2;
    if (p.halo) {
      const pd = paveDesign(d, p);
      core.add(patternRun(pd, m, outlineCurve(cs, 0.35 + p.haloMm / 2, -0.25), 0, 1, { closed: true, gap: 0.16, maxW: p.haloMm }).group);
      const r0 = Math.max(Lh, Wh);
      core.add(backingPlate(m, outlineFn(cs.shape, cs.lengthMm, cs.widthMm), (r0 + p.haloMm + 0.5) / r0, -0.5, 0.6));
      Lh += p.haloMm + 0.45; Wh += p.haloMm + 0.45;
    }
  } else {
    core.add(new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), m.metal));
    // Stones set "on" a stone drawn by another part still sit round that stone's outline.
    Lh = cs.lengthMm / 2; Wh = cs.widthMm / 2;
  }
  core.rotation.y = theta;
  g.add(core);

  const n = p.count;
  if (n > 0) {
    const angles: number[] = [];
    const fan = (centre: number, k: number, step: number) => { for (let i = 0; i < k; i++) angles.push(centre + (i - (k - 1) / 2) * step); };
    if (p.arc) {
      const c0 = THREE.MathUtils.degToRad(p.arc.centerDeg), span = THREE.MathUtils.degToRad(p.arc.spanDeg);
      const full = p.arc.spanDeg >= 359;
      for (let i = 0; i < n; i++) angles.push(full ? c0 + (2 * Math.PI * i) / n : c0 + (n > 1 ? (i / (n - 1) - 0.5) * span : 0));
    } else if (p.arrange === "around") for (let i = 0; i < n; i++) angles.push(-Math.PI / 2 + (2 * Math.PI * i) / n);
    else if (p.arrange === "above") fan(-Math.PI / 2, n, Math.min(0.62, (Math.PI * 0.9) / Math.max(1, n - 1)));
    else if (p.arrange === "below") fan(Math.PI / 2, n, Math.min(0.62, (Math.PI * 0.9) / Math.max(1, n - 1)));
    else { const left = Math.ceil(n / 2); fan(Math.PI - 0.5, left, -0.48); fan(0.5, n - left, 0.48); }
    const rot = THREE.MathUtils.degToRad(p.small.rotation);
    angles.forEach((phi, i) => {
      const dir = v3(Math.cos(phi), 0, Math.sin(phi));
      const lx = dir.x * Math.cos(-theta) + dir.z * Math.sin(-theta), lz = -dir.x * Math.sin(-theta) + dir.z * Math.cos(-theta);
      const rEdge = 1 / Math.sqrt((lx / Wh) ** 2 + (lz / Lh) ** 2);
      const slot = i % p.small.shapes.length, shape = p.small.shapes[slot];
      const k = sizeAt(p, i, n, slot), base = smallStone(d, p, shape);
      const sc = k === 1 ? base : { ...base, widthMm: base.widthMm * k, lengthMm: base.lengthMm * k, domeMm: base.domeMm * k };
      const own = THREE.MathUtils.degToRad(p.small.turns[slot] ?? 0);
      const hangs = sc.cut === "briolette";
      const down = v3(0, 0, 1);
      // Briolettes hang under gravity: nearly straight down below the stone, swinging out a little more up its sides.
      const fall = hangs ? dir.clone().multiplyScalar(0.2 + 0.5 * (1 - Math.max(0, dir.z))).add(down).normalize() : dir;
      const turn = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
      const room = Math.max(0, ...skirt.map((k) => (k.to - k.from > 6.2 || (turn(phi - k.from) >= 0 && turn(k.to - phi) >= 0) ? k.room : 0)));
      const hangFrom = rEdge * 0.97 + room;
      // Packed tighter than they fit side by side, every other briolette drops into a second, lower tier.
      const step = n > 1 ? Math.abs(angles[Math.min(n - 1, i + 1)] - angles[Math.max(0, i - 1)]) / (i === 0 || i === n - 1 ? 1 : 2) : Math.PI;
      const tier = hangs && n >= 6 && sc.widthMm > hangFrom * step * 1.1 && i % 2 === 1 ? 1 : 0;
      const drop = tier * sc.lengthMm * 0.6;
      const pos = hangs ? dir.clone().multiplyScalar(hangFrom).addScaledVector(fall, sc.lengthMm * 0.45 + drop) : dir.clone().multiplyScalar(rEdge + 0.3 + sc.lengthMm / 2);
      if (drop) g.add(tube(m, [dir.clone().multiplyScalar(hangFrom).setY(-0.6), dir.clone().multiplyScalar(hangFrom).addScaledVector(fall, drop).setY(-0.6)], 0.16));
      const s = setStoneRaw(sc, setFor(d, sc), m);
      s.position.copy(pos).setY(hangs ? -0.6 - tier * 0.9 : -0.15);
      s.rotation.y = hangs ? Math.atan2(fall.x, fall.z) + Math.PI : Math.atan2(dir.x, dir.z) + (dir.x < -1e-6 ? -(rot + own) : rot + own);
      g.add(s);
      // A short wire behind the stones joins each one to the setting, out of sight from the front.
      g.add(tube(m, [dir.clone().multiplyScalar(rEdge * 0.95).setY(-1.5), dir.clone().multiplyScalar(hangs ? hangFrom : rEdge + 0.3 + sc.lengthMm / 2).setY(-1.5)], 0.14));
    });
  }
  return { g };
}

function dropStrandsPart(d: Design, m: Mats, p: DropPart): Built {
  const g = new THREE.Group();
  const n = Math.max(1, p.count);
  const spread = n > 1 ? p.spreadMm : 0;
  const barZ = (x: number) => (spread ? p.curveMm * (1 - 4 * (x / spread) ** 2) : 0);
  if (n > 1) {
    const bar = new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => { const x = (i / 24 - 0.5) * spread; return v3(x, -0.3, barZ(x)); }));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(bar, 60, 0.28, 8, false), m.metal));
    g.add(tube(m, [v3(0, -0.3, -1.6), v3(-spread / 2, -0.3, 0)], 0.22), tube(m, [v3(0, -0.3, -1.6), v3(spread / 2, -0.3, 0)], 0.22));
    if (p.barStones) {
      const pd = paveDesign(d, p);
      g.add(patternRun(pd, m, bar, 0, 1, { gap: 0.2, maxW: p.haloMm, offset: () => v3(0, 0.25, 0) }).group);
    }
  }
  const mid = (n - 1) / 2;
  let hang: number | undefined;
  for (let i = 0; i < n; i++) {
    if (p.openMiddle && n % 2 === 1 && i === mid) continue;
    const t = n > 1 ? i / (n - 1) - 0.5 : 0, x = t * spread;
    const k = Math.abs(t) * 2;
    const extra = (p.taper === "v" ? 1 - k : p.taper === "u" ? k : 0) * p.small.widthMm * 1.6;
    let z = barZ(x) + 0.3;
    g.add(jumpRing(m, 0.55, 0.16, v3(x, -0.3, z + 0.3)));
    z += 0.7;
    if (extra > 0.2) { g.add(tube(m, [v3(x, -0.3, z - 0.2), v3(x, -0.3, z + extra)], 0.16)); z += extra; }
    for (let j = 0; j < p.perStrand; j++) {
      const slot = j % p.small.shapes.length;
      const sc = smallStone(d, p, p.small.shapes[slot]);
      const s = setStoneRaw(sc, setFor(d, sc), m);
      const turn = THREE.MathUtils.degToRad(p.small.rotation + (p.small.turns[slot] ?? 0));
      s.rotation.y = turn;
      const tall = Math.abs(Math.cos(turn)) * sc.lengthMm + Math.abs(Math.sin(turn)) * sc.widthMm;
      s.position.set(x, 0, z + tall / 2);
      g.add(s);
      z += tall;
      if (j < p.perStrand - 1) { g.add(jumpRing(m, 0.45, 0.14, v3(x, -0.2, z + 0.35))); z += 0.7; }
    }
    if (Math.abs(i - mid) < 0.01) hang = z;
  }
  if (hang === undefined) { hang = barZ(0) + 0.5; g.add(jumpRing(m, 0.6, 0.16, v3(0, -0.3, hang))); }
  return { g, hang };
}

function dropFramePart(d: Design, m: Mats, p: DropPart): Built {
  const g = new THREE.Group();
  const cs = partStone(d, p);
  const r = p.halo ? p.haloMm / 2 + 0.35 : 0.55;
  const curve = outlineCurve(cs, p.showStone ? p.spreadMm + r : 0, 0);
  const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 200, r, 12, true), m.metal);
  wire.scale.y = 0.7;
  g.add(wire);
  if (p.halo) g.add(patternRun(paveDesign(d, p), m, curve, 0, 1, { closed: true, gap: 0.14, maxW: p.haloMm, offset: () => v3(0, r * 0.55, 0) }).group);
  if (p.showStone) {
    g.add(setStoneRaw(cs, setFor(d, cs, p), m));
    const fn = outlineFn(cs.shape, cs.lengthMm, cs.widthMm);
    for (const u of [0, 0.25, 0.5, 0.75]) { const [x, z] = fn(u); const len = Math.hypot(x, z) || 1; g.add(tube(m, [v3(x, -0.4, z), v3(x * (1 + (p.spreadMm + r) / len), -0.4, z * (1 + (p.spreadMm + r) / len))], 0.22)); }
  }
  g.rotation.y = THREE.MathUtils.degToRad(p.stone.rotation);
  return { g };
}

function dropBowPart(d: Design, m: Mats, p: DropPart): Built {
  const g = new THREE.Group();
  const w = Math.max(8, p.spreadMm), h = w * 0.55;
  const r = p.haloMm / 2 + 0.4;
  const pd = paveDesign(d, p);
  const curves: { c: THREE.Curve<THREE.Vector3>; closed: boolean }[] = [];
  for (const s of [-1, 1]) {
    const loop = [[0.03, 0], [0.18, -0.42], [0.4, -0.5], [0.5, -0.12], [0.42, 0.28], [0.18, 0.16]].map(([x, z]) => v3(s * x * w, 0, z * h));
    curves.push({ c: new THREE.CatmullRomCurve3(loop, true, "centripetal"), closed: true });
    const tail = [[0.04, 0.12], [0.12, 0.55], [0.2, 1.0], [0.26, 1.3]].map(([x, z]) => v3(s * x * w, -0.2, z * h));
    curves.push({ c: new THREE.CatmullRomCurve3(tail, false, "centripetal"), closed: false });
  }
  for (const { c, closed } of curves) {
    const t = new THREE.Mesh(new THREE.TubeGeometry(c, 160, r, 10, closed), m.metal);
    t.scale.y = 0.6;
    g.add(t);
    if (p.halo) g.add(patternRun(pd, m, c, 0, 1, { closed, gap: 0.14, maxW: p.haloMm, offset: () => v3(0, r * 0.5, 0) }).group);
    if (!closed) { const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m.metal); cap.scale.y = 0.6; cap.position.copy(c.getPointAt(1)); g.add(cap); }
  }
  const cs = partStone(d, p);
  let top = -1.2;
  if (p.showStone) {
    const knot = setStoneRaw(cs, setFor(d, cs, p), m);
    knot.rotation.y = THREE.MathUtils.degToRad(p.stone.rotation);
    knot.position.y = 0.35;
    g.add(knot, backingPlate(m, outlineFn(cs.shape, cs.lengthMm, cs.widthMm), 1.15, -0.3, 0.6));
    top = -cs.lengthMm / 2 - 0.3;
  } else {
    const k = new THREE.Mesh(new THREE.SphereGeometry(1.4, 18, 12), m.metal); k.scale.set(1, 0.7, 1.3); g.add(k);
  }
  return { g, top, hang: h * 0.2 };
}

export function dropStack(d: Design, m: Mats) {
  const group = new THREE.Group();
  const placed: { x: number; top: number; hang: number; half: number; origin: number }[] = [];
  const link = (p: DropPart, ax: number, az: number, bx: number, bz: number) => {
    const A = v3(ax, -0.3, az), B = v3(bx, -0.3, bz), len = A.distanceTo(B);
    if (p.link === "ring" && len < 3 && Math.abs(ax - bx) < 0.5) group.add(jumpRing(m, Math.max(0.7, len / 2 + 0.55), 0.2, A.clone().lerp(B, 0.5)));
    else if (p.link === "direct") group.add(tube(m, [A.clone().setY(-0.7).add(v3(0, 0, -0.6)), B.clone().setY(-0.7).add(v3(0, 0, 0.6))], 0.35));
    else {
      group.add(jumpRing(m, 0.6, 0.17, A), jumpRing(m, 0.6, 0.17, B));
      if (len > 1.2) group.add(chainAlong(new THREE.LineCurve3(A, B), "fine", m));
    }
  };
  const parentOf = (p: DropPart, i: number) => (i === 0 ? -1 : p.from >= 0 && p.from < i ? p.from : i - 1);
  const skirt: Skirt[] = d.drop.parts.map((_, i) => d.drop.parts.flatMap((q, j) => {
    if (!(j > i && q.kind === "stone" && q.anchor === "on" && !q.showStone && q.count > 0 && q.small.cut !== "briolette" && parentOf(q, j) === i)) return [];
    const room = q.small.widthMm * Math.max(1, ...q.small.sizes) + 0.6;
    if (!q.arc || q.arc.spanDeg >= 359) return [{ from: -Math.PI, to: Math.PI, room }];
    const c = THREE.MathUtils.degToRad(q.arc.centerDeg), half = THREE.MathUtils.degToRad(q.arc.spanDeg / 2 + 12);
    return [{ from: c - half, to: c + half, room }];
  }));
  d.drop.parts.forEach((p, i) => {
    const build = () => {
      const b = p.kind === "strands" ? dropStrandsPart(d, m, p) : p.kind === "frame" ? dropFramePart(d, m, p) : p.kind === "bow" ? dropBowPart(d, m, p) : dropStonePart(d, m, p, skirt[i]);
      b.g.userData.part = "drop";
      b.g.userData.dropIndex = i;
      return b;
    };
    const b = build();
    const box = new THREE.Box3().setFromObject(b.g);
    const top = b.top ?? box.min.z, hang = b.hang ?? box.max.z, half = (box.max.x - box.min.x) / 2;
    const parentIdx = parentOf(p, i);
    const par = parentIdx >= 0 ? placed[parentIdx] : null;
    const tilt = THREE.MathUtils.degToRad(p.tilt);
    const put = (g: THREE.Group, dir: 1 | -1) => {
      let x = 0, z0 = 0;
      if (par && p.anchor === "on") {
        x = par.x + p.offsetX * dir;
        z0 = par.origin + top + p.offsetZ;
      } else if (par && p.anchor === "beside") {
        const s = (p.side === "right" ? 1 : -1) * dir;
        x = par.x + s * (par.half + p.gapMm + half) + p.offsetX * dir;
        z0 = par.top + p.offsetZ;
        group.add(tube(m, [v3(par.x, -0.9, z0 + (hang - top) / 2), v3(x, -0.9, z0 + (hang - top) / 2)], 0.35));
      } else if (par) {
        x = par.x + p.offsetX * dir;
        z0 = par.hang + p.gapMm + p.offsetZ;
        link(p, par.x, par.hang, x, z0);
      } else { x = p.offsetX; z0 = p.offsetZ; }
      const pivot = new THREE.Group();
      pivot.position.set(x, 0, z0);
      pivot.rotation.y = -tilt * dir;
      g.position.z = -top;
      if (dir === -1) pivot.scale.x = -1;
      pivot.add(g);
      group.add(pivot);
      return { x, top: z0, hang: z0 + (hang - top) * Math.cos(tilt), half, origin: z0 - top };
    };
    placed[i] = put(b.g, 1);
    if (p.pair && i > 0) put(build().g, -1);
  });
  const all = new THREE.Box3().setFromObject(group);
  return { group, top: placed[0]?.top ?? 0, bottom: all.isEmpty() ? 0 : all.max.z };
}

export function hook(m: Mats, top: number) {
  const pts = [v3(0, -0.2, top + 0.6), v3(0, -0.2, top - 4), v3(-1.2, -0.2, top - 9), v3(-4.5, -0.2, top - 11), v3(-7.5, -0.2, top - 9), v3(-8.4, -0.2, top - 4), v3(-8.2, -0.2, top + 1)];
  const g = new THREE.Group();
  g.add(tube(m, pts, 0.38));
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), m.metal); bead.position.copy(pts[1]); g.add(bead);
  return g;
}
