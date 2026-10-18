import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "three/examples/jsm/libs/fflate.module.js";
import { SHOWCASE, showcaseDesign } from "@/lib/design";
import { cadZip } from "@/lib/cadExport";

describe("CAD export", () => {
  it("packs metal and stones as STL at real size, with a readme", () => {
    const files = unzipSync(cadZip(showcaseDesign(SHOWCASE.find((x) => x.name === "Oval trilogy ring")!)));
    expect(files["metal.stl"].length).toBeGreaterThan(84);
    expect(Object.keys(files).some((k) => k.startsWith("stones-"))).toBe(true);
    const view = new DataView(files["metal.stl"].buffer, files["metal.stl"].byteOffset);
    let maxAbs = 0;
    for (let t = 0; t < Math.min(2000, view.getUint32(80, true)); t++) for (let k = 0; k < 9; k++) maxAbs = Math.max(maxAbs, Math.abs(view.getFloat32(84 + t * 50 + 12 + k * 4, true)));
    expect(maxAbs).toBeGreaterThan(8);
    expect(maxAbs).toBeLessThan(30);
    expect(strFromU8(files["README.txt"])).toContain("millimetres");
  });
});
