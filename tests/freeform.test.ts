import { describe, expect, it } from "vitest";
import { FreeformSchema, chooseStyle, defaultDesign, DesignSchema } from "@/lib/design";
import { layoutFreeform } from "@/lib/freeform/layout";
import { checkLayout } from "@/lib/freeform/check";
import { toFreeform } from "@/lib/ai/freeform";
import { buildPiece } from "@/lib/jewelryModel";
import { pieceRoot } from "@/lib/cadExport";
import { solidMetal } from "@/lib/cadSolid";

const designOf = (type: "necklace" | "earrings" | "ring") => chooseStyle(defaultDesign(), type, "freeform");

describe("freeform designs", () => {
  for (const type of ["necklace", "earrings", "ring"] as const) {
    it(`${type}: the starting design lays out cleanly and builds`, () => {
      const d = designOf(type);
      const lay = layoutFreeform(d.freeform);
      expect(lay.stones.length).toBeGreaterThan(3);
      expect(checkLayout(d.freeform, lay, type, d.band.widthMm)).toEqual([]);
      let meshes = 0;
      buildPiece(d).group.traverse((o) => { if ((o as { isMesh?: boolean }).isMesh) meshes++; });
      expect(meshes).toBeGreaterThan(3);
    });
  }

  it("copies the right half to the left, keeping a stone on the centre line single", () => {
    const f = FreeformSchema.parse({ mirror: true, paths: [], parts: [
      { kind: "stone", at: [0, 10], shape: "oval", lengthMm: 8, widthMm: 6 },
      { kind: "stone", at: [9, 10], shape: "round", lengthMm: 3, widthMm: 3 },
    ] });
    const xs = layoutFreeform(f).stones.map((s) => s.x).sort((a, b) => a - b);
    expect(xs).toEqual([-9, 0, 9]);
  });

  it("finds stones that overlap and parts that aren't joined to anything", () => {
    const f = FreeformSchema.parse({ mirror: false, paths: [], parts: [
      { kind: "link", a: [0, 0], b: [0, 5] },
      { kind: "stone", at: [0, 9], shape: "round", lengthMm: 8, widthMm: 8 },
      { kind: "stone", at: [3, 9], shape: "round", lengthMm: 4, widthMm: 4 },
      { kind: "stone", at: [40, 40], shape: "round", lengthMm: 4, widthMm: 4 },
    ] });
    const issues = checkLayout(f, layoutFreeform(f), "necklace");
    expect(issues.some((i) => /overlap/.test(i))).toBe(true);
    expect(issues.some((i) => /not joined/.test(i) && /\(40, 40\)/.test(i))).toBe(true);
  });

  it("keeps what's usable from a design that comes back with mistakes", () => {
    const f = toFreeform({
      name: "Test", notes: "", mirror: false, neckline: { kind: "stones", gem: "not-a-gem", sizeMm: 30 },
      paths: [{ id: "swag", points: [[0, 0], [20, 30], [40, 0]] }],
      parts: [
        { kind: "row", path: "swag", shape: "baguette", sizeMm: 99, rows: 2.6, set: "across" },
        { kind: "row", path: "missing", shape: "round", sizeMm: 2 },
        { kind: "stone", at: [20, 40], shape: "pear", lengthMm: 10, widthMm: 6 },
      ],
    });
    expect(f).not.toBeNull();
    expect(f!.parts.map((p) => p.kind)).toEqual(["row", "stone"]);
    const row = f!.parts[0];
    if (row.kind !== "row") throw new Error("expected a row");
    expect(row.sizeMm).toBe(25);
    expect(row.rows).toBe(3);
    expect(f!.neckline.kind).toBe("chain");
  });

  it("casts a domed plate hung from a two-row line of stones as one piece", async () => {
    const freeform = FreeformSchema.parse({
      mirror: false, neckline: { kind: "stones", sizeMm: 2.8, rows: 2 },
      paths: [
        { id: "barrel", closed: true, points: [[57, 3.5], [65, 3], [73, 3.5], [75, 11], [73, 20], [65, 20.5], [57, 20], [55, 11]] },
        { id: "across", points: [[58.5, 11], [71.5, 11]] },
      ],
      parts: [
        { kind: "plate", path: "barrel", thicknessMm: 1.4, domeMm: 1.5 },
        { kind: "row", path: "across", shape: "baguette", sizeMm: 2.4, set: "across", rows: 2 },
      ],
    });
    const d = DesignSchema.parse({ ...designOf("necklace"), freeform });
    const r = (await solidMetal(pieceRoot(d)))!.report;
    expect(r.skipped).toEqual([]);
    expect(r.bodies?.filter((b) => b.mm3 > r.bodies![0].mm3 * 0.05)).toHaveLength(1);
    expect(r.unseated).toEqual([]);
  }, 120000);
});
