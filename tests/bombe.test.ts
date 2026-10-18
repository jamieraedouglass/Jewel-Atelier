import { describe, expect, it } from "vitest";
import { SHOWCASE, showcaseDesign } from "@/lib/design";
import { buildPiece } from "@/lib/jewelryModel";
import { overlappingStones, stonesIn } from "@/lib/buildCheck";
import { measurePiece } from "@/components/canvas/framing";

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
});
