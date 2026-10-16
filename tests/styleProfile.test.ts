import { describe, expect, it } from "vitest";
import { applyPatch, chooseStyle, defaultDesign, showcaseDesign, SHOWCASE } from "@/lib/design";
import { describeProfile, designDefaultsFrom, normalizePrefs, prefsFromTaste, profileCompleteness, summarizeTaste } from "@/lib/style/profile";

const showcase = (name: string) => showcaseDesign(SHOWCASE.find((s) => s.name === name)!);

describe("style preferences", () => {
  it("fill every default from nothing, and survive old rows without prefs", () => {
    const p = normalizePrefs(undefined);
    expect(p.metals).toEqual([]);
    expect(p.sizes.ringUs).toBeNull();
    expect(normalizePrefs({ metals: ["platinum"] }).metals).toEqual(["platinum"]);
  });

  it("drop only the bad field, not the whole profile", () => {
    const p = normalizePrefs({ metals: ["platinum"], loveGems: ["emerald", "unobtainium"], sizes: { ringUs: 2, wristCm: 16 }, karat: 19, scale: "statement" });
    expect(p.metals).toEqual(["platinum"]);
    expect(p.scale).toBe("statement");
    expect(p.sizes.ringUs).toBeNull();
    expect(p.sizes.wristCm).toBe(16);
    expect(p.karat).toBeNull();
    expect(p.loveGems).toEqual([]);
  });
});

describe("what the designer reads", () => {
  it("is empty when there's nothing to go on", () => {
    expect(describeProfile({ prefs: normalizePrefs({}), icons: [], notes: "" })).toBe("");
  });

  it("states preferences plainly, with avoidances as a hard rule", () => {
    const text = describeProfile({
      prefs: normalizePrefs({ designingFor: "clients", aesthetics: ["art-deco", "statement"], metals: ["yellow-gold"], karat: 22, loveGems: ["emerald"], avoidGems: ["opal"], avoid: "big halos", sizes: { ringUs: 7 }, budget: { currency: "INR", amount: 500000 } }),
      icons: ["Gayatri Devi"], notes: "Heirloom feel", applied: ["Add a briolette halo"], photos: 3,
    });
    expect(text).toMatch(/^STYLE PROFILE/);
    expect(text).toContain("designing for clients");
    expect(text).toContain("art deco & vintage and statement & maximalist");
    expect(text).toContain("yellow gold, in 22k gold");
    expect(text).toContain("AVOID (never suggest these): opal; big halos");
    expect(text).toContain("US 7 (Indian 14)");
    expect(text).toContain("5,00,000 INR");
    expect(text).toContain("Gayatri Devi");
    expect(text).toContain("3 image(s)");
    expect(text).toContain("Add a briolette halo");
  });
});

describe("taste from saved designs", () => {
  const designs = [
    showcase("Half-flowered emerald ring"), showcase("Emerald with a briolette halo"), showcase("Kashi Kamal earrings"),
    applyPatch(chooseStyle(defaultDesign(), "ring", "solitaire"), { metal: "platinum", ringSize: 7 }),
  ];
  const taste = summarizeTaste(designs);

  it("counts what they make and what they use", () => {
    expect(taste.designs).toBe(4);
    expect(taste.types[0]).toEqual(["ring", 3]);
    expect(taste.gems[0][0]).toBe("emerald");
    expect(taste.grades[0][0]).toBe("Colombian emerald");
  });

  it("reads into the prompt only with enough designs", () => {
    expect(describeProfile({ prefs: normalizePrefs({}), icons: [], notes: "", taste })).toContain("From the 4 designs they have saved");
    expect(describeProfile({ prefs: normalizePrefs({}), icons: [], notes: "", taste: summarizeTaste(designs.slice(0, 1)) })).toBe("");
  });

  it("fills empty preferences from it, never overriding what they chose", () => {
    const filled = prefsFromTaste(taste, normalizePrefs({}));
    expect(filled.loveGems).toContain("emerald");
    expect(filled.metals.length).toBeGreaterThan(0);
    const mine = prefsFromTaste(taste, normalizePrefs({ loveGems: ["ruby"], avoidGems: ["emerald"] }));
    expect(mine.loveGems).toEqual(["ruby"]);
  });
});

describe("new designs start from the profile", () => {
  it("in their metal, karat and sizes", () => {
    const patch = designDefaultsFrom(normalizePrefs({ metals: ["rose-gold", "platinum"], karat: 18, sizes: { ringUs: 8, wristCm: 17, necklaceIn: 20 } }));
    const d = applyPatch(defaultDesign(), patch);
    expect(d.metal).toBe("rose-gold");
    expect(d.purity.karat).toBe(18);
    expect(d.ringSize).toBe(8);
    expect(d.options.wristCm).toBe(17);
    expect(d.options.lengthIn).toBe(20);
    expect(chooseStyle(d, "earrings", "stud").metal).toBe("rose-gold");
  });

  it("changes nothing for an empty profile", () => {
    expect(designDefaultsFrom(normalizePrefs({}))).toEqual({});
  });
});

describe("completeness", () => {
  it("grows as the profile fills in", () => {
    const empty = profileCompleteness(normalizePrefs({}), [], "", 0);
    const some = profileCompleteness(normalizePrefs({ metals: ["platinum"], loveGems: ["ruby"] }), ["Grace Kelly"], "", 2);
    expect(empty).toBe(0);
    expect(some).toBeGreaterThan(empty);
  });
});

describe("profile text extras", () => {
  it("uses the written photo read instead of images, and remembers turned-down ideas", () => {
    const text = describeProfile({ prefs: normalizePrefs({}), icons: [], notes: "", photoRead: "Warm yellow gold, Mughal motifs.", dismissed: ["Platinum swap"] });
    expect(text).toContain("as read by the studio: Warm yellow gold, Mughal motifs.");
    expect(text).toContain("turned down");
    expect(text).toContain("Platinum swap");
    // sent images take precedence over the read
    expect(describeProfile({ prefs: normalizePrefs({}), icons: [], notes: "", photoRead: "x", photos: 2 })).not.toContain("as read by the studio");
  });

  it("ranks made pieces above many old ideas", () => {
    const ideas = Array.from({ length: 3 }, () => applyPatch(chooseStyle(defaultDesign(), "ring", "solitaire"), { metal: "platinum" }));
    const made = applyPatch(chooseStyle(defaultDesign(), "necklace", "riviera"), { metal: "yellow-gold" });
    const t = summarizeTaste([...ideas, made], [0.3, 0.3, 0.3, 3], 1);
    expect(t.types[0][0]).toBe("necklace");
    expect(t.made).toBe(1);
    expect(describeProfile({ prefs: normalizePrefs({}), icons: [], notes: "", taste: t })).toContain("1 actually made");
  });
});
