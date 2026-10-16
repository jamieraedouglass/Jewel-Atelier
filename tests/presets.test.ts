import { describe, expect, it } from "vitest";
import { CenterStoneSchema, DROP_PRESETS, DropPartSchema, FRAME_PRESETS, FrameSchema, SHOWCASE, applyPatch, chooseStyle, defaultDesign } from "@/lib/design";

/** a preset or showcase that fails validation is silently ignored by applyPatch, so check each one really parses */
describe("presets", () => {
  for (const p of DROP_PRESETS) it(`drop preset "${p.name}" parses`, () => {
    for (const part of p.parts) expect(DropPartSchema.safeParse(part).error?.issues).toBeUndefined();
  });
  for (const p of FRAME_PRESETS) it(`frame preset "${p.name}" parses`, () => {
    for (const f of p.frames) expect(FrameSchema.safeParse(f).error?.issues).toBeUndefined();
    if (p.center) expect(CenterStoneSchema.partial().safeParse(p.center).error?.issues).toBeUndefined();
  });
  for (const s of SHOWCASE) it(`showcase "${s.name}" applies its whole patch`, () => {
    const base = chooseStyle(defaultDesign(), s.type, s.style);
    if (Object.keys(s.patch).length) expect(applyPatch(base, s.patch)).not.toBe(base);
  });
});
