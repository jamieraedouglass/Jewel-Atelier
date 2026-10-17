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

/**
 * A polished (cabochon) stone's body: brighter where the dome faces you and deeper towards its edges, the way light
 * gathers in a real cabochon, instead of one flat colour. Leaves faceted stones alone.
 */
export function cabochonBody<T extends THREE.MeshPhysicalMaterial>(mat: T): T {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      float facing = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
      totalEmissiveRadiance *= mix(0.3, 1.7, facing * facing);
      diffuseColor.rgb *= mix(0.62, 1.1, facing);`,
    );
  };
  mat.customProgramCacheKey = () => "cabochon-body";
  return mat;
}
