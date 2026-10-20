import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { type CenterStone, type Design, NO_CHARACTER, SHAPE_RATIO, ringInnerDiameter } from "../design";
import { type Piece, Y, v3 } from "../jewelry/common";
import { type Mats } from "../jewelry/materials";
import { type Item, accents, balls, chainAlong } from "../jewelry/elements";
import { setStone, tube } from "../jewelry/stones";
import { loopCurve, outwardAt, wrap } from "../jewelry/curves";
import { stoneNeckline } from "../jewelry/festoon";
import { bandSection, shankGeo } from "../ringModel";
import { type Layout, type LaidStone, layoutFreeform, plateTop } from "./layout";

// Builds a freeform design in 3D: the flat layout is carried onto the body (round the neckline, hanging from the
// ear, or wrapped over the top of a ring), and made of the app's usual settings, wire, chain and metal.

// Where a point of the flat drawing goes in 3D, and which way its x, y and "up" point there.
type Frame = {
  at: (x: number, y: number, h: number) => THREE.Vector3;
  axes: (x: number, y: number) => { X: THREE.Vector3; Yd: THREE.Vector3; up: THREE.Vector3 };
};

const earFrame: Frame = { at: (x, y, h) => v3(x, h, y), axes: () => ({ X: v3(1, 0, 0), Yd: v3(0, 0, 1), up: Y.clone() }) };

function neckFrame(curve: THREE.Curve<THREE.Vector3>, front: number): Frame {
  const total = curve.getLength();
  const right0 = new THREE.Vector3().crossVectors(Y, outwardAt(curve, front));
  const sgn = Math.sign(curve.getTangentAt(front).dot(right0)) || 1;
  // Across runs along the neckline itself, so a wide piece follows its curve; down runs away from the neck.
  const u = (x: number) => wrap(front + (sgn * x) / total);
  return {
    at: (x, y, h) => curve.getPointAt(u(x)).addScaledVector(outwardAt(curve, u(x)), y).add(v3(0, h, 0)),
    axes: (x) => { const out = outwardAt(curve, u(x)); return { X: new THREE.Vector3().crossVectors(Y, out).normalize(), Yd: out, up: Y.clone() }; },
  };
}

// A ring's top, wrapped round the band: across the drawing runs round the finger (so a wide design reaches down the
// shoulders), down the drawing runs along the finger, and up is away from the finger.
function ringFrame(d: Design): Frame {
  const RIN = ringInnerDiameter(d.ringSize) / 2;
  const surf = (a: number) => RIN + bandSection(d.band.widthMm, a, undefined, d.band.shape, RIN).t;
  const R0 = surf(0);
  return {
    at: (x, y, h) => { const a = x / R0, r = surf(a) - 0.05 + h; return v3(r * Math.sin(a), r * Math.cos(a), y); },
    axes: (x) => { const a = x / R0; return { X: v3(Math.cos(a), -Math.sin(a), 0), Yd: v3(0, 0, 1), up: v3(Math.sin(a), Math.cos(a), 0) }; },
  };
}

// The turn that sets a stone flat on the surface with its length running the way the drawing says.
function stoneTurn(f: Frame, st: Pick<LaidStone, "x" | "y" | "angle">) {
  const { X, Yd, up } = f.axes(st.x, st.y);
  const Z = X.clone().multiplyScalar(Math.cos(st.angle)).addScaledVector(Yd, Math.sin(st.angle));
  Z.addScaledVector(up, -Z.dot(up)).normalize();
  const Xs = new THREE.Vector3().crossVectors(up, Z).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(Xs, up, Z));
}

