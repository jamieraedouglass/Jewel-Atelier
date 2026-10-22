import { describe, expect, it } from "vitest";
import { chooseStyle, defaultDesign, DesignSchema, lookOf } from "@/lib/design";

describe("a design's other looks", () => {
  it("applies a look's changes over the design, leaving the design itself as it was", () => {
    const base = chooseStyle(defaultDesign(), "ring", "solitaire");
    const d = DesignSchema.parse({ ...base, looks: [{ name: "Emerald centre", patch: { center: { ...base.center, gem: "emerald", color: "#0a9a5c" } } }] });
    const v = lookOf(d, 0);
    expect(v.center.gem).toBe("emerald");
    expect(v.looks).toEqual([]);
    expect(d.center.gem).toBe(base.center.gem);
    expect(lookOf(d, 5)).toBe(d);
  });
});
