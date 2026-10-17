import * as THREE from "three";
import type { Piece } from "@/lib/jewelryModel";

function hasher() {
  let h = 0x811c9dc5;
  return {
    add(n: number) {
      const s = Number.isFinite(n) ? (Math.round(n * 1000) / 1000).toFixed(3) : String(n);
      for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
      h = Math.imul(h ^ 44, 0x01000193);
    },
    hex: () => (h >>> 0).toString(16).padStart(8, "0"),
  };
}

export function fingerprint(p: Piece) {
  p.group.updateMatrixWorld(true);
  const h = hasher();
  let meshes = 0, vertices = 0, instances = 0, nonFinite = 0;
  const box = new THREE.Box3();
  const v = new THREE.Vector3(), m = new THREE.Matrix4();
  p.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes++;
    const pos = mesh.geometry.getAttribute("position");
    if (!pos) return;
    const inst = (o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh) : null;
    const copies = inst ? inst.count : 1;
    instances += copies;
    for (let c = 0; c < copies; c++) {
      if (inst) inst.getMatrixAt(c, m), m.premultiply(mesh.matrixWorld);
      else m.copy(mesh.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m);
        if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) { nonFinite++; continue; }
        box.expandByPoint(v);
        h.add(v.x); h.add(v.y); h.add(v.z);
      }
      vertices += pos.count;
    }
  });
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    meshes, instances, vertices, nonFinite,
    size: box.isEmpty() ? null : [r(box.max.x - box.min.x), r(box.max.y - box.min.y), r(box.max.z - box.min.z)],
    focus: [r(p.focus.x), r(p.focus.y), r(p.focus.z)], focusSize: r(p.focusSize), upright: p.upright,
    hash: h.hex(),
  };
}
