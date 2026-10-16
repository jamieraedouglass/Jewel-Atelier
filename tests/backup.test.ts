import { describe, expect, it } from "vitest";
import { backupRows } from "@/lib/backup";
import { applyPatch, defaultDesign } from "@/lib/design";

describe("backupRows", () => {
  it("reads designs and drops private photo links", () => {
    const data = applyPatch(defaultDesign(), { name: "Mine", center: { photoPath: "u/1.jpg" } });
    const r = backupRows(JSON.stringify({ designs: [{ name: "Mine", data }] }));
    expect("rows" in r && r.rows[0].name).toBe("Mine");
    expect("rows" in r && r.rows[0].data.center.photoPath).toBeNull();
  });

  it("skips entries that aren't designs instead of making blank ones", () => {
    const r = backupRows(JSON.stringify({ designs: [{ data: defaultDesign() }, { data: { type: "spaceship" } }, "junk", null] }));
    expect(r).toMatchObject({ skipped: 3 });
    expect("rows" in r && r.rows).toHaveLength(1);
  });

  it("explains files that aren't backups", () => {
    expect(backupRows("not json")).toEqual({ error: "That file isn't a designs backup." });
    expect(backupRows("null")).toEqual({ error: "No designs found in that file." });
    expect(backupRows(JSON.stringify({ designs: [{ data: 1 }] }))).toEqual({ error: "None of the designs in that file could be read." });
  });
});

describe("backups with tracking", () => {
  it("bring back where each piece is and its inventory", () => {
    const r = backupRows(JSON.stringify({ designs: [{ data: defaultDesign(), status: "made", made_at: "2026-01-02T00:00:00Z", inventory: { ref: "KJ-9", price: 5 } }, { data: defaultDesign() }] }));
    if (!("rows" in r)) throw new Error("should read");
    expect(r.rows[0]).toMatchObject({ status: "made", made_at: "2026-01-02T00:00:00Z", inventory: { ref: "KJ-9", price: 5 } });
    expect(r.rows[1].status).toBeUndefined();
  });
});
