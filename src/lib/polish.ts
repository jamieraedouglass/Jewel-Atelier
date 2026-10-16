import * as THREE from "three";

/**
 * Hand-polished metal: the finish varies very slightly across the surface (polishing marks, the odd softer patch),
 * so highlights break up a little instead of reading as computer-perfect chrome. The pattern is fixed to the piece,
 * so it turns with it rather than swimming over it.
 */
export function handPolished<T extends THREE.MeshPhysicalMaterial>(mat: T): T {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPolishPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPolishPos = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vPolishPos;
        float polishHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float polishNoise(vec3 p) {
          vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(polishHash(i), polishHash(i + vec3(1,0,0)), f.x), mix(polishHash(i + vec3(0,1,0)), polishHash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(polishHash(i + vec3(0,0,1)), polishHash(i + vec3(1,0,1)), f.x), mix(polishHash(i + vec3(0,1,1)), polishHash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        // fine marks stretched one way (the polishing direction), over a broad, gentle variation
        float marks = polishNoise(vPolishPos * vec3(9.0, 1.2, 9.0));
        float broad = polishNoise(vPolishPos * 0.35);
        roughnessFactor = clamp(roughnessFactor * (0.7 + 0.45 * marks + 0.35 * broad), 0.02, 1.0);`);
  };
  mat.customProgramCacheKey = () => "hand-polished";
  return mat;
}
