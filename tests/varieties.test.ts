import { describe, expect, it } from "vitest";
import { GEM_LOOK, GEM_VARIETIES, SHOWCASE, applyPatch, defaultDesign, matchingVariety, showcaseDesign, varietiesOf, varietyLook } from "@/lib/design";
import { buildPiece } from "@/lib/jewelryModel";
import type * as THREE from "three";

describe("colour grades", () => {
  it("every grade is a valid stone look", () => {
    for (const [gem, vs] of Object.entries(GEM_VARIETIES)) for (const v of vs ?? []) {
      const d = applyPatch(defaultDesign(), { center: { gem: gem as never, ...varietyLook(v) } });
      expect(d.center.color, `${gem} ${v.id}`).toBe(v.color);
      expect(d.center.glow).toBe(v.glow);
    }
  });

  it("grade ids are unique within a gem", () => {
    for (const vs of Object.values(GEM_VARIETIES)) expect(new Set(vs!.map((v) => v.id)).size).toBe(vs!.length);
  });

  it("a Burmese-type ruby glows more, and is brighter, than a Thai-type one", () => {
    const burmese = varietiesOf("ruby").find((v) => v.id === "burmese")!;
    const thai = varietiesOf("ruby").find((v) => v.id === "thai")!;
    expect(burmese.glow).toBeGreaterThan(thai.glow);
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(lum(burmese.color)).toBeGreaterThan(lum(thai.color));
  });

  it("a Colombian-type emerald is livelier than a Zambian-type one", () => {
    const [col, zam] = ["colombian", "zambian"].map((id) => varietiesOf("emerald").find((v) => v.id === id)!);
    expect(col.glow).toBeGreaterThan(zam.glow);
  });

  it("recognises a stone set to a grade, case-insensitively", () => {
    const v = varietiesOf("emerald")[0];
    expect(matchingVariety("emerald", { color: v.color.toUpperCase(), glow: v.glow })?.id).toBe(v.id);
    expect(matchingVariety("emerald", { color: "#000000", glow: 0 })).toBeUndefined();
    expect(varietiesOf("diamond").map((x) => x.id)).toEqual(["golconda"]);
    expect(varietiesOf("onyx")).toEqual([]);
  });

  it("choosing a gem clears a grade's glow", () => {
    const glowing = applyPatch(defaultDesign(), { center: { gem: "ruby", glow: 0.7 } });
    expect(applyPatch(glowing, { center: { gem: "sapphire", ...GEM_LOOK.sapphire } }).center.glow).toBe(0);
  });

  it("existing designs without glow load with none", () => {
    expect(defaultDesign().center.glow).toBe(0);
    expect(defaultDesign().accents.glow).toBe(0);
  });

  it("a graded stone renders with more self-light than an ungraded one", () => {
    const emissive = (name: string, graded: boolean) => {
      let d = showcaseDesign(SHOWCASE.find((s) => s.name === name)!);
      if (!graded) d = { ...d, center: { ...d.center, glow: 0 } };
      let max = 0;
      buildPiece(d).group.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
        if (m && !Array.isArray(m) && m.metalness === 0 && m.userData.glow !== undefined) max = Math.max(max, m.emissiveIntensity);
      });
      return max;
    };
    expect(emissive("Burmese ruby halo ring", true)).toBeGreaterThan(emissive("Burmese ruby halo ring", false));
    expect(emissive("Colombian emerald solitaire", true)).toBeGreaterThan(emissive("Colombian emerald solitaire", false));
  });
});
