import { describe, expect, it } from "vitest";
import { chooseStyle, defaultDesign } from "@/lib/design";
import { buildPiece, buildWornPiece } from "@/lib/jewelryModel";
import { fingerprint } from "./fingerprint";

describe("worn pieces", () => {
  it("flattening one build never leaks into the next", () => {
    const d = chooseStyle(defaultDesign(), "necklace", "riviera");
    const before = fingerprint(buildPiece(d));
    const worn = fingerprint(buildWornPiece(d, 0.4));
    expect(worn.hash).not.toBe(before.hash);
    expect(fingerprint(buildPiece(d))).toEqual(before);
  });

  it("restores the flat loop even if a build throws", async () => {
    const { withLoopFlatten } = await import("@/lib/jewelry/curves");
    const d = chooseStyle(defaultDesign(), "bracelet", "tennis");
    const before = fingerprint(buildPiece(d));
    expect(() => withLoopFlatten(0.3, () => { throw new Error("boom"); })).toThrow("boom");
    expect(fingerprint(buildPiece(d))).toEqual(before);
  });
});
