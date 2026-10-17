import * as THREE from "three";
import { type Gem } from "../design";
import { Y, v3 } from "./common";
import { type Mats } from "./materials";
import { type Item, balls } from "./elements";

let loopFlatten = 1;

export function withLoopFlatten<T>(flatten: number, build: () => T): T {
  const prev = loopFlatten;
  loopFlatten = Math.max(0.1, Math.min(1, flatten));
  try { return build(); } finally { loopFlatten = prev; }
}

export function loopCurve(lengthMm: number, aspect: number, point: number) {
  const make = (k: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      const x = Math.cos(t) * k * aspect;
      let z = Math.sin(t) * k * loopFlatten;
      if (z > 0) z += point * k * Math.pow(Math.max(0, 1 - Math.abs(x) / (k * aspect)), 2);
      pts.push(v3(x, 0, z));
    }
    return new THREE.CatmullRomCurve3(pts, true, "centripetal");
  };
  let k = lengthMm / (2 * Math.PI);
  for (let i = 0; i < 4; i++) k *= lengthMm / make(k).getLength();
  const curve = make(k);
  let front = 0, bz = -Infinity;
  for (let i = 0; i < 400; i++) { const p = curve.getPointAt(i / 400); if (p.z > bz) { bz = p.z; front = i / 400; } }
  return { curve, front };
}
export function layeredLoop(baseLen: number, extra: number, aspect: number, point: number) {
  const base = loopCurve(baseLen, aspect, point);
  const lay = loopCurve(baseLen + extra, aspect, point);
  const back = (cv: THREE.Curve<THREE.Vector3>) => { let z = Infinity; for (let i = 0; i < 200; i++) z = Math.min(z, cv.getPointAt(i / 200).z); return z; };
  const dz = back(base.curve) - back(lay.curve);
  const pts = lay.curve.getSpacedPoints(160).slice(0, -1).map((p) => p.add(new THREE.Vector3(0, 0, dz)));
  const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal");
  let front = 0, bz = -Infinity;
  for (let i = 0; i < 400; i++) { const p = curve.getPointAt(i / 400); if (p.z > bz) { bz = p.z; front = i / 400; } }
  return { curve, front };
}
export const wrap = (u: number) => ((u % 1) + 1) % 1;
export const outwardAt = (curve: THREE.Curve<THREE.Vector3>, u: number) => new THREE.Vector3().crossVectors(Y, curve.getTangentAt(wrap(u))).normalize();
export const yawAt = (curve: THREE.Curve<THREE.Vector3>, u: number) => { const t = curve.getTangentAt(wrap(u)); return Math.atan2(t.x, t.z) + Math.PI / 2; };

export const spreadParams = (front: number, count: number, spread: number) =>
  Array.from({ length: count }, (_, i) => wrap(front + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread)));

export function place(obj: THREE.Object3D, pos: THREE.Vector3, yaw = 0, up?: THREE.Vector3) {
  obj.position.copy(pos);
  if (up) obj.quaternion.setFromUnitVectors(Y, up);
  obj.rotateY(yaw);
  return obj;
}

export function beadStrand(m: Mats, curve: THREE.Curve<THREE.Vector3>, gem: Gem, color: string, dia: number, goldEvery = 0, from = 0, to = 1) {
  const len = curve.getLength() * (to - from);
  const n = Math.floor(len / (dia * 1.04));
  const beads: Item[] = [], gold: Item[] = [];
  for (let i = 0; i < n; i++) {
    const u = wrap(from + ((to - from) * (i + 0.5)) / n);
    (goldEvery && i % goldEvery === 0 ? gold : beads).push({ pos: curve.getPointAt(u), dia });
  }
  const g = new THREE.Group();
  g.add(balls(m.bead(gem, color), beads));
  if (gold.length) g.add(balls(m.metal, gold));
  return g;
}
