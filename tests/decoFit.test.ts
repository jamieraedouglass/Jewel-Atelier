import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applyPatch, chooseStyle, defaultDesign } from "@/lib/design";
import { isCurrentThumb, thumbPath } from "@/lib/thumbs";

const top = async (d: ReturnType<typeof defaultDesign>) => {
  const { buildPiece } = await import("@/lib/jewelryModel");
  let layers: THREE.Object3D | null = null;
  buildPiece(d).group.traverse((o) => { if (!layers && o.userData.part === "accents" && o.userData.keep) layers = o; });
  const box = new THREE.Box3().setFromObject(layers!);
  return { across: box.max.x - box.min.x, along: box.max.z - box.min.z, tall: box.max.y - box.min.y };
};

describe("layered (Deco) rings", () => {
  const deco = chooseStyle(defaultDesign(), "ring", "deco");
  it("keep the top a wearable size however many big layers there are", async () => {
    const big = { kind: "stones" as const, outline: "oval" as const, gem: "sapphire" as const, color: "#e7a6c8", cut: "cabochon" as const, shape: "pear" as const, widthMm: 6, direction: "radial" as const, alt: null, every: 1, gapMm: 3 };
    const d = { ...applyPatch(deco, { center: { shape: "marquise", lengthMm: 18, widthMm: 10 } }), frames: Array(6).fill(big) };
    const t = await top(d);
    expect(Math.max(t.across, t.along)).toBeLessThan(40);
  });
  it("keep a normal design exactly as it was", async () => {
    const t = await top(deco);
    expect(Math.max(t.across, t.along)).toBeLessThan(28);
  });
  it("can be domed", async () => {
    const flat = await top(deco), domed = await top(applyPatch(deco, { options: { decoDome: 1 } }));
    expect(domed.tall).toBeGreaterThan(flat.tall);
  });
});

describe("gallery pictures", () => {
  it("are redrawn when the look changes", () => {
    expect(isCurrentThumb(thumbPath("u", "d"))).toBe(true);
    expect(isCurrentThumb("u/d.jpg")).toBe(false);
    expect(isCurrentThumb(null)).toBe(false);
  });
});
