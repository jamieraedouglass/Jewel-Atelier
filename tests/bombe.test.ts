import { describe, expect, it } from "vitest";
import { SHOWCASE, showcaseDesign } from "@/lib/design";
import { buildPiece } from "@/lib/jewelryModel";
import { overlappingStones, stonesIn } from "@/lib/buildCheck";
import { measurePiece } from "@/components/canvas/framing";
import * as THREE from "three";

describe("leaf-mosaic dome", () => {
  const d = showcaseDesign(SHOWCASE.find((x) => x.name === "Moval in a leaf-mosaic dome")!);
  it("has no stones overlapping, so it can be set and machined", () => {
    const stones = stonesIn(buildPiece(d).group);
    expect(stones.length).toBeGreaterThan(120);
    expect(overlappingStones(stones).size).toBe(0);
  });
  it("comes out at the measured size of the top", () => {
    const m = measurePiece(buildPiece(d), d);
    expect(Math.abs(m.lengthMm - 20.4)).toBeLessThan(0.8);
    expect(Math.abs(m.widthMm - 20.3)).toBeLessThan(0.8);
  });
  it("has every stone sitting on the metal, none hanging off the dome", () => {
    const p = buildPiece(d);
    p.group.updateMatrixWorld(true);
    const cell = 0.5, hash = new Map<string, THREE.Vector3[]>();
    p.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (o as THREE.InstancedMesh).isInstancedMesh || (m.material as THREE.MeshPhysicalMaterial).transmission > 0.1) return;
      const ps = m.geometry.getAttribute("position");
      for (let i = 0; i < ps.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(ps, i).applyMatrix4(m.matrixWorld); const k = [v.x, v.y, v.z].map((x) => Math.floor(x / cell)).join(","); (hash.get(k) ?? hash.set(k, []).get(k)!).push(v); }
    });
    const gap = (v: THREE.Vector3) => { let best = Infinity; const [x, y, z] = [v.x, v.y, v.z].map((t) => Math.floor(t / cell)); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = -2; c <= 2; c++) for (const q of hash.get(`${x + a},${y + b},${z + c}`) ?? []) best = Math.min(best, q.distanceTo(v)); return best; };
    const m4 = new THREE.Matrix4(), pos = new THREE.Vector3();
    let off = 0;
    p.group.traverse((o) => {
      const im = o as THREE.InstancedMesh;
      if (!im.isInstancedMesh || im.geometry.type === "SphereGeometry") return;
      im.geometry.computeBoundingBox();
      const bb = im.geometry.boundingBox!;
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, m4); m4.premultiply(im.matrixWorld); pos.setFromMatrixPosition(m4);
        if (pos.y < 3) continue;
        let worst = 0;
        for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; worst = Math.max(worst, gap(new THREE.Vector3(Math.cos(a) * bb.max.x, bb.min.y, Math.sin(a) * bb.max.z).applyMatrix4(m4))); }
        if (worst > 0.6) off++;
      }
    });
    expect(off).toBe(0);
  });
});
