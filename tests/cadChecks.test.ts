import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SHOWCASE, showcaseDesign } from "@/lib/design";
import { checkLines, pieceRoot } from "@/lib/cadExport";
import { solidMetal, thinSpots, type SolidReport } from "@/lib/cadSolid";

describe("CAD checks before casting", () => {
  it("measures wall thickness straight through the metal", () => {
    const thin = thinSpots(new THREE.BoxGeometry(10, 0.4, 10), 0.6, () => "");
    expect(thin.spots.length).toBeGreaterThan(0);
    expect(thin.spots.every((s) => Math.abs(s.typicalMm - 0.4) < 0.02)).toBe(true);
    expect(thinSpots(new THREE.BoxGeometry(3, 3, 3), 0.6, () => "").spots).toEqual([]);
  });

  it("finds a seat for every set stone on a three-stone ring", async () => {
    const r = (await solidMetal(pieceRoot(showcaseDesign(SHOWCASE.find((x) => x.name === "Burmese sapphire, half-moons")!))))!.report;
    expect(r.stones).toBe(5);
    expect(r.unseated).toEqual([]);
    expect(r.loose).toEqual([]);
    expect(checkLines(r).join("\n")).toMatch(/^OK +Seats: all 5/m);
  }, 120000);

  it("flags stones without a seat and thin metal in the README", () => {
    const r: SolidReport = {
      pieces: 3, joined: 3, rebuilt: 0, skipped: [], seats: 2, watertight: true, volumeMm3: 100, stones: 3, strung: 0,
      unseated: [{ where: "the side stones' settings", at: [-6, 12, 0] }], loose: [],
      thin: { minMm: 0.6, spots: [{ where: "the band", at: [0, -9, 0], typicalMm: 0.4, areaMm2: 3 }], thinMm2: 3, surfaceMm2: 300 },
    };
    const text = checkLines(r).join("\n");
    expect(text).toMatch(/CHECK Seats: 1 of 3 stones have no seat cut/);
    expect(text).toMatch(/the side stones' settings, at about \(-6, 12, 0\) mm/);
    expect(text).toMatch(/CHECK Thickness: about 1% of the metal surface is thinner than 0.6 mm/);
  });
});
