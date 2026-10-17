import { describe, expect, it } from "vitest";
import { applyPatch, blockedOptions, buildable, chooseStyle, defaultDesign, normalizeDesign } from "@/lib/design";

describe("what can actually be made", () => {
  it("only fits straight-edged side stones tight against the centre", () => {
    const tri = chooseStyle(defaultDesign(), "ring", "three-stone");
    expect(applyPatch(tri, { sides: { kind: "oval", hug: true } }).sides.hug).toBe(false);
    expect(applyPatch(tri, { sides: { kind: "half-moon", hug: true } }).sides.hug).toBe(true);
    expect(blockedOptions(applyPatch(tri, { sides: { kind: "round" } })).hug?.reason).toMatch(/straight edge/);
  });
  it("never sets stones inside a huggie", () => {
    const hug = chooseStyle(defaultDesign(), "earrings", "huggie");
    expect(applyPatch(hug, { options: { hoopFace: "inner" } }).options.hoopFace).toBe("front");
    expect(blockedOptions(hug).hoopInside?.reason).toMatch(/earlobe/);
    const hoop = chooseStyle(defaultDesign(), "earrings", "hoop");
    expect(applyPatch(hoop, { options: { hoopFace: "inner" } }).options.hoopFace).toBe("inner");
  });
  it("doesn't let a toi-et-moi's stones touch when each has a surround", () => {
    const t = chooseStyle(defaultDesign(), "ring", "two-stone");
    expect(applyPatch(t, { options: { halo: true, pairSpacing: "touching" } }).options.pairSpacing).toBe("apart");
    expect(applyPatch(t, { options: { halo: false, pairSpacing: "touching" } }).options.pairSpacing).toBe("touching");
  });
  it("corrects a stored design that predates the rules", () => {
    const old = { ...chooseStyle(defaultDesign(), "earrings", "huggie"), options: { ...defaultDesign().options, hoopFace: "inner" } };
    expect(normalizeDesign(old).options.hoopFace).toBe("front");
  });
  it("leaves a buildable design exactly as it is", () => {
    const d = defaultDesign();
    expect(buildable(d)).toBe(d);
  });
});
