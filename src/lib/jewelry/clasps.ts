import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ClaspChoice, Design } from "../design";
import { v3 } from "./common";
import { type Mats } from "./materials";
import { accents, chainAlong, jumpRing } from "./elements";
import { outwardAt, wrap, yawAt } from "./curves";

// A short round gold bar from a to b.
function tubeBetween(m: Mats, a: THREE.Vector3, b: THREE.Vector3, r: number) {
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 10), m.metal);
  bar.position.copy(a).add(b).multiplyScalar(0.5);
  bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return bar;
}

type ClaspKind = Exclude<ClaspChoice, "auto" | "hidden">;

export const claspGap = (curve: THREE.Curve<THREE.Vector3>, size: number) => Math.min(0.06, (size * 2.2) / curve.getLength());

export function claspAt(kind: ClaspKind, d: Design, m: Mats, curve: THREE.Curve<THREE.Vector3>, u: number, size: number) {
  const g = new THREE.Group();
  g.userData.part = "metal";
  g.position.copy(curve.getPointAt(u));
  g.rotation.y = yawAt(curve, u) + Math.PI / 2;
  const s = Math.max(2.4, size);
  const torus = (R: number, r: number, arc = Math.PI * 2) => new THREE.Mesh(new THREE.TorusGeometry(R, r, 10, 32, arc), m.metal);
  const capsule = (r: number, len: number) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), m.metal);

  if (kind === "slider") {
    // A slider: a jewelled bead the chain runs through, pushed up to tighten the piece against the throat. Both ends
    // of the chain come out of it and hang down the back, each finished with a small diamond-set chevron and then two
    // round diamonds, one below the other.
    const bead = new THREE.Mesh(new RoundedBoxGeometry(s * 1.1, s * 0.75, s * 1.6, 3, s * 0.25), m.satin);
    g.add(bead);
    g.add(accents(m, d.accents.gem, d.accents.color, "faceted", [-1, 0, 1].map((k) => ({ pos: v3(0, s * 0.38, k * s * 0.45), dia: s * 0.36 }))));
    g.updateMatrix();
    const inv = g.matrix.clone().invert();
    const out = outwardAt(curve, u), along = curve.getTangentAt(wrap(u));
    for (const [side, len] of [[-1, 18], [1, 14]] as const) {
      const a = curve.getPointAt(u).addScaledVector(along, side * s * 0.5);
      const b = a.clone().addScaledVector(out, len);
      const tail = new THREE.Group();
      tail.add(chainAlong(new THREE.LineCurve3(a, b), d.options.chain, m));
      const across = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), out).normalize();
      const tip = b.clone().addScaledVector(out, 2.6), small: { pos: THREE.Vector3; dia: number }[] = [];
      for (const k of [1, -1]) {
        const top = b.clone().addScaledVector(across, k * 1.6);
        tail.add(tubeBetween(m, top, tip, 0.45));
        for (const t of [0.3, 0.7]) small.push({ pos: top.clone().lerp(tip, t).add(new THREE.Vector3(0, 0.35, 0)), dia: 0.9 });
      }
      tail.add(tubeBetween(m, b.clone().addScaledVector(across, 1.6), b.clone().addScaledVector(across, -1.6), 0.3));
      const rounds = [{ pos: tip.clone().addScaledVector(out, 1.6), dia: 2.2 }, { pos: tip.clone().addScaledVector(out, 4.2), dia: 2.6 }];
      tail.add(tubeBetween(m, tip, rounds[1].pos, 0.3));
      const set = accents(m, d.accents.gem, d.accents.color, "faceted", [...small, ...rounds]);
      set.userData.keep = true;
      tail.add(set);
      tail.applyMatrix4(inv);
      g.add(tail);
    }
  } else if (kind === "box" || kind === "jewelled") {
    const box = new THREE.Mesh(new RoundedBoxGeometry(s * 0.95, s * 0.6, s * 1.7, 3, s * 0.18), m.satin);
    g.add(box);
    const lever = capsule(s * 0.07, s * 0.3); lever.rotation.x = Math.PI / 2; lever.position.set(0, s * 0.3, -s * 0.95); g.add(lever);
    for (const x of [-1, 1]) { const safety = torus(s * 0.16, s * 0.04); safety.position.set(x * s * 0.5, 0, 0); safety.rotation.y = Math.PI / 2; g.add(safety); }
    if (kind === "jewelled") {
      const dia = s * 0.42;
      const items = [-1, 0, 1].map((k) => ({ pos: v3(0, s * 0.32, k * dia * 1.15), dia: k ? dia * 0.8 : dia }));
      const set = accents(m, d.accents.gem, d.accents.color, d.accents.cut === "polki" || d.accents.cut === "rose-cut" ? d.accents.cut : "faceted", items);
      set.userData.keep = true;
      g.add(set);
    }
  } else if (kind === "lobster") {
    const body = capsule(s * 0.22, s * 0.75); body.rotation.x = Math.PI / 2; g.add(body);
    const gate = torus(s * 0.24, s * 0.05, Math.PI); gate.rotation.y = Math.PI / 2; gate.position.z = s * 0.45; g.add(gate);
    g.add(jumpRing(m, s * 0.2, s * 0.05, v3(0, 0, -s * 0.7)));
    g.add(jumpRing(m, s * 0.24, s * 0.06, v3(0, 0, s * 0.9)));
  } else if (kind === "spring-ring") {
    const ring = torus(s * 0.32, s * 0.07); ring.rotation.x = Math.PI / 2; g.add(ring);
    const tab = capsule(s * 0.05, s * 0.12); tab.position.set(s * 0.32, s * 0.08, 0); g.add(tab);
    g.add(jumpRing(m, s * 0.18, s * 0.05, v3(0, 0, -s * 0.55)));
  } else if (kind === "toggle") {
    const ring = torus(s * 0.5, s * 0.1); ring.rotation.x = Math.PI / 2; ring.position.z = -s * 0.45; g.add(ring);
    const bar = capsule(s * 0.09, s * 1.5); bar.rotation.z = Math.PI / 2; bar.position.z = s * 0.45; g.add(bar);
  }
  return g;
}
