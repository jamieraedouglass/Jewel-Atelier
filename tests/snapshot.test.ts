import { describe, expect, it } from "vitest";
import { buildPiece, buildWornPiece } from "@/lib/jewelryModel";
import { disposeGroup } from "@/lib/ringModel";
import { fingerprint } from "./fingerprint";
import { allDesigns } from "./pieces";

describe("geometry snapshots", () => {
  for (const { name, design } of allDesigns()) {
    it(name, () => {
      const p = buildPiece(design);
      const fp = fingerprint(p);
      disposeGroup(p.group);
      const worn = !p.upright && ["necklace", "bracelet", "anklet"].includes(design.type) ? fingerprint(buildWornPiece(design, 0.5)) : null;
      expect({ fp, worn }).toMatchSnapshot();
    });
  }
});
