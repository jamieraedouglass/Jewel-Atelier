import { describe, expect, it } from "vitest";
import { applyPatch, chooseStyle, defaultDesign, type DesignPatch } from "@/lib/design";
import { allowText, clampToAllowed, describeChanges, linkState, normalizeAllow, optionLook } from "@/lib/studio/links";
import { isStudioAdmin } from "@/lib/studio/admin";

const base = applyPatch(chooseStyle(defaultDesign(), "ring", "solitaire"), { metal: "white-gold", purity: { karat: 18 }, ringSize: 6.5, center: { gem: "diamond", shape: "round", lengthMm: 7, widthMm: 7, carat: 1.3 } });
const allow = normalizeAllow({ sizes: true, stones: [{ gem: "emerald", grade: "colombian" }, { gem: "ruby" }], shapes: ["oval"], stoneScale: 0.2, metals: ["yellow-gold"], karats: [22] });
const propose = (p: DesignPatch) => clampToAllowed(base, applyPatch(base, p), allow);

describe("client changes stay within what Carl allowed", () => {
  it("takes allowed changes", () => {
    const v = propose({ ringSize: 8, metal: "yellow-gold", purity: { karat: 22 }, center: { gem: "emerald", ...optionLook({ gem: "emerald", grade: "colombian" }) } });
    expect(v.ringSize).toBe(8);
    expect(v.metal).toBe("yellow-gold");
    expect(v.purity.karat).toBe(22);
    expect(v.center.gem).toBe("emerald");
    expect(v.center.color).toBe(optionLook({ gem: "emerald", grade: "colombian" }).color);
  });

  it("ignores everything else, however it arrives", () => {
    const v = propose({ metal: "platinum", purity: { karat: 14 }, band: { widthMm: 9 }, style: "halo", center: { gem: "sapphire" }, accents: { gem: "ruby" } } as DesignPatch);
    expect(v.metal).toBe("white-gold");
    expect(v.purity.karat).toBe(18);
    expect(v.band.widthMm).toBe(base.band.widthMm);
    expect(v.style).toBe("solitaire");
    expect(v.center.gem).toBe("diamond");
    expect(v.accents.gem).toBe(base.accents.gem);
  });

  it("keeps an option's own look (no made-up colours)", () => {
    const v = propose({ center: { gem: "ruby", color: "#00ff00" } });
    expect(v.center.gem).toBe("ruby");
    expect(v.center.color).toBe(optionLook({ gem: "ruby" }).color);
  });

  it("keeps the stone within Carl's size range and resizes for a new shape", () => {
    expect(propose({ center: { widthMm: 20, lengthMm: 20 } }).center.widthMm).toBe(8.4);
    expect(propose({ center: { widthMm: 2, lengthMm: 2 } }).center.widthMm).toBe(5.6);
    const oval = propose({ center: { shape: "oval" } });
    expect(oval.center.shape).toBe("oval");
    expect(oval.center.lengthMm).toBeGreaterThan(oval.center.widthMm);
    expect(propose({ center: { shape: "pear" } }).center.shape).toBe("round");
  });

  it("drops the stated carat once the stone changes, keeps it otherwise", () => {
    expect(propose({ ringSize: 7 }).center.carat).toBe(1.3);
    expect(propose({ center: { widthMm: 7.5, lengthMm: 7.5 } }).center.carat).toBeNull();
  });

  it("allows nothing when Carl allows nothing", () => {
    const none = normalizeAllow({ sizes: false, stoneScale: 0 });
    const v = clampToAllowed(base, applyPatch(base, { ringSize: 9, center: { widthMm: 8, lengthMm: 8 } }), none);
    expect(v).toEqual(base);
  });
});

describe("what Carl sees", () => {
  it("lists the changes in plain words", () => {
    const v = propose({ ringSize: 7, metal: "yellow-gold", center: { gem: "ruby", shape: "oval" } });
    const changes = describeChanges(base, v);
    expect(changes[0]).toContain("Ring size US 6.5 → 7");
    expect(changes.join(" | ")).toMatch(/Metal 18k White gold → 18k Yellow gold/);
    expect(changes.join(" | ")).toMatch(/Centre stone .* → Ruby/);
    expect(changes.join(" | ")).toContain("Shape round → oval");
    expect(describeChanges(base, base)).toEqual([]);
  });

  it("tells the AI exactly what's allowed", () => {
    const t = allowText(allow, base);
    expect(t).toContain("Colombian emerald");
    expect(t).toContain("20% bigger or smaller");
    expect(t).toContain("Ask the jeweller");
    expect(allowText(normalizeAllow({ sizes: false, stoneScale: 0 }), base)).toContain("the design is fixed");
  });
});

describe("links and access", () => {
  it("know when they've lapsed", () => {
    const now = Date.parse("2026-10-17T00:00:00Z");
    expect(linkState({ revoked: false, expires_at: null }, now)).toBe("active");
    expect(linkState({ revoked: false, expires_at: "2026-10-01T00:00:00Z" }, now)).toBe("expired");
    expect(linkState({ revoked: true, expires_at: null }, now)).toBe("revoked");
  });

  it("recognise the studio's master accounts by the name they sign in with", () => {
    expect(isStudioAdmin({ email: "carl@users.jewel-atelier.invalid" }, "Carl, Priya Shah")).toBe(true);
    expect(isStudioAdmin({ email: "priya-shah@users.jewel-atelier.invalid" }, "Carl, Priya Shah")).toBe(true);
    expect(isStudioAdmin({ email: "jamie@users.jewel-atelier.invalid" }, "Carl")).toBe(false);
    expect(isStudioAdmin(null, "Carl")).toBe(false);
    expect(isStudioAdmin({ email: "carl@users.jewel-atelier.invalid" }, "")).toBe(false);
  });
});

describe("private studio access", () => {
  it("lets visitors open only sign-in, client links and the demo", async () => {
    const { isOpenPath } = await import("@/lib/access");
    for (const p of ["/login", "/auth/callback", "/c/abc123", "/api/client/abc/save", "/demo", "/demo/client"]) expect(isOpenPath(p), p).toBe(true);
    for (const p of ["/", "/design", "/rings", "/studio", "/d/123", "/api/chat", "/c/abc/extra", "/demonstrate", "/loginx"]) expect(isOpenPath(p), p).toBe(false);
  });
});
