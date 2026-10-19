import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SHOWCASE, showcaseDesign } from "@/lib/design";
import { pieceRoot } from "@/lib/cadExport";

const named = (name: string) => showcaseDesign(SHOWCASE.find((x) => x.name === name)!);

describe("diamonds by the yard", () => {
  it("spaces the stones evenly all the way round, with no gap where the loop starts", () => {
    const base = named("Burmese sapphire, half-moons");
    const d = { ...base, type: "necklace" as const, style: "by-the-yard" as const, center: { ...base.center, gem: "diamond" as const, cut: "rose-cut" as const, lengthMm: 6.5, widthMm: 6.5 }, options: { ...base.options, stoneLink: "drilled" as const, layers: 1, lengthIn: 16 } };
    const root = pieceRoot(d); root.updateMatrixWorld(true);
    const pts: THREE.Vector3[] = [], m = new THREE.Matrix4();
    root.traverse((o) => {
      const im = o as THREE.InstancedMesh;
      if (!im.isInstancedMesh || o.parent?.userData.part !== "accents" || pts.length) return;
      for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m); m.premultiply(im.matrixWorld); pts.push(new THREE.Vector3().setFromMatrixPosition(m)); }
    });
    expect(pts.length).toBeGreaterThan(20);
    // Every stone has two close neighbours, one each side: the loop is closed and evenly spaced.
    const second = pts.map((p, i) => pts.filter((_, j) => j !== i).map((q) => q.distanceTo(p)).sort((a, b) => a - b)[1]);
    expect(Math.max(...second) / Math.min(...second)).toBeLessThan(1.15);
  });
});

describe("baguette side stones hugging the centre", () => {
  it("are set lengthways along the centre stone, with the band only as wide as they are", () => {
    const base = named("Burmese sapphire, half-moons");
    const d = { ...base, sides: { ...base.sides, kind: "baguette" as const, hug: true, follow: "band" as const, hugFrac: 0.54 } };
    const root = pieceRoot(d); root.updateMatrixWorld(true);
    let top: { topW: number } | undefined, stone: THREE.Box3 | undefined;
    root.traverse((o) => {
      if (o.userData.top) top = o.userData.top;
      if (!stone && o.parent?.userData.part === "sides" && (o as THREE.Mesh).isMesh) { const g = (o as THREE.Mesh).geometry; g.computeBoundingBox(); stone = g.boundingBox!; }
    });
    const along = stone!.max.z - stone!.min.z;
    expect(along).toBeGreaterThan(6);
    expect(top!.topW).toBeLessThan(along + 0.5);
  });
});

describe("festoon necklace", () => {
  it("hangs its swags with no stones overlapping or too small to set", async () => {
    const { checkBuild } = await import("@/lib/buildCheck");
    const d = named("Baguette festoon necklace");
    expect(checkBuild(d, pieceRoot(d))).toEqual([]);
  });
});
