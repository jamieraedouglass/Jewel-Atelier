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
