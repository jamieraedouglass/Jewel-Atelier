import { describe, expect, it } from "vitest";
import { normalizePrefs } from "@/lib/style/profile";
import { droppedNote, gemsIn, screenProposals } from "@/lib/style/guard";

describe("avoid check", () => {
  it("finds gems wherever a change puts them", () => {
    expect(gemsIn({ center: { gem: "ruby" }, accents: { gem: "emerald" }, extraStones: [{ gem: "opal" }], drop: { parts: [{ stone: { gem: "pearl" }, small: { gem: "garnet" } }] }, band: { paveGem: "sapphire" }, frames: [{ gem: "spinel", alt: { gem: "citrine" } }], fringe: { gem: "coral" } }).sort())
      .toEqual(["citrine", "coral", "emerald", "garnet", "opal", "pearl", "ruby", "sapphire", "spinel"]);
    expect(gemsIn({ name: "ruby", center: { label: "emerald" } })).toEqual([]);
  });

  it("drops suggestions with an avoided gem and flags other metals", () => {
    const prefs = normalizePrefs({ avoidGems: ["opal"], metals: ["yellow-gold"] });
    const { kept, dropped } = screenProposals([
      { title: "Opal halo", why: "", patch: { accents: { gem: "opal" } } },
      { title: "Platinum swap", why: "", patch: { metal: "platinum" } },
      { title: "Emerald centre", why: "", patch: { center: { gem: "emerald" }, metal: "yellow-gold" } },
    ], prefs);
    expect(dropped).toEqual([{ title: "Opal halo", gems: ["opal"] }]);
    expect(kept.map((k) => k.title)).toEqual(["Platinum swap", "Emerald centre"]);
    expect(kept[0].note).toContain("platinum");
    expect(kept[1].note).toBeUndefined();
    expect(droppedNote(dropped)).toContain("opal");
  });

  it("lets everything through for an empty profile", () => {
    const all = [{ title: "a", why: "", patch: { metal: "platinum", center: { gem: "opal" } } }];
    expect(screenProposals(all, normalizePrefs({})).kept).toEqual(all);
    expect(droppedNote([])).toBe("");
  });
});
