import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ClaspChoice, Design } from "../design";
import { v3 } from "./common";
import { type Mats } from "./materials";
import { accents, jumpRing } from "./elements";
import { yawAt } from "./curves";

export type ClaspKind = Exclude<ClaspChoice, "auto" | "hidden">;

/** how much of a loop (as a share of its length) to leave open for a clasp of this size */
export const claspGap = (curve: THREE.Curve<THREE.Vector3>, size: number) => Math.min(0.06, (size * 2.2) / curve.getLength());

/**
 * A clasp at the back of a loop, lying along it. `size` is about the width of what it joins (a stone line, a bead,
 * a chain). A jewelled box carries the accent stones on its lid, so the design runs on over the clasp.
 */
export function claspAt(kind: ClaspKind, d: Design, m: Mats, curve: THREE.Curve<THREE.Vector3>, u: number, size: number) {
  const g = new THREE.Group();
  g.userData.part = "metal";
  g.position.copy(curve.getPointAt(u));
  g.rotation.y = yawAt(curve, u) + Math.PI / 2; // local Z runs along the loop
  const s = Math.max(2.4, size);
  const torus = (R: number, r: number, arc = Math.PI * 2) => new THREE.Mesh(new THREE.TorusGeometry(R, r, 10, 32, arc), m.metal);
  const capsule = (r: number, len: number) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), m.metal);

  if (kind === "box" || kind === "jewelled") {
    const box = new THREE.Mesh(new RoundedBoxGeometry(s * 0.95, s * 0.6, s * 1.7, 3, s * 0.18), m.satin);
    g.add(box);
    // the tongue's little lever and the figure-of-eight safety on each side
    const lever = capsule(s * 0.07, s * 0.3); lever.rotation.x = Math.PI / 2; lever.position.set(0, s * 0.3, -s * 0.95); g.add(lever);
    for (const x of [-1, 1]) { const safety = torus(s * 0.16, s * 0.04); safety.position.set(x * s * 0.5, 0, 0); safety.rotation.y = Math.PI / 2; g.add(safety); }
    if (kind === "jewelled") {
      const dia = s * 0.42;
      const items = [-1, 0, 1].map((k) => ({ pos: v3(0, s * 0.32, k * dia * 1.15), dia: k ? dia * 0.8 : dia }));
      const set = accents(m, d.accents.gem, d.accents.color, d.accents.cut === "polki" || d.accents.cut === "rose-cut" ? d.accents.cut : "faceted", items);
      set.userData.keep = true; // part of the clasp, not optional accents
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