// Splits each triangle into four until none is longer than `max` mm, so a domed or wrapped plate bends smoothly. The
// shape's points are welded first and every edge is split once, shared by the triangles either side of it, so the
// plate stays one closed solid.
export function finer(geo: THREE.BufferGeometry, max: number) {
  const g0 = new THREE.BufferGeometry();
  g0.setAttribute("position", geo.getAttribute("position").clone());
  if (geo.index) g0.setIndex(geo.index.clone());
  const welded = mergeVertices(g0, 1e-3);
  const pos = Array.from(welded.getAttribute("position").array as ArrayLike<number>);
  let idx = Array.from(welded.index!.array as ArrayLike<number>);
  const len = (a: number, b: number) => Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2]);
  for (let pass = 0; pass < 5; pass++) {
    let longest = 0;
    for (let t = 0; t < idx.length; t += 3) longest = Math.max(longest, len(idx[t], idx[t + 1]), len(idx[t + 1], idx[t + 2]), len(idx[t + 2], idx[t]));
    if (longest <= max || idx.length * 4 > 1_200_000) break;
    const mids = new Map<string, number>();
    const mid = (a: number, b: number) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      let m = mids.get(key);
      if (m === undefined) { m = pos.length / 3; pos.push((pos[a * 3] + pos[b * 3]) / 2, (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2, (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2); mids.set(key, m); }
      return m;
    };
    const next: number[] = [];
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    idx = next;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(Float32Array.from(pos), 3));
  g.setIndex(idx);
  // Built as one closed solid: the CAD export takes it as it is.
  g.userData.closed = true;
  return g;
}

function plateMesh(f: Frame, pl: Layout["plates"][number], m: Mats) {
  const shape = new THREE.Shape(pl.outline);
  shape.holes = pl.holes.map((h) => new THREE.Path(h));
  const flat = new THREE.ExtrudeGeometry(shape, { depth: pl.thickness, bevelEnabled: false, curveSegments: 1 });
  const geo = finer(flat, 1.6);
  flat.dispose();
  const p = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = z > pl.thickness - 1e-4 ? plateTop(pl, x, y) : z;
    p.setXYZ(i, ...f.at(x, y, h).toArray());
  }
  // The flat drawing is mirror-handed (x across, y down, h up); where the carry onto the body turns it inside out,
  // the faces are turned back round so the plate is a proper solid.
  const index = geo.index!;
  let vol = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < index.count; i += 3) { a.fromBufferAttribute(p, index.getX(i)); b.fromBufferAttribute(p, index.getX(i + 1)); c.fromBufferAttribute(p, index.getX(i + 2)); vol += a.dot(b.clone().cross(c)); }
  if (vol < 0) for (let i = 0; i < index.count; i += 3) { const t = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, t); }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, m.metal);
  const g = new THREE.Group();
  g.add(mesh);
  if (pl.milgrain) {
    const ring = [pl.outline, ...pl.holes], items: Item[] = [];
    // Beads every 0.42 mm round the top edge of the plate and of each cut-out.
    for (const r of ring) {
      let next = 0, run = 0;
      for (let i = 0; i < r.length; i++) {
        const q = r[i], n = r[(i + 1) % r.length], seg = q.distanceTo(n);
        while (next <= run + seg) { const pt = q.clone().lerp(n, seg ? (next - run) / seg : 0); items.push({ pos: f.at(pt.x, pt.y, plateTop(pl, pt.x, pt.y)), dia: 0.4 }); next += 0.42; }
        run += seg;
      }
    }
    if (items.length) g.add(balls(m.metal, items.slice(0, 4000)));
  }
  return g;
}

function wireMesh(f: Frame, w: Layout["wires"][number], m: Mats) {
  const lift = w.rail ? -w.r * 0.6 : 0;
  const pts = w.pts.map((p) => f.at(p.x, p.y, p.z + lift));
  const g = new THREE.Group();
  if (pts.length < 2 || pts.reduce((a, p, i) => (i ? a + p.distanceTo(pts[i - 1]) : 0), 0) < 0.3) return g;
  g.add(tube(m, pts, w.r));
  if (w.finish === "milgrain" || w.finish === "rope") {
    const curve = new THREE.CatmullRomCurve3(pts), len = curve.getLength(), items: Item[] = [];
    const step = w.finish === "milgrain" ? w.r * 1.5 : w.r * 0.9;
    for (let s = step / 2; s < len; s += step) {
      const u = s / len, p = curve.getPointAt(u), q = w.pts[Math.min(w.pts.length - 1, Math.round(u * (w.pts.length - 1)))];
      const { up } = f.axes(q.x, q.y);
      items.push({ pos: p.addScaledVector(up, w.r * 0.75), dia: w.finish === "milgrain" ? w.r * 1.25 : w.r * 0.9 });
    }
    g.add(balls(m.metal, items.slice(0, 4000)));
  }
  return g;
}

