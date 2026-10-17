import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  CUTS, DesignSchema, GEMS, SHAPES, SHOWCASE, STYLES, TYPES, applyPatch, applyPatchLenient, bangleDiameter, chooseStyle, defaultDesign,
  describeDesign, estimateDims, indianRingSize, isSolidBracelet, lengthForShape, normalizeDesign, rightEarDesign, ringInnerDiameter,
  proportionPresets, reproportion, roundDiameter, showcaseDesign, stoneRatio, styleMeta, type DesignPatch,
} from "@/lib/design";

describe("applyPatch", () => {
  it("merges one level deep, keeping sibling fields", () => {
    const d = defaultDesign();
    const next = applyPatch(d, { center: { lengthMm: 9 } });
    expect(next.center.lengthMm).toBe(9);
    expect(next.center.widthMm).toBe(d.center.widthMm);
    expect(next.center.gem).toBe(d.center.gem);
  });

  it("returns the same design when the patch is invalid", () => {
    const d = defaultDesign();
    expect(applyPatch(d, { center: { lengthMm: 500 } })).toBe(d);
  });

  it("replaces arrays whole", () => {
    const d = applyPatch(defaultDesign(), { accents: { shapes: ["oval", "round"] } } as DesignPatch);
    expect(applyPatch(d, { accents: { shapes: ["heart"] } } as DesignPatch).accents.shapes).toEqual(["heart"]);
  });
});

describe("applyPatchLenient", () => {
  it("keeps the valid fields when one field is out of range", () => {
    const d = defaultDesign();
    const next = applyPatchLenient(d, { metal: "platinum", center: { lengthMm: 500 } } as DesignPatch);
    expect(next.metal).toBe("platinum");
    expect(next.center.lengthMm).toBe(d.center.lengthMm);
  });

  it("keeps the valid drop parts and drops the broken ones", () => {
    const d = chooseStyle(defaultDesign(), "earrings", "pendant");
    const next = applyPatchLenient(d, { drop: { parts: [{ kind: "stone" }, { kind: "nonsense" }], top: "hook" } } as unknown as DesignPatch);
    expect(next.drop.parts).toHaveLength(1);
    expect(next.drop.top).toBe("hook");
  });
});

describe("normalizeDesign", () => {
  it("fills every default from nothing", () => {
    expect(normalizeDesign(undefined)).toEqual(defaultDesign());
    expect(normalizeDesign(null)).toEqual(defaultDesign());
  });

  it("falls back to the default design for garbage", () => {
    expect(normalizeDesign({ type: "spaceship" })).toEqual(defaultDesign());
  });

  it("swaps an unknown style for the type's first style", () => {
    expect(normalizeDesign({ type: "necklace", style: "nope" }).style).toBe(Object.keys(STYLES.necklace)[0]);
  });

  it("does not accept inherited object keys as styles", () => {
    const d = normalizeDesign({ type: "ring", style: "toString" });
    expect(d.style).toBe(Object.keys(STYLES.ring)[0]);
    expect(() => describeDesign(d)).not.toThrow();
    expect(styleMeta("ring", "constructor")).toBe(STYLES.ring[Object.keys(STYLES.ring)[0]]);
  });
});

describe("chooseStyle", () => {
  it("gives every type and style a valid design", () => {
    for (const t of TYPES) for (const s of Object.keys(STYLES[t])) {
      const d = chooseStyle(defaultDesign(), t, s);
      expect(d.type).toBe(t);
      expect(d.style).toBe(s);
      expect(DesignSchema.safeParse(d).success).toBe(true);
    }
  });

  it("brings side stones back for three-stone rings", () => {
    const plain = applyPatch(defaultDesign(), { sides: { kind: "none" } });
    expect(chooseStyle(plain, "ring", "three-stone").sides.kind).not.toBe("none");
  });

  it("adds the partner stone to a two-stone ring, even beside a very long centre", () => {
    const long = applyPatch(defaultDesign(), { center: { lengthMm: 39, widthMm: 20 } });
    expect(chooseStyle(long, "ring", "two-stone").extraStones).toHaveLength(1);
  });

  it("scales an oversized stone down to suit the style", () => {
    const big = applyPatch(defaultDesign(), { center: { lengthMm: 30, widthMm: 20 } });
    const d = chooseStyle(big, "necklace", "riviera");
    expect(Math.max(d.center.lengthMm, d.center.widthMm)).toBeLessThanOrEqual(6.5);
  });

  it("scales very elongated stones without dropping below the minimum width", () => {
    const thin = applyPatch(defaultDesign(), { center: { lengthMm: 40, widthMm: 3 } });
    const d = chooseStyle(thin, "earrings", "stud");
    expect(Math.max(d.center.lengthMm, d.center.widthMm)).toBeLessThanOrEqual(11);
    expect(d.center.widthMm).toBeGreaterThanOrEqual(1);
  });
});

