import { describe, expect, it } from "vitest";
import { SHOWCASE, applyPatch, designForAi, showcaseDesign, uses } from "@/lib/design";

const ruby = showcaseDesign(SHOWCASE.find((s) => s.name === "Half-flowered Burmese ruby ring")!);

describe("the design as the AI sees it", () => {
  it("leaves out parts the piece doesn't have, so the AI can't mention them", () => {
    const emerald = applyPatch(ruby, { center: { gem: "emerald", label: "Colombian emerald" } });
    const { label, ...rest } = designForAi(emerald);
    const text = JSON.stringify(rest);
    expect(label).toMatch(/ruby/i);
    expect(text).not.toMatch(/ruby|pearl/i);
    expect(text).toMatch(/emerald/);
    expect(rest.inWords).toMatch(/emerald/);
    expect(rest).not.toHaveProperty("fringe");
  });
  it("keeps everything a piece uses", () => {
    for (const entry of SHOWCASE.slice(0, 40)) {
      const d = showcaseDesign(entry);
      const ai = designForAi(d);
      expect(ai.inWords, entry.name).toBeTruthy();
      if (d.type === "ring") expect(ai).toHaveProperty("band");
      if (!d.center.none && uses(d, "center")) expect(ai, entry.name).toHaveProperty("center");
      else expect(ai, entry.name).not.toHaveProperty("center");
      expect(JSON.stringify(ai).length, entry.name).toBeLessThan(JSON.stringify(d).length + 400);
    }
  });
});
