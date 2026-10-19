import { geometryCache } from "../cache";
import * as THREE from "three";
import { BEAD_GEMS, type CenterStone, type Design, type Gem, SHAPE_RATIO } from "../design";
import { type OutlineFn, clawDegrees, outlineFn } from "../ringModel";
import { Y, v3 } from "./common";
import { type Mats } from "./materials";
import { cutGeometry, isColorless } from "./stones";

export type Item = { pos: THREE.Vector3; dia: number; up?: THREE.Vector3; yaw?: number; quat?: THREE.Quaternion; stretch?: number; key?: string };

export function orient(o: THREE.Object3D, it: Item) {
  o.position.copy(it.pos);
  if (it.quat) o.quaternion.copy(it.quat);
  else { o.quaternion.setFromUnitVectors(Y, it.up ?? Y); o.rotateY(it.yaw ?? 0); }
  o.scale.set(it.dia, it.dia, it.dia * (it.stretch ?? 1));
  o.updateMatrix();
}

const rimGeometry = geometryCache(200);
function shapedRim(shape: CenterStone["shape"], asp: number, r: number) {
  return rimGeometry(`${shape}|${asp}|${r}`, () => {
    const fn = outlineFn(shape, asp, 1);
    const pts = Array.from({ length: 64 }, (_, i) => { const [x, z] = fn(i / 64); const k = 1 + 0.06 / Math.max(0.2, Math.hypot(x, z)); return v3(x * k, 0, z * k); });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, "centripetal"), 96, r, 6, true);
  });
}

function prongAt(shape: CenterStone["shape"], asp: number, k: number): [number, number] {
  const degs = clawDegrees(shape, asp, 1, "four-claw");
  const fn = outlineFn(shape, asp, 1);
  const deg = degs.length >= 4 ? degs[Math.floor((k * degs.length) / 4)] : 45 + k * 90;
  const [x, z] = fn(deg / 360);
  return [x * 1.02, z * 1.02];
}

export const ASPECT = SHAPE_RATIO;

export function accents(m: Mats, gem: Gem, color: string, cutIn: CenterStone["cut"], items: Item[], shape: CenterStone["shape"] = "round", dome = 0.42, rim = true) {
  const g = new THREE.Group();
  g.userData.part = "accents";
  if (!items.length) return g;
  const o = new THREE.Object3D();
  if (cutIn === "cabochon" || cutIn === "carved") {
    const asp0 = ASPECT[shape];
    const meshes = [
      new THREE.InstancedMesh(cutGeometry(cutIn, shape, asp0, 1, dome), BEAD_GEMS.has(gem) ? m.bead(gem, color) : m.stone({ gem, cut: cutIn, color, clarity: 0.72 }, 1), items.length),
      new THREE.InstancedMesh(shapedRim(shape, asp0, 0.06), m.metal, items.length),
    ];
    items.forEach((it, i) => { orient(o, it); meshes.forEach((x) => x.setMatrixAt(i, o.matrix)); });
    meshes.forEach((x) => g.add(x));
    return tagKeys(g, items);
  }
  if (cutIn === "bead") {
    g.userData.strung = true;
    const im = new THREE.InstancedMesh(cutGeometry("bead", shape, ASPECT[shape], 1, 0.5), BEAD_GEMS.has(gem) ? m.bead(gem, color) : m.stone({ gem, cut: "bead", color, clarity: 0.45 }, 1), items.length);
    items.forEach((it, i) => { orient(o, it); im.setMatrixAt(i, o.matrix); });
    g.add(im);
    return tagKeys(g, items);
  }
  if (cutIn === "briolette" && !BEAD_GEMS.has(gem)) {
    g.userData.strung = true;
    const geo = cutGeometry("briolette", shape, ASPECT[shape], 1, 0.5);
    const colorless = isColorless(gem, color);
    const tint = colorless ? 0xf2f5ff : new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.1);
    const meshes = [
      new THREE.InstancedMesh(geo, m.mirror(tint, 3.6), items.length),
      new THREE.InstancedMesh(geo, colorless ? m.skin : m.stone({ gem, cut: "briolette", color, clarity: 0.5 }, 1), items.length),
    ];
    items.forEach((it, i) => { orient(o, it); meshes.forEach((x) => x.setMatrixAt(i, o.matrix)); });
    meshes.forEach((x) => g.add(x));
    return tagKeys(g, items);
  }
  const cut: "faceted" | "polki" | "rose-cut" = cutIn === "polki" || cutIn === "rose-cut" ? cutIn : "faceted";
  if (BEAD_GEMS.has(gem)) {
    g.userData.strung = true;
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 20, 14), m.bead(gem, color), items.length);
    items.forEach((it, i) => { orient(o, it); im.setMatrixAt(i, o.matrix); });
    g.add(im);
    return tagKeys(g, items);
  }
  const asp = ASPECT[shape];
  const single = cutGeometry(cut, shape, asp, 1, cut === "faceted" ? 0.16 : cut === "rose-cut" ? 0.5 : 0.08);
  const geo = !rim && cut === "rose-cut" ? doubled(single) : single;
  const colorless = isColorless(gem, color);
  const tint = cut === "polki" ? 0xfff0c8 : colorless ? 0xf2f5ff : new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.1);
  const meshes = [
    new THREE.InstancedMesh(geo, m.mirror(tint, cut === "polki" ? 2.4 : 3.6), items.length),
    new THREE.InstancedMesh(geo, colorless ? m.skin : m.stone({ gem, cut, color, clarity: 0.5 }, 1), items.length),
    ...(rim ? [new THREE.InstancedMesh(shapedRim(shape, asp, cut === "faceted" ? 0.07 : 0.11), m.metal, items.length)] : []),
  ];
  const prongs = cut === "faceted" && rim ? new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), m.metal, items.length * 4) : null;
  const M = new THREE.Matrix4();
  items.forEach((it, i) => {
    orient(o, it);
    meshes.forEach((x) => x.setMatrixAt(i, o.matrix));
    if (prongs) for (let k = 0; k < 4; k++) {
      const [px, pz] = prongAt(shape, asp, k);
      M.makeTranslation(px, 0.12, pz);
      prongs.setMatrixAt(i * 4 + k, o.matrix.clone().multiply(M));
    }
  });
  // A rose cut is shallow: light mostly passes straight through it, so the refraction view gives it fewer bounces.
  if (cut === "rose-cut") meshes[0].userData.shallow = true;
  meshes.forEach((x) => g.add(x));
  if (prongs) g.add(prongs);
  return tagKeys(g, items);
}

