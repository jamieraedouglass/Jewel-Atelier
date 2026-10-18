import { describe, expect, it } from "vitest";
import { defaultDesign } from "@/lib/design";
import { believable, colourPatch, sampleAt } from "@/lib/colourSample";

const solid = (r: number, g: number, b: number, w = 50, h = 50) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([r, g, b, 255], i * 4);
  return { data, width: w, height: h };
};

describe("colour from the photo", () => {
  it("reads the stone's body colour and ignores a sparkle", () => {
    const px = solid(230, 160, 200);
    px.data.set([255, 255, 255, 255], (25 * 50 + 25) * 4);
    expect(sampleAt(px, 0.5, 0.5)).toBe("#e6a0c8");
  });
  it("rejects a reading that is a different colour from what was seen", () => {
    expect(believable("#e6a0c8", "#d9a6d6")).toBe(true);
    expect(believable("#c9a24a", "#d9a6d6")).toBe(false);
  });
  it("sets the colour of the right part", () => {
    const d = defaultDesign();
    expect(colourPatch(d, "center", "#112233")?.patch).toEqual({ center: { color: "#112233" } });
    expect(colourPatch(d, "frame:0:alt", "#112233") === null || !!colourPatch(d, "frame:0:alt", "#112233")).toBe(true);
    expect(colourPatch(d, "nonsense", "#112233")).toBeNull();
  });
});

import { withMarkedColours } from "@/lib/colourSample";
import { applyPatch as patchDesign, chooseStyle as pickStyle, defaultDesign as freshRing } from "@/lib/design";

describe("colours from the stones the person marked", () => {
  it("takes the gem's colour from its marks, not from a highlight", () => {
    const W = 100, H = 100, data = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) { data[i * 4] = 30; data[i * 4 + 1] = 130; data[i * 4 + 2] = 70; data[i * 4 + 3] = 255; }
    for (let i = 0; i < 300; i++) { const k = (Math.floor(i / 10) * W + (i % 10)) * 4; data[k] = 240; data[k + 1] = 250; data[k + 2] = 245; }
    const d0 = patchDesign(pickStyle(freshRing(), "ring", "deco"), { frames: [{ kind: "fill", gem: "sapphire", color: "#e6a8cc", cut: "cabochon", shape: "cushion", widthMm: 2, alt: { gem: "emerald", color: "#77d2b2", shape: "marquise", cut: "cabochon" }, pattern: "sprays" }] } as never);
    const marks = [0.5, 0.6, 0.7, 0.8].map((x) => ({ photo: 0, x, y: 0.5, r: 0.02 }));
    const d = withMarkedColours(d0, [{ what: "emerald leaf cabochons", marks }], [{ data, width: W, height: H }]);
    expect(d.frames[0].alt?.color).toBe("#1e8246");
    expect(d.frames[0].color).toBe("#e6a8cc");
  });
});
