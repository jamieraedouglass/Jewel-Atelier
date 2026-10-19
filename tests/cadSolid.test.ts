import { describe, expect, it } from "vitest";
import { SHOWCASE, showcaseDesign } from "@/lib/design";
import { pieceRoot } from "@/lib/cadExport";
import { solidMetal } from "@/lib/cadSolid";

describe("CAD metal solid", () => {
  for (const name of ["Oval trilogy ring", "Burmese sapphire, half-moons", "Gold band with diamond edges", "Moval in a leaf-mosaic dome"]) {
    it(`${name}: every metal part joins into one watertight solid with stone seats`, async () => {
      const r = await solidMetal(pieceRoot(showcaseDesign(SHOWCASE.find((x) => x.name === name)!)));
      expect(r).not.toBeNull();
      expect(r!.report.skipped).toEqual([]);
      expect(r!.report.watertight).toBe(true);
      expect(r!.report.volumeMm3).toBeGreaterThan(50);
      expect(r!.report.seats).toBeGreaterThan(0);
    }, 120000);
  }

  it("cuts a seat for both side stones when they follow the band", async () => {
    const base = showcaseDesign(SHOWCASE.find((x) => x.name === "Burmese sapphire, half-moons")!);
    const d = { ...base, sides: { ...base.sides, kind: "trapezoid" as const, hug: false, follow: "band" as const }, setting: { ...base.setting, style: "double-claw" as const } };
    const r = await solidMetal(pieceRoot(d));
    // Centre, both side stones and the two small stones under the head.
    expect(r!.report.seats).toBe(5);
  }, 120000);
});
