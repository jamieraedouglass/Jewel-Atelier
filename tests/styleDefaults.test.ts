import { describe, expect, it } from "vitest";
import { DesignSchema, STYLES, TYPES, defaultDesign } from "@/lib/design";

describe("style defaults", () => {
  for (const type of TYPES)
    for (const [style, meta] of Object.entries(STYLES[type]))
      it(`${type}/${style} defaults are a valid design`, () => {
        const d = defaultDesign() as unknown as Record<string, unknown>;
        const merged: Record<string, unknown> = { ...d, type, style };
        for (const [k, v] of Object.entries(meta.defaults ?? {}))
          merged[k] = v && typeof v === "object" && !Array.isArray(v) ? { ...(d[k] as object), ...v } : v;
        const r = DesignSchema.safeParse(merged);
        expect(r.success ? "ok" : r.error.issues[0]).toBe("ok");
      });
});
