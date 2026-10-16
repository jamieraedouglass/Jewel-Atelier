import type { Design } from "@/lib/design";
import * as THREE from "three";
import { type Piece } from "@/lib/jewelryModel";
import { type Measure, type View } from "./types";

export const FOV = 28;

/** Where the camera sits for each view, framed to the piece's size. */
export function framing(piece: Piece, view: View) {
  const box = new THREE.Box3().setFromObject(piece.group);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const fit = (r: number) => (r / Math.sin(THREE.MathUtils.degToRad(FOV / 2))) * 1.25;
  if (piece.upright) {
    // rings stand up, so look at them like a product shot
    const t = sphere.center.clone().add(new THREE.Vector3(0, sphere.radius * 0.18, 0));
    if (view === "top") return { pos: t.clone().add(new THREE.Vector3(0.01, fit(sphere.radius) * 1.05, 6)), target: piece.focus.clone() };
    if (view === "detail") return { pos: t.clone().add(new THREE.Vector3(4, 10, fit(sphere.radius) * 1.05)), target: t };
    return { pos: t.clone().add(new THREE.Vector3(0.36, 0.52, 0.95).normalize().multiplyScalar(fit(sphere.radius) * 1.05)), target: t };
  }
  if (view === "top") return { pos: sphere.center.clone().add(new THREE.Vector3(0, fit(sphere.radius), 0.01)), target: sphere.center.clone() };
  if (view === "detail") {
    const r = Math.max(4, piece.focusSize / 2);
    return { pos: piece.focus.clone().add(new THREE.Vector3(0.25, 0.85, 0.75).normalize().multiplyScalar(fit(r))), target: piece.focus.clone() };
  }
  return { pos: sphere.center.clone().add(new THREE.Vector3(0.1, 0.8, 0.62).normalize().multiplyScalar(fit(sphere.radius))), target: sphere.center.clone() };
}


/** the part worth measuring: one earring of a pair, a ring's head, otherwise the whole piece */
export function subjectOf(piece: Piece, design: Design, ear: "left" | "right" = "left"): { obj: THREE.Object3D; hide: THREE.Object3D[]; what: string } {
  const g = piece.group;
  if (design.type === "earrings" && g.children.length >= 2) {
    const i = ear === "right" ? 1 : 0;
    return { obj: g.children[i], hide: g.children.filter((_, j) => j !== i), what: "each earring" };
  }
  return { obj: g, hide: [], what: design.type === "ring" ? "the ring" : "the piece" };
}

export function measurePiece(piece: Piece, design: Design): Measure {
  const { obj, what } = subjectOf(piece, design);
  obj.updateWorldMatrix(true, true);
  const b = new THREE.Box3();
  if (design.type === "ring") {
    // a ring's top: the stones and what holds them, not the band
    obj.traverse((o) => { if (["center", "sides", "extra", "accents", "motif"].includes(o.userData.part)) b.expandByObject(o); });
  }
  if (b.isEmpty()) b.setFromObject(obj);
  const sz = b.getSize(new THREE.Vector3());
  const r1 = (n: number) => Math.round(n * 10) / 10;
  if (design.type === "ring") return { widthMm: r1(sz.x), lengthMm: r1(sz.z), depthMm: r1(sz.y), what: "the ring's top" };
  if (piece.upright) return { widthMm: r1(sz.x), lengthMm: r1(sz.y), depthMm: r1(sz.z), what };
  return { widthMm: r1(sz.x), lengthMm: r1(sz.z), depthMm: r1(sz.y), what };
}
