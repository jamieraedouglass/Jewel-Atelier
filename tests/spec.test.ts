import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applyPatch, caratFromDims, chooseStyle, defaultDesign, estimateDims, showcaseDesign, SHOWCASE } from "@/lib/design";
import { buildSpec, geometryVolume, metalDensity } from "@/lib/studio/spec";

describe("spec sheet", () => {
  it("measures metal parts sensibly", () => {
    expect(geometryVolume(new THREE.BoxGeometry(2, 3, 4))).toBeCloseTo(24, 3);
    expect(geometryVolume(new THREE.SphereGeometry(1, 64, 48))).toBeCloseTo((4 / 3) * Math.PI, 1);
    const tube = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 0, 10)), 8, 0.5, 8);
    expect(geometryVolume(tube)).toBeCloseTo(Math.PI * 0.25 * 10, 3);
  });

  it("knows its metals", () => {
    expect(metalDensity({ metal: "platinum", purity: { karat: 18 } })).toBe(21.4);
    expect(metalDensity({ metal: "yellow-gold", purity: { karat: 22 } })).toBeGreaterThan(metalDensity({ metal: "yellow-gold", purity: { karat: 18 } }));
  });

  it("turns a stone's size back into carats", () => {
    for (const ct of [0.5, 1, 3]) {
      const d = estimateDims("diamond", "faceted", "oval", ct);
      expect(caratFromDims("diamond", "faceted", "oval", d.lengthMm, d.widthMm)).toBeCloseTo(ct, 0);
    }
  });

  it("gives a plain band a believable weight", () => {
    const band = applyPatch(chooseStyle(defaultDesign(), "ring", "solitaire"), { center: { none: true }, metal: "yellow-gold", purity: { karat: 18 }, band: { widthMm: 2.3 } });
    const s = buildSpec(band);
    expect(s.metal.weightG).toBeGreaterThan(1);
    expect(s.metal.weightG).toBeLessThan(8);
    expect(s.stones).toEqual([]);
  });

  it("lists the centre stone and counts the halo", () => {
    const s = buildSpec(applyPatch(chooseStyle(defaultDesign(), "ring", "halo"), { center: { carat: 1.2 } }));
    expect(s.stones[0].what).toMatch(/^Centre stone/);
    expect(s.stones[0].eachCt).toBe(1.2);
    const accents = s.stones.filter((x) => x.what.startsWith("Accent"));
    expect(accents.reduce((n, x) => n + x.count, 0)).toBeGreaterThan(10);
    expect(s.facts.find(([k]) => k === "Ring size")?.[1]).toContain("Indian");
  });

  it("covers both earrings and every part of a drop", () => {
    const s = buildSpec(showcaseDesign(SHOWCASE.find((x) => x.name === "Kashi Kamal earrings")!));
    expect(s.stones.some((x) => x.what.includes("Part 2") && x.count === 2)).toBe(true);
    expect(s.stones.some((x) => x.what.includes("small stones"))).toBe(true);
    expect(s.metal.weightG).toBeGreaterThan(0);
  });
});
