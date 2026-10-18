import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { SHOWCASE, showcaseDesign } from "@/lib/design";
import { modelParts } from "@/lib/cadExport";
import { rhinoFile } from "@/lib/cad3dm";

describe("Rhino file", () => {
  it("writes metal and each stone as named objects in millimetres", async () => {
    const parts = modelParts(showcaseDesign(SHOWCASE.find((x) => x.name === "Oval trilogy ring")!));
    const bytes = await rhinoFile(parts, "Oval trilogy ring");
    const rhino = await (await import("rhino3dm")).default();
    const file = rhino.File3dm.fromByteArray(bytes);
    expect(file.settings().modelUnitSystem).toBe(rhino.UnitSystem.Millimeters);
    const names = Array.from({ length: file.objects().count }, (_, i) => file.objects().get(i).attributes().name);
    expect(names).toContain("Metal (union before casting)");
    expect(names.length).toBe(1 + parts.filter((p) => !p.metal).reduce((a, p) => a + p.geos.length, 0));
    expect(file.layers().count).toBe(parts.length);
  });
});