function stonesMesh(f: Frame, stones: LaidStone[], d: Design, m: Mats) {
  const g = new THREE.Group();
  const small = new Map<string, Item[]>();
  for (const st of stones) {
    const pos = f.at(st.x, st.y, st.h), quat = stoneTurn(f, st);
    if (st.big) {
      const c: CenterStone = { ...d.center, ...NO_CHARACTER, gem: st.gem, color: st.color, cut: st.cut, shape: st.shape, lengthMm: st.L, widthMm: st.W, domeMm: st.cut === "cabochon" ? st.W * 0.4 : Math.min(st.L, st.W) * 0.16, carat: null, label: "", photoPath: null, none: false, rotation: 0 };
      const s = setStone(c, st.setting === "bezel" ? "bezel" : "four-claw", m);
      s.position.copy(pos); s.quaternion.copy(quat);
      g.add(s);
      continue;
    }
    const key = `${st.gem}|${st.color}|${st.cut}|${st.shape}`;
    const stretch = st.L / st.W / (SHAPE_RATIO[st.shape] ?? 1);
    (small.get(key) ?? small.set(key, []).get(key)!).push({ pos, dia: st.W, quat, ...(Math.abs(stretch - 1) > 0.02 ? { stretch } : {}) });
  }
  for (const [key, items] of small) {
    const [gem, color, cut, shape] = key.split("|") as [CenterStone["gem"], string, CenterStone["cut"], CenterStone["shape"]];
    g.add(accents(m, gem, color, cut, items, shape));
  }
  return g;
}

function linkMesh(f: Frame, l: Layout["links"][number], m: Mats) {
  const a = f.at(l.a.x, l.a.y, l.a.z), b = f.at(l.b.x, l.b.y, l.b.z);
  // A short link is a solid bail; a longer drop hangs on a fine chain.
  if (a.distanceTo(b) > 8) return chainAlong(new THREE.LineCurve3(a, b), "cable", m);
  return tube(m, [a, b], 0.45);
}

// Where the drawing meets a line of stones or a chain round the neck, a short gold post runs from the neckline's rail into
// the part, as a bench jeweller solders the front to the neckline, so the two are one piece rather than just touching.
function neckPosts(f: Frame, lay: Layout, n: Design["freeform"]["neckline"], m: Mats) {
  const g = new THREE.Group();
  const pitch = n.kind === "stones" ? n.sizeMm + 0.3 : 0, rows = n.kind === "stones" ? n.rows : 1;
  const railY = n.kind === "stones" ? -Math.max(0.35, n.sizeMm * 0.05) * 0.6 : 0;
  const reach = (rows - 1) * pitch + (n.kind === "stones" ? n.sizeMm / 2 : 0) + 0.6;
  const post = (x: number, y: number, h: number) => {
    const row = Math.max(0, Math.min(rows - 1, Math.round(y / (pitch || 1))));
    g.add(tube(m, [f.at(x, row * pitch, railY), f.at(x, y, h)], 0.5));
  };
  for (const p of lay.plates) {
    const near = p.outline.filter((q) => q.y <= reach);
    if (!near.length) continue;
    // Two posts across the width of what touches, a little inside the plate.
    const xs = near.map((q) => q.x), lo = Math.min(...xs), hi = Math.max(...xs);
    for (const x of hi - lo > 3 ? [lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.75] : [(lo + hi) / 2]) {
      const top = Math.min(...near.filter((q) => Math.abs(q.x - x) < Math.max(1, (hi - lo) / 2)).map((q) => q.y));
      post(x, Math.max(top + 0.8, 0), p.thickness / 2);
    }
  }
  const touching = lay.stones.filter((s) => s.y - Math.max(s.L, s.W) / 2 <= reach);
  for (const s of touching) if (s.big || touching.indexOf(s) % 6 === 0) post(s.x, s.y, s.h - 0.3);
  for (const l of lay.links) for (const e of [l.a, l.b]) if (e.y <= reach) post(e.x, e.y, e.z);
  for (const w of lay.wires) for (const e of [w.pts[0], w.pts[w.pts.length - 1]]) if (e && e.y <= reach) post(e.x, e.y, e.z);
  return g;
}

