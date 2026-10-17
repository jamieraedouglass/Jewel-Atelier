import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applyPatch, chooseStyle, defaultDesign, noAccentsYet, type Design } from "@/lib/design";

const toiEtMoi = () => chooseStyle(defaultDesign(), "ring", "two-stone");

/** how far apart the two stones' centres sit */
async function spread(d: Design) {
  const { buildPiece } = await import("@/lib/jewelryModel");
  const g = buildPiece(d).group;
  let head = 0, partner = 0;
  g.traverse((o) => { if (o === g.userData.head) head = o.position.x; if (o.userData.part === "extra") partner = o.position.x; });
  return partner - head;
}

describe("toi-et-moi", () => {
  it("sets the stones a little apart by default, or touching", async () => {
    const d = toiEtMoi();
    expect(d.options.pairSpacing).toBe("apart");
    const apart = await spread(d);
    const touching = await spread(applyPatch(d, { options: { pairSpacing: "touching" } }));
    expect(touching).toBeLessThan(apart);
    // touching: the two stones' edges meet, with only a hair between them
    const reachA = d.center.widthMm / 2, reachB = d.extraStones[0].widthMm / 2;
    expect(touching).toBeGreaterThan(reachA + reachB - 0.5);
  });
  it("brings an angled pear right up to its partner", async () => {
    const d = applyPatch(toiEtMoi(), { options: { pairSpacing: "touching" } });
    const pear = { ...d, extraStones: [{ ...d.extraStones[0], shape: "pear" as const, lengthMm: 9, widthMm: 6, rotation: 45 }] };
    const straight = { ...pear, extraStones: [{ ...pear.extraStones[0], rotation: 0 }] };
    expect(await spread(pear)).not.toBe(await spread(straight));
  });
  it("explains when there are no accent stones to switch", () => {
    const d = toiEtMoi();
    expect(noAccentsYet({ ...d, options: { ...d.options, halo: false }, band: { ...d.band, pave: "none" } })).toMatch(/surround/);
    expect(noAccentsYet({ ...d, options: { ...d.options, halo: true } })).toBeNull();
    expect(noAccentsYet(defaultDesign())).toBeNull();
  });
});
void THREE;

describe("a halo round each stone in a line", () => {
  it("follows the stone's own shape", async () => {
    const { haloRing } = await import("@/lib/jewelry/ringHeads");
    const zs = (shape: "oval" | "heart") => { const out: { pos: THREE.Vector3 }[] = []; haloRing(new THREE.Vector3(), new THREE.Quaternion(), 4, 4, out as never, shape); return out.map((o) => o.pos.z); };
    const span = (z: number[]) => [Math.min(...z), Math.max(...z)];
    const [oLo, oHi] = span(zs("oval")), [hLo, hHi] = span(zs("heart"));
    expect(Math.abs(oLo + oHi)).toBeLessThan(0.05); // an oval's halo is symmetric end to end
    expect(Math.abs(hLo + hHi)).toBeGreaterThan(0.1); // a heart's isn't: point at one end, lobes at the other
  });
});
