import { describe, expect, it } from "vitest";
import { clientChatSystem, isPriceQuestion, mentionsMoney, priceReply } from "@/lib/studio/clientChat";
import { demoLinkDetail, MEHER_RUBY } from "@/lib/studio/demo";
import { studioSummary } from "@/lib/studio/dashboard";
import { demoStudio, DEMO_NAMES } from "@/lib/studio/demo";

describe("client design assistant rules", () => {
  it("spots price questions", () => {
    for (const q of ["What would this cost?", "how much is it in 22k", "Can you give me a quote", "is platinum more expensive?", "my budget is 2 lakh", "₹3,00,000 ok?", "Is it cheaper in 18k?"])
      expect(isPriceQuestion(q), q).toBe(true);
    for (const q of ["How much would it be?", "how much in 22k?", "Is it more expensive in platinum?", "What's the gold rate?", "Any making charges?"])
      expect(isPriceQuestion(q), q).toBe(true);
    for (const q of ["Would this suit everyday wear?", "Is 22k too soft?", "Can I see it in platinum?", "Does the costume look work?", "How accurate is the size?",
      "How much bigger can the stone go?", "How much smaller could the band be?", "Does it look expensive?", "I don't want it to look cheap", "Is this a first-rate stone?",
      "How much of the band is set with diamonds?", "How much room is there for an engraving?"])
      expect(isPriceQuestion(q), q).toBe(false);
  });
  it("catches money in an answer but not karats or sizes", () => {
    for (const a of ["That would be around ₹2,40,000.", "Roughly 3 lakh rupees", "It's priced at 185000 or so", "about $4,000", "Rs. 50,000 making"])
      expect(mentionsMoney(a), a).toBe(true);
    for (const a of ["22k is warmer than 18k.", "A 6.5 mm stone in US size 6.", "The studio will give you a price.", "It costs nothing to try it in platinum here."])
      expect(mentionsMoney(a), a).toBe(false);
  });
  it("sends price questions to the studio", () => {
    expect(priceReply("Kotharis Jewellers")).toMatch(/Kotharis Jewellers/);
    expect(priceReply("Kotharis Jewellers")).toMatch(/Ask the jeweller/);
    expect(mentionsMoney(priceReply("Kotharis Jewellers"))).toBe(false);
  });
  it("tells the assistant not to price or invent anything", () => {
    const s = clientChatSystem("Kotharis Jewellers", "Meher", "Two rings to choose between. Carl");
    expect(s).toMatch(/No prices, ever/);
    expect(s).toMatch(/Don't make anything up/);
    expect(s).toMatch(/Two rings to choose between/);
    expect(clientChatSystem("K", "M", "")).not.toMatch(/JEWELLER'S NOTE/);
  });
});

describe("demo link", () => {
  it("shows Meher's own ruby ring, her conversation and a price request for Carl", () => {
    const d = demoLinkDetail("demo-meher")!;
    const ruby = d.pieces[0];
    expect(ruby.version).toBe(MEHER_RUBY);
    expect(ruby.changes.join(" ")).toMatch(/22k/);
    expect(ruby.chat.some((m) => m.role === "user" && isPriceQuestion(m.content))).toBe(true);
    expect(d.pieces.flatMap((p) => p.chat).every((m) => !mentionsMoney(m.content))).toBe(true);
    const s = studioSummary(demoStudio().links, demoStudio().events, DEMO_NAMES);
    expect(s.needsYou.some((f) => f.kind === "asked-price")).toBe(true);
    expect(demoLinkDetail("nobody")).toBeNull();
  });
});

describe("chat replies", () => {
  it("come out as plain text", async () => {
    const { plainReply } = await import("@/lib/chat");
    expect(plainReply("**Centre stone:** an emerald.\n\n## Notes\n* round diamonds\n* rose-cuts")).toBe("Centre stone: an emerald.\n\nNotes\n• round diamonds\n• rose-cuts");
    expect(plainReply("A 2 * 3 grid stays")).toBe("A 2 * 3 grid stays");
  });
});