export function buildLayout(f: Frame, lay: Layout, d: Design, m: Mats) {
  const g = new THREE.Group();
  g.userData.part = "motif";
  for (const pl of lay.plates) g.add(plateMesh(f, pl, m));
  for (const w of lay.wires) g.add(wireMesh(f, w, m));
  for (const l of lay.links) g.add(linkMesh(f, l, m));
  g.add(stonesMesh(f, lay.stones, d, m));
  return g;
}

// The other earring: the whole layout turned over left to right.
function flipped(lay: Layout): Layout {
  const f3 = (p: THREE.Vector3) => v3(-p.x, p.y, p.z), f2 = (p: THREE.Vector2) => new THREE.Vector2(-p.x, p.y);
  return {
    stones: lay.stones.map((s) => ({ ...s, x: -s.x, angle: Math.PI - s.angle })),
    wires: lay.wires.map((w) => ({ ...w, pts: w.pts.map(f3) })),
    plates: lay.plates.map((p) => ({ ...p, outline: p.outline.map(f2).reverse(), holes: p.holes.map((h) => h.map(f2).reverse()) })),
    links: lay.links.map((l) => ({ ...l, a: f3(l.a), b: f3(l.b) })),
    bounds: { ...lay.bounds, minX: -lay.bounds.maxX, maxX: -lay.bounds.minX },
  };
}

function earFinding(f: Frame, top: Design["freeform"]["top"], m: Mats) {
  const g = new THREE.Group();
  if (top === "hook") {
    g.add(tube(m, [f.at(0, 0.5, 0.4), f.at(0, -4, 0.6), f.at(0, -9, -2), f.at(0, -9.5, -7), f.at(0, -5, -11)], 0.42));
  } else {
    // A pad behind the top of the piece and a post through the ear (the butterfly back is bought, not cast).
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.7, 24), m.metal);
    pad.position.copy(f.at(0, 1.5, -0.35));
    g.add(pad, tube(m, [f.at(0, 1.5, -0.3), f.at(0, 1.5, -11)], 0.42));
  }
  return g;
}

function framed(group: THREE.Group, upright: boolean): Piece {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  return { group, focus: box.getCenter(new THREE.Vector3()), focusSize: Math.max(20, Math.max(size.x, size.y, size.z) * 1.5), upright };
}

export function freeformPiece(d: Design, m: Mats): Piece {
  const f = d.freeform, lay = layoutFreeform(f);
  const group = new THREE.Group();
  if (d.type === "ring") {
    const RIN = ringInnerDiameter(d.ringSize) / 2;
    const band = new THREE.Mesh(shankGeo(RIN, d.band.widthMm, d.band.finish, undefined, d.band.shape, d.band.split), m.metal);
    band.userData.shank = true;
    group.add(band, buildLayout(ringFrame(d), lay, d, m));
    return framed(group, true);
  }
  if (d.type === "earrings") {
    const gap = Math.max(18, lay.bounds.maxX - lay.bounds.minX + 12);
    for (const side of [1, -1]) {
      const one = new THREE.Group();
      one.add(buildLayout(earFrame, side > 0 ? lay : flipped(lay), d, m), earFinding(earFrame, f.top, m));
      one.position.x = (side * gap) / 2;
      group.add(one);
    }
    return framed(group, false);
  }
  // Necklaces (and anything else worn on a loop): the drawing hangs from the centre front of the neckline.
  const { curve, front } = loopCurve(d.options.lengthIn * 25.4, 0.85, 0.12);
  if (f.neckline.kind === "stones") {
    group.add(stoneNeckline(d, m, curve, front, { ...f.neckline, widthMm: f.neckline.sizeMm }, "freeformNeck", "freeform", f.neckline.rows).group);
  } else if (f.neckline.kind === "chain") group.add(chainAlong(curve, d.options.chain, m));
  const frame = neckFrame(curve, front);
  const piece = buildLayout(frame, lay, d, m);
  if (f.neckline.kind !== "none") piece.add(neckPosts(frame, lay, f.neckline, m));
  group.add(piece);
  const p = framed(piece, false);
  return { group, focus: p.focus, focusSize: p.focusSize, upright: false };
}
