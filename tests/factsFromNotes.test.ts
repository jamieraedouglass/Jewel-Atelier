import { describe, expect, it } from "vitest";
import { factsFromNotes } from "@/lib/ai/recreate";

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