describe("rightEarDesign", () => {
  it("shares metal and karat with the pair", () => {
    const pair = applyPatch(chooseStyle(defaultDesign(), "earrings", "stud"), { metal: "rose-gold", rightEar: { style: "drop" } } as DesignPatch);
    const right = rightEarDesign(pair);
    expect(right.style).toBe("drop");
    expect(right.metal).toBe("rose-gold");
  });

  it("keeps hoops on both sides", () => {
    const hoops = applyPatch(chooseStyle(defaultDesign(), "earrings", "hoop"), { rightEar: { style: "stud" } } as DesignPatch);
    expect(rightEarDesign(hoops).style).toBe("hoop");
  });
});

describe("estimateDims", () => {
  it("always gives sizes the schema accepts", () => {
    for (const gem of GEMS) for (const cut of CUTS) for (const shape of SHAPES) for (const ct of [0.01, 0.1, 1, 15, 100, 200]) {
      const dims = estimateDims(gem, cut, shape, ct);
      const d = applyPatch(defaultDesign(), { center: { gem, cut, shape, carat: ct, ...dims } });
      expect(d.center.carat, `${gem} ${cut} ${shape} ${ct} ct → ${JSON.stringify(dims)}`).toBe(ct);
    }
  });

  it("keeps the shape's proportions when it has to shrink a huge stone", () => {
    const d = estimateDims("diamond", "faceted", "pear", 200);
    expect(d.lengthMm).toBe(40);
    expect(d.lengthMm / d.widthMm).toBeCloseTo(estimateDims("diamond", "faceted", "pear", 1).lengthMm / estimateDims("diamond", "faceted", "pear", 1).widthMm, 0);
  });

  it("sizes 1 ct of round diamond at about 6.5 mm, matching roundDiameter", () => {
    const d = estimateDims("diamond", "faceted", "round", 1);
    expect(d.widthMm).toBeCloseTo(6.5, 1);
    expect(d.widthMm).toBeCloseTo(roundDiameter("diamond", 1), 0);
  });

  it("grows with carat weight", () => {
    expect(estimateDims("ruby", "faceted", "oval", 2).widthMm).toBeGreaterThan(estimateDims("ruby", "faceted", "oval", 1).widthMm);
  });
});

describe("sizes", () => {
  it("converts US ring sizes to inner diameter", () => {
    expect(ringInnerDiameter(7)).toBeCloseTo(17.32, 1);
    expect(indianRingSize(7)).toBe(14);
  });

  it("converts Indian bangle sizes to inner diameter", () => {
    expect(bangleDiameter("2-4")).toBeCloseTo(57.15, 2);
    expect(bangleDiameter("2-8")).toBeCloseTo(63.5, 2);
  });

  it("gives about 6.5 mm for a 1 ct round diamond", () => {
    expect(roundDiameter("diamond", 1)).toBeCloseTo(6.5, 5);
  });

  it("keeps a reshaped stone within its allowed length", () => {
    expect(lengthForShape(14, "baguette")).toBe(30);
    expect(lengthForShape(1.7, "half-moon")).toBeGreaterThanOrEqual(1);
    expect(lengthForShape(5, "round")).toBe(5);
  });
});

