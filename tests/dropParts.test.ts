import { describe, expect, it } from "vitest";
import { DropPartSchema, copyDropPart, moveDropPart, removeDropPart, updateDropPart, type DropPart } from "@/lib/design";

/** a list of parts; `from` -1 = hangs from the part just above */
const parts = (...from: number[]): DropPart[] => from.map((f, i) => DropPartSchema.parse({ from: f, gapMm: i }));
const froms = (list: DropPart[]) => list.map((p) => p.from);
const ids = (list: DropPart[]) => list.map((p) => p.gapMm);

describe("drop parts", () => {
  it("moving a part keeps references pointing at the same parts", () => {
    // part 3 hangs from part 0; swap parts 0 and 1
    const next = moveDropPart(parts(-1, -1, -1, 0), 0, 1);
    expect(ids(next)).toEqual([1, 0, 2, 3]);
    expect(froms(next)).toEqual([-1, -1, -1, 1]);
  });

  it("moving a part above the part it hangs from resets it", () => {
    // part 2 hangs from part 1; moving part 2 up past part 1 would make it hang from a part below it
    const next = moveDropPart(parts(-1, -1, 1), 2, -1);
    expect(froms(next)[1]).toBe(-1);
  });

  it("ignores moves off either end", () => {
    const list = parts(-1, -1);
    expect(moveDropPart(list, 0, -1)).toBe(list);
    expect(moveDropPart(list, 1, 1)).toBe(list);
  });

  it("copying a part shifts later references past the copy", () => {
    const next = copyDropPart(parts(-1, -1, 1, 2), 1);
    expect(ids(next)).toEqual([0, 1, 1, 2, 3]);
    expect(froms(next)).toEqual([-1, -1, -1, 1, 3]);
  });

  it("removing a part re-points or resets what hung from it", () => {
    const next = removeDropPart(parts(-1, -1, 1, 0, 2), 1);
    expect(ids(next)).toEqual([0, 2, 3, 4]);
    expect(froms(next)).toEqual([-1, -1, 0, 1]);
  });

  it("an invalid change leaves the list as it was instead of throwing", () => {
    const list = parts(-1);
    expect(updateDropPart(list, 0, { gapMm: -5 })).toBe(list);
    expect(updateDropPart(list, 0, { gapMm: 3 })[0].gapMm).toBe(3);
  });
});
