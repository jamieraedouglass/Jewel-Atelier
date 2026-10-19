import * as THREE from "three";
import type { CenterStone } from "./design";
import { applyGlow, cabochonBody } from "./glow";

// The see-through body of a stone, the same for a ring's centre stone as for every other stone (a faceted stone's
// sparkle comes from a mirror layer drawn with it).
export function gemMaterial(c: Pick<CenterStone, "gem" | "cut" | "color" | "clarity">, W: number, glow: number | undefined) {
  const color = new THREE.Color(c.color);
  const isCab = c.cut === "cabochon" || c.cut === "bead" || c.cut === "carved";
  const mat = applyGlow(new THREE.MeshPhysicalMaterial({
    color, metalness: 0, roughness: isCab ? 0.1 : 0.01,
    transmission: isCab ? c.clarity * 0.62 : 0.2 + c.clarity * 0.75, thickness: W * 0.8,
    ior: c.gem === "diamond" ? 2.42 : c.gem === "emerald" || c.gem === "aquamarine" || c.gem === "morganite" ? 1.58 : 1.7,
    attenuationColor: color, attenuationDistance: 2 + c.clarity * 8,
    emissive: color, emissiveIntensity: isCab ? 0.17 : 0.08,
    clearcoat: isCab ? 0.8 : 0, clearcoatRoughness: 0.04,
    sheen: isCab ? 0.4 : 0, sheenColor: color.clone().lerp(new THREE.Color(0xffffff), 0.35), sheenRoughness: 0.5,
    envMapIntensity: isCab ? 1.1 : 2.4, flatShading: !isCab, transparent: !isCab,
  }), glow, isCab);
  return isCab && c.cut !== "bead" ? cabochonBody(mat) : mat;
}
