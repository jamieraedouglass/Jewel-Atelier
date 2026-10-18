import { describe, expect, it } from "vitest";
import { applyPatch, chooseStyle, defaultDesign } from "@/lib/design";
import { traceDrops } from "@/lib/photoTrace";
import { buildPiece } from "@/lib/jewelryModel";

const stone = { gem: "diamond", cut: "faceted", shape: "pear", lengthMm: 20, widthMm: 20, domeMm: 0.8, color: "#f4f6fb", clarity: 0.95, glow: 0, rotation: 180, dx: 0, dz: 0 };
const design = () => applyPatch(chooseStyle(defaultDesign(), "earrings", "pendant"), { drop: { top: "post", parts: [
  { kind: "stone", stone, small: { cut: "briolette", shapes: ["pear"], widthMm: 3 }, count: 5 },
  { kind: "stone", stone, showStone: false, anchor: "on", from: 0, small: { cut: "faceted", shapes: ["round"], widthMm: 1.5 }, count: 5 },
] } } as never);

describe("traceDrops", () => {
  it("places circled stones where they are in the photo, in mm from the big stone", () => {
    // A 20 mm stone in a 200 px box centred at (500, 500): 10 px per mm.
    const reading = { main: { photo: 0, x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, groups: [
      { what: "briolette drops", marks: [{ x: 0.5, y: 0.65, r: 0.002 }, { x: 0.4, y: 0.6, r: 0.002 }] },
      { what: "small round diamonds", marks: [{ x: 0.45, y: 0.6, r: 0.008 }, { x: 0.55, y: 0.6, r: 0.008 }] },
    ] };
    const d = traceDrops(design(), reading, [{ w: 1000, h: 1000 }]);
    const [b, r] = d.drop.parts;
    expect(b.small.spots.map((s) => [s.x, s.z])).toEqual([[0, 15], [-10, 10]]);
    expect(b.count).toBe(2);
    expect(r.small.spots.map((s) => [s.x, s.z])).toEqual([[-5, 10], [5, 10]]);
    expect(r.small.widthMm).toBeCloseTo(1.6, 5);
    const p = buildPiece(d);
    expect(p.group.children.length).toBeGreaterThan(0);
  });
  it("leaves a design alone when there is no reading or the style has no drop parts", () => {
    const d = design();
    expect(traceDrops(d, null, [{ w: 1, h: 1 }])).toBe(d);
    const ring = chooseStyle(defaultDesign(), "ring", "solitaire");
    expect(traceDrops(ring, { main: { x: 0, y: 0, w: 1, h: 1 } }, [{ w: 1, h: 1 }])).toBe(ring);
  });
});

describe("traceDrops with stones the person marked", () => {
  it("adds a part for a group no part holds yet", () => {
    const d0 = applyPatch(chooseStyle(defaultDesign(), "earrings", "pendant"), { drop: { parts: [{ kind: "stone", stone, small: { cut: "briolette", shapes: ["pear"], widthMm: 3 }, count: 3 }] } } as never);
    const reading = { main: { photo: 0, x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, groups: [{ what: "Small round diamonds", marks: [{ x: 0.45, y: 0.6, r: 0.008 }, { x: 0.55, y: 0.6, r: 0.008 }] }] };
    const d = traceDrops(d0, reading, [{ w: 1000, h: 1000 }]);
    expect(d.drop.parts).toHaveLength(2);
    expect(d.drop.parts[1]).toMatchObject({ anchor: "on", showStone: false, count: 2 });
    expect(d.drop.parts[1].small.spots).toHaveLength(2);
  });
});
