import { applyGlow } from "../glow";
import * as THREE from "three";
import { type CenterStone, type Design, type Gem } from "../design";
import { metalTone } from "../ringModel";

/* ================= materials ================= */

export function makeMaterials(d: Design) {
  const tone = metalTone(d);
  const cache = new Map<string, THREE.Material>();
  const memo = <T extends THREE.Material>(key: string, make: () => T): T => {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key) as T;
  };
  return {
    metal: memo("metal", () => new THREE.MeshPhysicalMaterial({ color: tone.color, metalness: 1, roughness: tone.roughness, envMapIntensity: 1.05, clearcoat: 0.3, clearcoatRoughness: 0.1 })),
    enamel: memo("enamel", () => new THREE.MeshPhysicalMaterial({ color: d.enamel.color, metalness: 0, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 })),
    skin: memo("skin", () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transparent: true, opacity: 0.22, specularIntensity: 1, envMapIntensity: 3, flatShading: true, depthWrite: false })),
    mirror: (tint: THREE.ColorRepresentation = 0xf2f5ff, intensity = 3.6) =>
      memo(`mirror${new THREE.Color(tint).getHexString()}${intensity}`, () =>
        // a faint emissive floor keeps facets from reading as black when they mirror the dark studio
        new THREE.MeshPhysicalMaterial({ color: tint, metalness: 1, roughness: 0, envMapIntensity: intensity * 1.25, emissive: tint, emissiveIntensity: 0.12, flatShading: true, iridescence: 0.25, iridescenceIOR: 1.8, iridescenceThicknessRange: [250, 650] })),
    bead: (gem: Gem, color: string) =>
      memo(`bead${gem}${color}`, () =>
        gem === "pearl"
          ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0, sheen: 1, sheenColor: new THREE.Color("#ffd9e6"), sheenRoughness: 0.4, iridescence: 0.6, iridescenceIOR: 1.6, clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 1.3 })
          : new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 1.1 })),
    /** a stone body; a stone without its own glow that is the accent gem takes the accents' glow */
    stone: (c: Pick<CenterStone, "gem" | "cut" | "color" | "clarity"> & { glow?: number }, W: number) => {
      const glow = c.glow ?? (c.gem === d.accents.gem ? d.accents.glow : 0);
      return memo(`stone${c.gem}${c.cut}${c.color}${c.clarity}${glow}${Math.round(W)}`, () => {
        const color = new THREE.Color(c.color);
        const isCab = c.cut === "cabochon" || c.cut === "bead"; // polished, not faceted
        return applyGlow(new THREE.MeshPhysicalMaterial({
          color, metalness: 0, roughness: isCab ? 0.22 : 0.01,
          transmission: isCab ? c.clarity * 0.45 : 0.2 + c.clarity * 0.75, thickness: W * 0.8,
          ior: c.gem === "diamond" ? 2.42 : ["emerald", "aquamarine", "morganite"].includes(c.gem) ? 1.58 : 1.7,
          attenuationColor: color, attenuationDistance: 2 + c.clarity * 8,
          emissive: color, emissiveIntensity: isCab ? 0.22 : 0.08,
          clearcoat: isCab ? 0.8 : 0, clearcoatRoughness: 0.04,
          sheen: isCab ? 0.4 : 0, sheenColor: color.clone().lerp(new THREE.Color(0xffffff), 0.35), sheenRoughness: 0.5,
          envMapIntensity: isCab ? 1.1 : 2.4, flatShading: !isCab, transparent: !isCab,
        }), glow, isCab);
      });
    },
  };
}
export type Mats = ReturnType<typeof makeMaterials>;
