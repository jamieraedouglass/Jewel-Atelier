import { describe, expect, it } from "vitest";
import { correctionsOf, lessonsFrom } from "@/lib/readingLessons";

describe("learning from reading corrections", () => {
  const main = { photo: 0, x: 0.4, y: 0.4, w: 0.2, h: 0.2 };
  it("records what was added and taken away, and where", () => {
    const before = [{ what: "emerald leaves", marks: [{ x: 0.5, y: 0.5 }, { x: 0.9, y: 0.95 }] }];
    const after = [{ what: "emerald leaves", marks: [{ x: 0.5, y: 0.5 }, { x: 0.62, y: 0.5 }, { x: 0.95, y: 0.1 }] }, { what: "small round diamonds", marks: [{ x: 0.61, y: 0.6 }] }];
    const c = correctionsOf(before, after, main);
    expect(c[0]).toMatchObject({ found: 2, added: 2, removed: 1 });
    expect(c[0].where).toEqual(["round the main stone's edge", "out towards the edges and sides"]);
    expect(c[1]).toMatchObject({ what: "small round diamonds", found: 0, added: 1 });
  });
  it("sums corrections into guidance for the next reading", () => {
    const rows = [1, 2, 3].map(() => ({ groups: [{ what: "emerald leaf cabochons", found: 10, added: 5, removed: 0, where: ["out towards the edges and sides", "out towards the edges and sides"] }] }));
    const text = lessonsFrom(rows);
    expect(text).toContain("leaf and marquise stones: readings missed about 33%");
    expect(text).toContain("out towards the edges and sides");
    expect(lessonsFrom([])).toBe("");
  });
});
