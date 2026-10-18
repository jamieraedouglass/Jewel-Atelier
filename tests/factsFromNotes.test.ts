import { describe, expect, it } from "vitest";
import { factsFromNotes, tipFromNotes, withConfirmedCounts, withStructure } from "@/lib/ai/recreate";

describe("factsFromNotes", () => {
  it("reads the seller's details", () => {
    const n = "GIA certified 1.72 ct, H VS1 antique moval diamond in 18k yellow gold. The entire ring measures 20.4 x 20.3, it weighs 5.63 g, it is a size 6,";
    expect(factsFromNotes(n, "ring")).toEqual({ ringSize: 6, carat: 1.72, karat: 18 });
  });
  it("handles half sizes and ignores total weights", () => {
    expect(factsFromNotes("ring size 6.5, 2.1 ctw total, 14k white", "ring")).toEqual({ ringSize: 6.5, karat: 14 });
    expect(factsFromNotes("size 7 1/2, center stone 3 carats", "ring")).toEqual({ ringSize: 7.5, carat: 3 });
  });
  it("only sets a ring size on rings, and never from a size in mm", () => {
    expect(factsFromNotes("size 6", "earrings")).toEqual({});
    expect(factsFromNotes("stone size 8 mm", "ring")).toEqual({});
    expect(factsFromNotes("indian size 13", "ring")).toEqual({});
  });
});

describe("tipFromNotes", () => {
  it("turns a clock hour into a drop-stone rotation", () => {
    expect(tipFromNotes("On the left piece, the main stone's tip points to about 12 o'clock.")).toBe(180);
    expect(tipFromNotes("tip points to about 3 o'clock")).toBe(90);
    expect(tipFromNotes("tip points to about 9 o'clock")).toBe(-90);
    expect(tipFromNotes("tip points to about 10 o'clock")).toBe(-120);
    expect(tipFromNotes("tip points to about 10:30 o'clock")).toBe(-135);
    expect(tipFromNotes("tip points to about 6 o'clock")).toBe(0);
    expect(tipFromNotes("no tip here")).toBeNull();
  });
});

describe("withConfirmedCounts", () => {
  it("applies a confirmed count to the one part holding those stones", () => {
    const parts = [{ kind: "stone", count: 8, small: { cut: "briolette", shapes: ["pear"] } }, { kind: "stone", count: 7, small: { cut: "faceted", shapes: ["round"] } }];
    const notes = "Confirmed reading:\n- 12 × briolette diamond drops (drop, briolette), each about 20%.\n- 14 × small round diamond collar (round), each about 6%.";
    const out = withConfirmedCounts(parts, notes);
    expect(out.map((p) => p.count)).toEqual([12, 14]);
  });
});

describe("factsFromNotes at the end of a sentence", () => {
  it("reads a ring size followed by a full stop", () => {
    expect(factsFromNotes("18k yellow gold. Ring size 6. The whole top measures 20.4 mm", "ring").ringSize).toBe(6);
  });
});

describe("withStructure", () => {
  it("applies the confirmed shape of a ring", () => {
    const notes = ["- Top measures 20.4 mm along the finger x 20.3 mm across.", "- Profile: high dome curving down into the shoulders.", "- Stones carry on down the sides of the top.", "- Shoulders: stones about a third of the way down.", "- Band 2.8 mm wide at the back."].join("\n");
    const out = withStructure({ band: { widthMm: 2, pave: "none" }, options: { decoBend: 0.2 } }, "deco", notes) as { band: Record<string, unknown>; options: Record<string, unknown> };
    expect(out.band).toMatchObject({ widthMm: 2.8, pave: "shoulders" });
    expect(out.options).toMatchObject({ decoLengthMm: 20.4, decoWidthMm: 20.3, decoDome: 0.9, decoBend: 0.7, decoWrap: true });
  });
});