const doubles = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function doubled(g: THREE.BufferGeometry) {
  let d = doubles.get(g);
  if (!d) {
    const top = g.index ? g.toNonIndexed() : g.clone();
    top.computeBoundingBox();
    const base = top.boundingBox!.min.y;
    const under = top.clone();
    const p = under.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, 2 * base - p.getY(i));
    for (let i = 0; i < p.count; i += 3) for (let k = 0; k < 3; k++) { const a = p.getComponent(i + 1, k); p.setComponent(i + 1, k, p.getComponent(i + 2, k)); p.setComponent(i + 2, k, a); }
    const both = new THREE.BufferGeometry();
    const a = top.getAttribute("position").array as Float32Array, b = p.array as Float32Array;
    const all = new Float32Array(a.length + b.length); all.set(a); all.set(b, a.length);
    both.setAttribute("position", new THREE.BufferAttribute(all, 3));
    both.translate(0, -base, 0);
    both.computeVertexNormals();
    d = both;
    doubles.set(g, d);
  }
  return d;
}

function tagKeys(g: THREE.Object3D, items: Item[]) {
  if (!items.some((it) => it.key)) return g;
  const keys = items.map((it) => it.key ?? "");
  g.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).count === items.length) o.userData.keys = keys; });
  return g;
}

export function balls(mat: THREE.Material, items: Item[], squash = 1) {
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 18, 12).scale(1, squash, 1), mat, Math.max(1, items.length));
  im.userData.strung = true;
  const o = new THREE.Object3D();
  items.forEach((it, i) => { orient(o, it); im.setMatrixAt(i, o.matrix); });
  im.count = items.length;
  return im;
}

export function ghungroo(mat: THREE.Material, items: Item[]) {
  const shell = new THREE.SphereGeometry(0.5, 56, 36).toNonIndexed();
  const pos = shell.getAttribute("position") as THREE.BufferAttribute, keep: number[] = [];
  for (let t = 0; t < pos.count; t += 3) {
    let cx = 0, cy = 0;
    for (let k = 0; k < 3; k++) { cx += pos.getX(t + k) / 3; cy += pos.getY(t + k) / 3; }
    if (!(cy < -0.08 && Math.abs(cx) < 0.09)) for (let k = 0; k < 3; k++) keep.push(pos.getX(t + k), pos.getY(t + k), pos.getZ(t + k));
  }
  const bellGeo = new THREE.BufferGeometry();
  bellGeo.setAttribute("position", new THREE.Float32BufferAttribute(keep, 3));
  const nrm: number[] = [];
  for (let i = 0; i < keep.length; i += 3) { const v = new THREE.Vector3(keep[i], keep[i + 1], keep[i + 2]).normalize(); nrm.push(v.x, v.y, v.z); }
  bellGeo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  const bellMat = (mat as THREE.MeshPhysicalMaterial).clone(); bellMat.side = THREE.DoubleSide;
  const n = Math.max(1, items.length);
  const bells = new THREE.InstancedMesh(bellGeo, bellMat, n);
  const pellets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.6, metalness: 0.4 }), n);
  const loops = new THREE.InstancedMesh(new THREE.TorusGeometry(0.11, 0.035, 6, 14), mat, n);
  const o = new THREE.Object3D(), p = new THREE.Object3D(), l = new THREE.Object3D();
  items.forEach((it, i) => {
    orient(o, it); bells.setMatrixAt(i, o.matrix);
    p.position.set(0, -0.2, 0); p.updateMatrix(); pellets.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(o.matrix, p.matrix));
    l.position.set(0, 0.55, 0); l.updateMatrix(); loops.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(o.matrix, l.matrix));
  });
  bells.count = pellets.count = loops.count = items.length;
  const g = new THREE.Group();
  g.add(bells, pellets, loops);
  return g;
}

