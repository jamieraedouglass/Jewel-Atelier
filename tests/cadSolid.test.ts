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
});
