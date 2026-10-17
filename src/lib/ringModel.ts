import type * as THREE from "three";
import { isShared } from "./cache";

export * from "./ring/stoneGeometry";
export * from "./ring/metal";
export * from "./ring/band";
export * from "./ring/assembly";

export function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && !isShared(m.geometry)) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