describe("solid bracelets", () => {
  it("treat the open bangle as a bangle-sized piece", () => {
    const d = chooseStyle(defaultDesign(), "bracelet", "open-bangle");
    expect(isSolidBracelet(d)).toBe(true);
    expect(describeDesign(d)).toContain(`size ${d.options.bangleSize}`);
  });

  it("size tennis bracelets by wrist", () => {
    expect(isSolidBracelet(chooseStyle(defaultDesign(), "bracelet", "tennis"))).toBe(false);
  });
});

describe("showcase", () => {
  it("every showcase piece is a valid design under its own name", () => {
    for (const s of SHOWCASE) {
      const d = showcaseDesign(s);
      expect(DesignSchema.safeParse(d).success, s.name).toBe(true);
      expect(d.name).toBe(s.name);
      expect(d.style).toBe(s.style);
    }
  });

  it("keeps the wearer's sizes but nothing else from the piece on screen", () => {
    const current = applyPatch(defaultDesign(), { ringSize: 9, options: { wristCm: 19 }, center: { gem: "onyx" } });
    const d = showcaseDesign(SHOWCASE[0], current);
    expect(d.ringSize).toBe(9);
    expect(d.options.wristCm).toBe(19);
    expect(d.center.gem).not.toBe("onyx");
  });
});

describe("proportions", () => {
  const oval = { gem: "diamond" as const, cut: "faceted" as const, shape: "oval" as const, domeMm: 1 };

  it("keeps the carat weight: a longer oval is narrower and the same weight", () => {
    const classic = estimateDims("diamond", "faceted", "oval", 2);
    const long = reproportion({ ...oval, carat: 2, ...classic }, 1.7);
    expect(stoneRatio(long)).toBeCloseTo(1.7, 1);
    expect(long.lengthMm).toBeGreaterThan(classic.lengthMm);
    expect(long.widthMm).toBeLessThan(classic.widthMm);
    const vol = (d: { lengthMm: number; widthMm: number }) => d.lengthMm * d.widthMm ** 2;
    expect(vol(long) / vol(classic)).toBeCloseTo(1, 1);
    expect(long.lengthMm * long.widthMm).toBeGreaterThan(classic.lengthMm * classic.widthMm);
  });

  it("without a carat weight, keeps the stone's face area", () => {
    const fat = reproportion({ ...oval, carat: null, lengthMm: 10, widthMm: 8 }, 1.1);
    expect(fat.lengthMm * fat.widthMm).toBeCloseTo(80, -1);
    expect(stoneRatio(fat)).toBeCloseTo(1.1, 1);
  });

  it("offers short, classic and long cuts around the shape's usual ratio", () => {
    const [short, classic, long] = proportionPresets("oval").map(([, r]) => r);
    expect(short).toBeLessThan(classic);
    expect(long).toBeGreaterThan(classic);
  });

  it("always gives a stone the schema accepts", () => {
    for (const r of [0.5, 1, 2.6, 3]) {
      const dims = reproportion({ ...oval, carat: 30, lengthMm: 20, widthMm: 15 }, r);
      expect(applyPatch(defaultDesign(), { center: { ...oval, carat: 30, ...dims } }).center.carat).toBe(30);
    }
  });
});

describe("accent stones on/off", () => {
  it("is offered on styles with a main stone, not where the accents are the piece", async () => {
    const { accentsOptional } = await import("@/lib/design");
    expect(accentsOptional({ type: "ring", style: "halo" })).toBe(true);
    expect(accentsOptional({ type: "earrings", style: "stud" })).toBe(true);
    expect(accentsOptional({ type: "bracelet", style: "tennis" })).toBe(false);
    expect(accentsOptional({ type: "ring", style: "eternity" })).toBe(false);
  });

  it("takes the accents out of the piece and its description, keeping the main stone and band stones", async () => {
    const { buildPiece } = await import("@/lib/jewelryModel");
    const count = (d: ReturnType<typeof defaultDesign>, part: string) => { let n = 0; buildPiece(d).group.traverse((o) => { if (o.userData.part === part) n++; }); return n; };
    const on = applyPatch(chooseStyle(defaultDesign(), "ring", "halo"), { band: { pave: "shoulders" } });
    const off = applyPatch(on, { accents: { enabled: false } });
    expect(count(on, "accents")).toBeGreaterThan(count(off, "accents"));
    expect(count(off, "accents")).toBeGreaterThan(0);
    expect(count(off, "center")).toBe(count(on, "center"));
    expect(describeDesign(off)).not.toContain("accents");
  });

  it("doesn't touch styles where accents can't be switched off", async () => {
    const { buildPiece } = await import("@/lib/jewelryModel");
    const { fingerprint } = await import("./fingerprint");
    const tennis = chooseStyle(defaultDesign(), "bracelet", "tennis");
    expect(fingerprint(buildPiece(applyPatch(tennis, { accents: { enabled: false } })))).toEqual(fingerprint(buildPiece(tennis)));
  });
});

