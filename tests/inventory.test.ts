import { describe, expect, it } from "vitest";
import { inventoryCsv, inventoryTotals, normalizeInventory, normalizeStatus, tasteWeight, type InventoryRow } from "@/lib/inventory";

const row = (id: string, inv: Record<string, unknown>, name = id): InventoryRow => ({ id, name, madeAt: "2026-09-01T00:00:00Z", inventory: normalizeInventory(inv), summary: "Ring · 18k gold" });

describe("inventory", () => {
  it("reads statuses safely", () => {
    expect(normalizeStatus("made")).toBe("made");
    expect(normalizeStatus("bogus")).toBe("idea");
    expect(normalizeStatus(undefined)).toBe("idea");
  });

  it("keeps the good details when one is bad", () => {
    const i = normalizeInventory({ ref: "KJ-1", weightG: -3, price: 50000, availability: "teleported" });
    expect(i.ref).toBe("KJ-1");
    expect(i.weightG).toBeNull();
    expect(i.price).toBe(50000);
    expect(i.availability).toBe("in-stock");
  });

  it("totals metal and stock in hand, with sold pieces apart, by currency", () => {
    const t = inventoryTotals([
      row("a", { weightG: 5.5, stonesCt: 1.2, price: 100000, currency: "INR" }),
      row("b", { weightG: 3, price: 2000, currency: "USD", availability: "reserved" }),
      row("c", { weightG: 9, price: 250000, currency: "INR", availability: "sold" }),
    ]);
    expect(t).toMatchObject({ pieces: 3, inStock: 2, sold: 1, weightG: 8.5, stonesCt: 1.2 });
    expect(t.value).toEqual([["INR", { stock: 100000, sold: 250000 }], ["USD", { stock: 2000, sold: 0 }]]);
  });

  it("makes a spreadsheet that survives commas, quotes and line breaks", () => {
    const csv = inventoryCsv([row("a", { ref: "KJ-1", notes: 'Re-polish, "soon"\nsecond line', price: 1000 }, "Ruby, pear")]);
    const [head, line] = [csv.split("\n")[0], csv.slice(csv.indexOf("\n") + 1)];
    expect(head.startsWith("Reference,Name,Made")).toBe(true);
    expect(line).toContain('"Ruby, pear"');
    expect(line).toContain('"Re-polish, ""soon""\nsecond line"');
    expect(line).toContain("2026-09-01");
  });
});

describe("taste weighting", () => {
  const now = Date.parse("2026-10-17T00:00:00Z");
  it("counts made pieces most and new work more than old", () => {
    expect(tasteWeight("made", "2026-10-16T00:00:00Z", now)).toBeGreaterThan(tasteWeight("workshop", "2026-10-16T00:00:00Z", now));
    expect(tasteWeight("workshop", "2026-10-16T00:00:00Z", now)).toBeGreaterThan(tasteWeight("idea", "2026-10-16T00:00:00Z", now));
    expect(tasteWeight("idea", "2026-10-16T00:00:00Z", now)).toBeGreaterThan(tasteWeight("idea", "2025-10-16T00:00:00Z", now));
    expect(tasteWeight("idea", "2015-01-01T00:00:00Z", now)).toBeCloseTo(0.2);
  });
});
