import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applyPatch, chooseStyle, defaultDesign, describeDesign, normalizeDesign, type Design } from "@/lib/design";
import { chatForApi, type ChatMessage } from "@/lib/chat";
import { clampToAllowed, describeChanges, normalizeAllow, optionLook } from "@/lib/studio/links";
import { cleanPricing, priceFor } from "@/lib/studio/pricing";

const ring = () => normalizeDesign({ ...defaultDesign(), type: "ring", style: "solitaire" });

describe("client chat", () => {
  it("sends a suggestion as what it changes, not the whole design", () => {
    const base = ring();
    const sugg = applyPatch(base, { metal: "platinum" });
    const history: ChatMessage[] = [
      { role: "user", content: "Ideas?" },
      { role: "assistant", content: "Try this", proposals: [{ title: "Platinum", why: "", patch: sugg as unknown as Record<string, unknown> }] },
      { role: "user", content: "And smaller?" },
    ];
    const out = chatForApi(history, 40, (p) => describeChanges(base, normalizeDesign(p.patch)).join("; "));
    expect(out[1].content.length).toBeLessThan(400);
    expect(out[1].content).toMatch(/Platinum/);
  });
});

describe("stone choices on a link", () => {
  const base = applyPatch(ring(), { center: { gem: "ruby", color: "#b3062a", label: "Ruby" } });
  const allow = normalizeAllow({ stones: [{ gem: "ruby" }, { gem: "ruby", grade: "burmese" }] });
  const burmese = optionLook({ gem: "ruby", grade: "burmese" });
  const picked = applyPatch(base, { center: { color: burmese.color, label: burmese.label } });

  it("keeps the exact grade the client picked", () => {
    expect(clampToAllowed(base, picked, allow).center.color.toLowerCase()).toBe(burmese.color.toLowerCase());
  });
  it("keeps Carl's price for that grade", () => {
    const p = cleanPricing({ currency: "INR", pieces: { a: [{ inr: 9, stone: { gem: "ruby", grade: "burmese" } }] } }, { a: base }, allow);
    expect(p.pieces.a?.length).toBe(1);
    expect(priceFor(base, clampToAllowed(base, picked, allow), p.pieces.a)?.inr).toBe(9);
  });
  it("a swapped-in stone carries none of the old stone's grade, inclusions or star", () => {
    const graded = applyPatch(ring(), { center: { colorGrade: "G-J", inclusions: 0.5 } });
    const a = normalizeAllow({ stones: [{ gem: "sapphire" }] });
    const sap = optionLook({ gem: "sapphire" });
    const v = clampToAllowed(graded, applyPatch(graded, { center: { gem: "sapphire", color: sap.color } }), a);
    expect(v.center).toMatchObject({ gem: "sapphire", colorGrade: null, inclusions: 0, phenomenon: "none" });
  });
  it("keeps a stone's own proportions (no egg-shaped rounds)", () => {
    const v = clampToAllowed(ring(), applyPatch(ring(), { center: { shape: "oval", lengthMm: 9.1 } }), normalizeAllow({ stoneScale: 0.25 }));
    expect(v.center.shape).toBe("round");
    expect(v.center.lengthMm).toBe(v.center.widthMm);
  });
});

describe("a stone's character", () => {
  it("names a star only on a cabochon", () => {
    expect(describeDesign(applyPatch(ring(), { center: { phenomenon: "star" } }))).not.toMatch(/star/);
  });
  it("isn't copied onto a toi-et-moi's partner stone", async () => {
    const { buildPiece } = await import("@/lib/jewelryModel");
    const d: Design = applyPatch(chooseStyle(defaultDesign(), "ring", "two-stone"), { center: { inclusions: 0.8, cut: "cabochon", phenomenon: "star" } });
    let stars = 0, specks = 0;
    buildPiece({ ...d, extraStones: [{ ...d.extraStones[0], cut: "cabochon" }] }).group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.ShaderMaterial).isShaderMaterial) stars++;
      if (o.userData.inclusions) specks++;
    });
    expect(stars).toBe(1); // the centre only
    expect(specks).toBeGreaterThan(0);
    expect(specks).toBeLessThanOrEqual(2); // one stone's crystals and feathers
  });
});