describe("showcase categories", async () => {
  const { SHOWCASE_CATEGORIES, showcaseIn, categoryFor, SHOWCASE } = await import("@/lib/design");
  it("puts every showcase piece in at least one category, and keeps each list short", () => {
    const seen = new Set(SHOWCASE_CATEGORIES.flatMap((c) => showcaseIn(c.id).map((x) => x.index)));
    expect(seen.size).toBe(SHOWCASE.length);
    for (const c of SHOWCASE_CATEGORIES) if (c.id !== "kothari" && c.id !== "more") expect(showcaseIn(c.id).length, c.id).toBeLessThanOrEqual(25);
  });
  it("opens on the piece's own type", () => {
    expect(categoryFor("ring")).toBe("ring");
    expect(categoryFor("mens")).toBe("more");
  });
});

describe("half-flower and gallery options", async () => {
  const { buildPiece } = await import("@/lib/jewelryModel");
  const ring = chooseStyle(defaultDesign(), "ring", "half-flower");
  const flowerCentre = (d: ReturnType<typeof defaultDesign>) => {
    const p = buildPiece(d); p.group.updateMatrixWorld(true);
    let flower: THREE.Object3D | undefined;
    p.group.traverse((o) => { if (o.userData.keep && !o.userData.part) flower = o; });
    return new THREE.Box3().setFromObject(flower!).getCenter(new THREE.Vector3());
  };

  it("keeps the flowers when accent stones are switched off", () => {
    const meshes = (d: ReturnType<typeof defaultDesign>) => { let n = 0; buildPiece(d).group.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; }); return n; };
    expect(meshes(applyPatch(ring, { accents: { enabled: false } }))).toBe(meshes(ring));
  });

  it("puts the flowers along the band (x) or along the finger (z)", () => {
    const finger = flowerCentre(ring), band = flowerCentre(applyPatch(ring, { options: { flowerPlace: "band" } }));
    expect(Math.abs(finger.z)).toBeGreaterThan(Math.abs(finger.x) + 2);
    expect(Math.abs(band.x)).toBeGreaterThan(Math.abs(band.z) + 2);
  });

  it("sets a whole row of stones under the head for a hidden halo", () => {
    const stones = (d: ReturnType<typeof defaultDesign>) => { let n = 0; buildPiece(d).group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry.type === "BufferGeometry" && (m.material as THREE.MeshPhysicalMaterial).color?.getHex() === 0xf4f6ff) n++; }); return n; };
    const peek = stones(ring), hidden = stones(applyPatch(ring, { gallery: { under: "hidden-halo" } })), none = stones(applyPatch(ring, { gallery: { roseCut: false } }));
    expect(peek).toBe(2);
    expect(hidden).toBeGreaterThan(8);
    expect(none).toBe(0);
  });
});

describe("clasps", async () => {
  const { resolveClasp, claspChoices } = await import("@/lib/design");
  it("default to each piece's usual clasp", () => {
    expect(resolveClasp("line", "auto")).toBe("box");
    expect(resolveClasp("pearl-strand", "auto")).toBe("box");
    expect(resolveClasp("tennis", "auto")).toBe("hidden");
    expect(resolveClasp("pendant", "auto")).toBe("none");
  });
  it("only hide or jewel the clasp on lines of stones", () => {
    expect(claspChoices("line")).toContain("hidden");
    expect(claspChoices("pendant")).not.toContain("hidden");
    expect(resolveClasp("pendant", "hidden")).toBe("none");
    expect(resolveClasp("pendant", "lobster")).toBe("lobster");
  });
});
