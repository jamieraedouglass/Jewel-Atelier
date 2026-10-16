import type * as THREE from "three";

/**
 * Make a stone's body look lit from within, by `glow` (0–1; see design/varieties.ts): a Burmese ruby's red
 * fluorescence, a Colombian emerald's liveliness. The ray-traced view reads `userData.glow` to brighten its tint too.
 */
export function applyGlow<T extends THREE.MeshPhysicalMaterial>(mat: T, glow: number | undefined, isCab: boolean): T {
  const g = Math.max(0, Math.min(1, glow ?? 0));
  mat.userData.glow = g;
  if (g > 0) mat.emissiveIntensity += g * (isCab ? 0.35 : 0.55);
  return mat;
}

/** the ray-traced stone's tint for a glowing stone: brighter than white-balanced colour, so the bloom pass catches it */
export const glowTint = (tint: THREE.Color, glow: number) => (glow > 0 ? tint.multiplyScalar(1 + glow * 0.6) : tint);
