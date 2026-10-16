import { describe, expect, it } from "vitest";
import { applyPatch, type Design } from "@/lib/design";
import { clampToAllowed, optionLook } from "@/lib/studio/links";
import { applyVersion, cleanPricing, formatMoney, knownPriceReply, priceFor, priceText, versionName, type PriceVersion } from "@/lib/studio/pricing";
import { DEMO_ALLOW, DEMO_PIECES, DEMO_PRICING, MEHER_RUBY, demoLinkDetail, demoStudio, DEMO_NAMES } from "@/lib/studio/demo";
import { studioSummary } from "@/lib/studio/dashboard";

const base = DEMO_PIECES[0].base;
const ruby = DEMO_PRICING.pieces[DEMO_PIECES[0].designId];
const as = (d: Design) => clampToAllowed(base, d, DEMO_ALLOW); // what the client's own change becomes on the link
const emerald = optionLook({ gem: "emerald", grade: "colombian" });

describe("prices on a client link", () => {
  it("shows the price for the piece as designed, and sizes don't change it", () => {
    expect(priceFor(base, base, ruby)?.inr).toBe(485000);
    expect(priceFor(base, as(applyPatch(base, { ringSize: 5 })), ruby)?.inr).toBe(485000);
  });
  it("shows Carl's price for each version he priced", () => {
    expect(priceFor(base, as(applyPatch(base, { purity: { karat: 22 } })), ruby)?.inr).toBe(515000);
    const em = as(applyPatch(base, { center: { gem: "emerald", color: emerald.color, clarity: emerald.clarity, glow: emerald.glow, label: emerald.label } }));
    expect(priceFor(base, em, ruby)?.inr).toBe(440000);
  });
  it("disappears for anything he didn't price", () => {
    expect(priceFor(base, MEHER_RUBY, ruby)).toBeNull(); // her stone is 10% bigger
    expect(priceFor(base, as(applyPatch(base, { metal: "platinum" })), ruby)).toBeNull();
    expect(priceFor(base, base, undefined)).toBeNull();
    expect(priceFor(base, base, [])).toBeNull();
  });
  it("takes the client to a priced version, keeping their size", () => {
    const sized = as(applyPatch(base, { ringSize: 5.5, center: { widthMm: base.center.widthMm * 1.2, lengthMm: base.center.lengthMm * 1.2 } }));
    const back = applyVersion(base, sized, ruby[1]);
    expect(back.ringSize).toBe(5.5);
    expect(back.purity.karat).toBe(22);
    expect(back.center.widthMm).toBe(base.center.widthMm);
    expect(priceFor(base, as(back), ruby)?.inr).toBe(515000);
  });
  it("keeps only prices the client could actually reach", () => {
    const input = { currency: "USD" as const, pieces: {
      [DEMO_PIECES[0].designId]: [...ruby, { inr: 1, metal: "rose-gold" } as PriceVersion, { inr: 499000, karat: 22 } as PriceVersion],
      "not-in-link": [{ inr: 5 }],
    } };
    const clean = cleanPricing(input, { [DEMO_PIECES[0].designId]: base }, DEMO_ALLOW);
    expect(clean.currency).toBe("USD");
    expect(Object.keys(clean.pieces)).toEqual([DEMO_PIECES[0].designId]);
    const vs = clean.pieces[DEMO_PIECES[0].designId];
    expect(vs.some((v) => v.metal === "rose-gold")).toBe(false); // rose gold isn't allowed on this link
    expect(vs.filter((v) => v.karat === 22)).toEqual([{ inr: 499000, karat: 22 }]); // the later price for the same version wins
  });
  it("names versions and shows prices the Indian way, or converted", () => {
    expect(versionName(base, {})).toBe("As designed");
    expect(versionName(base, { karat: 22 })).toMatch(/22k/);
    expect(formatMoney(485000, "INR")).toBe("₹4,85,000");
    expect(priceText(485000, "INR", 1)).toEqual({ main: "₹4,85,000", sub: null });
    const usd = priceText(485000, "USD", 0.0105);
    expect(usd.main).toBe("≈ $5,093");
    expect(usd.sub).toMatch(/₹4,85,000/);
    expect(priceText(485000, "USD", null).main).toBe("₹4,85,000"); // no rate: rupees only
    expect(knownPriceReply("Kotharis Jewellers", "ruby ring", 485000, "GBP", 0.0079)).toMatch(/≈ £3,832.*rupees/);
  });
});

describe("prices in the demo", () => {
  it("are all versions Meher can reach", () => {
    const bases = Object.fromEntries(DEMO_PIECES.map((p) => [p.designId, p.base]));
    const clean = cleanPricing(DEMO_PRICING, bases, DEMO_ALLOW);
    expect(Object.values(clean.pieces).flat().length).toBe(Object.values(DEMO_PRICING.pieces).flat().length);
  });
  it("show Carl that Meher's bigger stone needs a new price", () => {
    const ring = demoLinkDetail("demo-meher")!.pieces[0];
    expect(ring.hasPrices).toBe(true);
    expect(ring.priced).toBeNull();
    expect(demoLinkDetail("demo-meher")!.pieces[1].priced?.inr).toBe(395000);
  });
  it("a price question the client got an answer to isn't waiting on Carl", () => {
    const { links, events } = demoStudio();
    const answered = [...events, { id: 999, link_id: "demo-meher", design_id: DEMO_PIECES[1].designId, kind: "asked-price", detail: { question: "How much?", shownInr: 395000 }, at: new Date().toISOString() }];
    const s = studioSummary(links, answered, DEMO_NAMES);
    expect(s.needsYou.some((f) => f.id === 999)).toBe(false);
    expect(s.feed.find((f) => f.id === 999)?.text).toMatch(/shown your price, ₹3,95,000/);
  });
});

describe("the price answer", () => {
  it("reads naturally", () => {
    expect(knownPriceReply("Kotharis Jewellers", "Half-flowered Burmese ruby ring", 515000, "INR", 1)).toMatch(/^Kotharis Jewellers' price for the Half-flowered Burmese ruby ring as you've set it up is ₹5,15,000\./);
    expect(knownPriceReply("Jewel Atelier", "Ring", 1000, "INR", 1)).toMatch(/^Jewel Atelier's price/);
  });
});
