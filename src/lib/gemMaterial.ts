import * as THREE from "three";
import type { CenterStone, Gem } from "./design";
import { applyGlow, cabochonBody } from "./glow";

// How a stone's material is tuned. The ring's centre stone has always been a touch more matt and opaque as a cabochon,
// with a slightly stronger glow and higher refraction in coloured stones, than stones elsewhere; both are kept as they
// are so no design changes look.
type GemTuning = { cabRoughness: number; cabTransmission: number; cabEmissive: number; ior: (gem: Gem) => number };
export const STONE_TUNING: GemTuning = {
  cabRoughness: 0.1, cabTransmission: 0.62, cabEmissive: 0.17,
  ior: (gem) => (gem === "diamond" ? 2.42 : gem === "emerald" || gem === "aquamarine" || gem === "morganite" ? 1.58 : 1.7),
};
export const RING_CENTRE_TUNING: GemTuning = {
  cabRoughness: 0.22, cabTransmission: 0.45, cabEmissive: 0.22,
  ior: (gem) => (gem === "diamond" ? 2.42 : gem === "emerald" || gem === "aquamarine" ? 1.58 : 1.77),
};

// The see-through body of a stone (a faceted stone's sparkle comes from a mirror layer drawn with it).
export function gemMaterial(c: Pick<CenterStone, "gem" | "cut" | "color" | "clarity">, W: number, glow: number | undefined, tune: GemTuning = STONE_TUNING) {
  const color = new THREE.Color(c.color);
  const isCab = c.cut === "cabochon" || c.cut === "bead" || c.cut === "carved";
  const mat = applyGlow(new THREE.MeshPhysicalMaterial({
    color, metalness: 0, roughness: isCab ? tune.cabRoughness : 0.01,
    transmission: isCab ? c.clarity * tune.cabTransmission : 0.2 + c.clarity * 0.75, thickness: W * 0.8,
    ior: tune.ior(c.gem),
    attenuationColor: color, attenuationDistance: 2 + c.clarity * 8,
    emissive: color, emissiveIntensity: isCab ? tune.cabEmissive : 0.08,
    clearcoat: isCab ? 0.8 : 0, clearcoatRoughness: 0.04,
    sheen: isCab ? 0.4 : 0, sheenColor: color.clone().lerp(new THREE.Color(0xffffff), 0.35), sheenRoughness: 0.5,
    envMapIntensity: isCab ? 1.1 : 2.4, flatShading: !isCab, transparent: !isCab,
  }), glow, isCab);
  return isCab && c.cut !== "bead" ? cabochonBody(mat) : mat;
}