export function fringe(d: Design, m: Mats, anchors: { pos: THREE.Vector3; dir: THREE.Vector3 }[], beadsPer = 1) {
  const g = new THREE.Group();
  g.userData.part = "fringe";
  if (!d.fringe.enabled || !anchors.length) return g;
  const D = d.fringe.sizeMm;
  const links: Item[] = [], beads: Item[] = [];
  for (const a of anchors) {
    let p = a.pos.clone().addScaledVector(a.dir, 0.6);
    links.push({ pos: p.clone(), dia: Math.max(0.6, D * 0.22) });
    for (let k = 0; k < beadsPer; k++) {
      const dk = D * (1 - k * 0.18);
      p = p.clone().addScaledVector(a.dir, dk * 0.5 + 0.35);
      beads.push({ pos: p.clone(), dia: dk, up: a.dir.clone().normalize() });
      p.addScaledVector(a.dir, dk * 0.5);
    }
  }
  g.add(balls(m.metal, links));
  g.add(balls(m.bead(d.fringe.gem, d.fringe.color), beads, d.fringe.gem === "pearl" ? 1.12 : 1));
  return g;
}

const LINK = { cable: { len: 2.6, wire: 0.42 }, fine: { len: 1.5, wire: 0.22 }, box: { len: 1.8, wire: 0.38 }, rope: { len: 1.6, wire: 0.55 } };

export function chainAlong(curve: THREE.Curve<THREE.Vector3>, style: keyof typeof LINK, m: Mats, from = 0, to = 1) {
  const { len, wire } = LINK[style];
  const total = curve.getLength() * (to - from);
  const n = Math.max(2, Math.floor(total / (len * 0.72)));
  const geo = new THREE.TorusGeometry(len / 2 - wire, wire, style === "box" ? 4 : 8, style === "box" ? 4 : 16).scale(1, 0.62, 1);
  const im = new THREE.InstancedMesh(geo, m.metal, n);
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const u = (((from + ((to - from) * (i + 0.5)) / n) % 1) + 1) % 1;
    o.position.copy(curve.getPointAt(u));
    o.quaternion.setFromUnitVectors(v3(1, 0, 0), curve.getTangentAt(u));
    o.rotateX(style === "rope" ? i * 0.7 : i % 2 ? Math.PI / 2 : 0);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  }
  return im;
}

export function jumpRing(m: Mats, r: number, wire: number, pos: THREE.Vector3) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, wire, 10, 28), m.metal);
  ring.position.copy(pos);
  ring.rotation.y = Math.PI / 2;
  return ring;
}

export function aroundOutline(fn: OutlineFn, gap: number, dia: number, spacing: number, y = -0.25): Item[] {
  const N = 480, raw = Array.from({ length: N }, (_, i) => fn(i / N));
  const off = ([x, z]: [number, number]) => { const r = Math.hypot(x, z) || 1; const k = (r + gap + dia / 2) / r; return v3(x * k, y, z * k); };
  const out: Item[] = [];
  let acc = 0, prev = off(raw[0]);
  out.push({ pos: prev, dia });
  for (let i = 1; i < N; i++) {
    const p = off(raw[i]); acc += p.distanceTo(prev); prev = p;
    if (acc >= dia + spacing) { out.push({ pos: p, dia }); acc = 0; }
  }
  if (out.length > 2 && out[out.length - 1].pos.distanceTo(out[0].pos) < dia * 0.9) out.pop();
  return out;
}

export function backingPlate(m: Mats, fn: OutlineFn, scale: number, y: number, depth: number, mat?: THREE.Material) {
  const pts = Array.from({ length: 96 }, (_, i) => { const [x, z] = fn(i / 96); return new THREE.Vector2(x * scale, z * scale); });
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 2, curveSegments: 8 });
  geo.rotateX(Math.PI / 2); geo.translate(0, y, 0);
  return new THREE.Mesh(geo, mat ?? m.satin);
}
