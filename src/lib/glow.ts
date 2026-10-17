import type * as THREE from "three";

export function applyGlow<T extends THREE.MeshPhysicalMaterial>(mat: T, glow: number | undefined, isCab: boolean): T {
  const g = Math.max(0, Math.min(1, glow ?? 0));
  mat.userData.glow = g;
  if (g > 0) mat.emissiveIntensity += g * (isCab ? 0.35 : 0.55);
  return mat;
}

export const glowTint = (tint: THREE.Color, glow: number) => (glow > 0 ? tint.multiplyScalar(1 + glow * 0.6) : tint);

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
