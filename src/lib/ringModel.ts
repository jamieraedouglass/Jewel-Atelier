import type * as THREE from "three";
import { isShared } from "./cache";

/** The ring builder and the stone and band geometry it shares with every other piece. Parts live in src/lib/ring/. */
export * from "./ring/stoneGeometry";
export * from "./ring/metal";
export * from "./ring/band";
export * from "./ring/assembly";

/** free the GPU buffers of everything in a built piece, except geometries shared through a cache (see lib/cache.ts) */
export function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && !isShared(m.geometry)) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
